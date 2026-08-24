import mongoose from "mongoose";

import Message from "../models/Message.js";
import Workspace from "../models/Workspace.js";
import {
  MAX_WORKSPACE_MEMORY_CONTENT_CHARS,
  MAX_WORKSPACE_MEMORY_SOURCE_MESSAGES,
  WORKSPACE_MEMORY_IMPORTANCE_LEVELS,
  WORKSPACE_MEMORY_TYPES,
} from "../models/WorkspaceMemory.js";
import WorkspaceReadState from "../models/WorkspaceReadState.js";
import AiUsageRateLimit from "../models/AiUsageRateLimit.js";
import { getAiConfig } from "../utils/aiConfig.js";
import { getEntitlementsForUser } from "../services/entitlements/entitlementService.js";
import {
  generateWorkspaceSummary,
  AiProviderError,
} from "../services/ai/aiService.js";
import {
  MAX_AGENT_QUESTION_CHARS,
  runWorkspaceAgent,
  WorkspaceAgentError,
} from "../services/ai/agent/workspaceAgentService.js";
import { createWorkspaceMemory } from "../services/memory/workspaceMemoryService.js";

const VALID_SCOPES = new Set(["missed", "recent", "overview"]);
const AGENT_REQUEST_FIELDS = new Set(["question"]);
const MEMORY_REQUEST_FIELDS = new Set([
  "type",
  "content",
  "importance",
  "sourceMessageIds",
]);
const MEMORY_TYPES = new Set(WORKSPACE_MEMORY_TYPES);
const MEMORY_IMPORTANCE_LEVELS = new Set(
  WORKSPACE_MEMORY_IMPORTANCE_LEVELS
);

let workspaceAgentRunnerOverride = null;
let workspaceAgentEntitlementResolverOverride = null;

// Deterministic integration-test seams. Production always uses the imported
// agent and entitlement services because these overrides default to null.
export const setWorkspaceAgentControllerOverrides = ({
  runner = null,
  entitlementResolver = null,
} = {}) => {
  workspaceAgentRunnerOverride = runner;
  workspaceAgentEntitlementResolverOverride = entitlementResolver;
};

export const resetWorkspaceAgentControllerOverrides = () => {
  workspaceAgentRunnerOverride = null;
  workspaceAgentEntitlementResolverOverride = null;
};

/**
 * Enforce MongoDB-backed user-level rate limit across all AI operations and
 * workspaces.
 * Limit: 60-minute request window anchored at first request.
 * Supports plan-based maxRequestsPerWindow.
 */
const checkAndIncrementAiRateLimit = async (userId, maxRequestsPerWindow) => {
  const config = getAiConfig();
  const lockId = `user_${userId.toString()}`;
  const now = new Date();
  const windowMs = config.rateLimitWindowMinutes * 60 * 1000;
  const windowStartCutoff = new Date(now.getTime() - windowMs);
  const expireAt = new Date(now.getTime() + windowMs);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Single atomic operation: increments active window or inserts new window if missing
      const lock = await AiUsageRateLimit.findOneAndUpdate(
        {
          _id: lockId,
          $or: [
            { windowStartedAt: { $exists: false } },
            { windowStartedAt: { $gt: windowStartCutoff } },
          ],
          requestCount: { $lt: maxRequestsPerWindow },
        },
        {
          $inc: { requestCount: 1 },
          $setOnInsert: {
            user: userId,
            windowStartedAt: now,
          },
          $set: { expireAt },
        },
        { upsert: true, returnDocument: "after" }
      );

      if (lock) {
        return { allowed: true };
      }
    } catch (error) {
      // E11000 means the document exists but failed query filter (i.e. requestCount >= max or window expired)
      if (error.code !== 11000) {
        throw error;
      }
    }

    // Handle expired window or rate limit exceeded
    const currentLock = await AiUsageRateLimit.findById(lockId).select(
      "windowStartedAt requestCount"
    );

    if (currentLock) {
      // If window is still active
      if (currentLock.windowStartedAt.getTime() > windowStartCutoff.getTime()) {
        if (currentLock.requestCount >= maxRequestsPerWindow) {
          const resetTime = currentLock.windowStartedAt.getTime() + windowMs;
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((resetTime - now.getTime()) / 1000)
          );

          return {
            allowed: false,
            retryAfterSeconds,
          };
        }
      } else {
        // Window expired: try resetting window
        const resetLock = await AiUsageRateLimit.findOneAndUpdate(
          {
            _id: lockId,
            windowStartedAt: currentLock.windowStartedAt,
          },
          {
            $set: {
              user: userId,
              windowStartedAt: now,
              requestCount: 1,
              expireAt,
            },
          },
          { returnDocument: "after" }
        );

        if (resetLock) {
          return { allowed: true };
        }

        // Another concurrent request reset the window first; continue to retry atomic increment against the new window
        continue;
      }
    }
  }

  // Fallback rate limit calculation
  const fallbackLock = await AiUsageRateLimit.findById(lockId).select(
    "windowStartedAt"
  );
  const resetTime =
    (fallbackLock?.windowStartedAt?.getTime() || now.getTime()) + windowMs;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((resetTime - now.getTime()) / 1000)
  );

  return {
    allowed: false,
    retryAfterSeconds,
  };
};

/**
 * POST /api/workspaces/:workspaceId/ai/agent
 *
 * Runs the read-only Workspace Agent with an authorization context assembled
 * exclusively from the authenticated user and current workspace document.
 */
export const askWorkspaceAgent = async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const { workspaceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({
        message: "Invalid workspace ID.",
        code: "INVALID_WORKSPACE_ID",
      });
    }

    if (!req.user?._id || !mongoose.Types.ObjectId.isValid(req.user._id)) {
      return res.status(401).json({
        message: "Not authorized, user session is invalid.",
        code: "INVALID_AUTHENTICATED_USER",
      });
    }

    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        message: "Request body must contain a question.",
        code: "INVALID_AGENT_REQUEST",
      });
    }

    const unexpectedFields = Object.keys(body).filter(
      (field) => !AGENT_REQUEST_FIELDS.has(field)
    );

    if (unexpectedFields.length > 0) {
      return res.status(400).json({
        message: "Request body may only contain a question.",
        code: "INVALID_AGENT_REQUEST",
      });
    }

    if (typeof body.question !== "string") {
      return res.status(400).json({
        message: "Question must be a string.",
        code: "INVALID_AGENT_QUESTION",
      });
    }

    const question = body.question.trim();

    if (question.length === 0) {
      return res.status(400).json({
        message: "Question is required.",
        code: "INVALID_AGENT_QUESTION",
      });
    }

    if (question.length > MAX_AGENT_QUESTION_CHARS) {
      return res.status(400).json({
        message: `Question cannot exceed ${MAX_AGENT_QUESTION_CHARS} characters.`,
        code: "INVALID_AGENT_QUESTION",
      });
    }

    const workspace = await Workspace.findById(workspaceId).select(
      "members"
    );

    if (!workspace) {
      return res.status(404).json({
        message: "Workspace not found.",
        code: "WORKSPACE_NOT_FOUND",
      });
    }

    const userId = req.user._id;
    const isMember = workspace.members.some(
      (memberId) => memberId.toString() === userId.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        message: "You are not a member of this workspace.",
        code: "WORKSPACE_ACCESS_DENIED",
      });
    }

    // protect reloads req.user from MongoDB for this request, so the role is
    // current server data rather than a JWT/body claim. Workspace membership
    // itself has no role field in the present schema.
    const role = req.user.role || "user";
    const entitlementResolver =
      workspaceAgentEntitlementResolverOverride ||
      getEntitlementsForUser;
    const entitlements = entitlementResolver(req.user);
    const aiEntitlement = entitlements?.aiSummary;

    if (aiEntitlement?.enabled !== true) {
      return res.status(403).json({
        message: "Your current plan does not include NovaHub AI access.",
        code: "AI_NOT_ENTITLED",
      });
    }

    const { requestsPerWindow, windowMinutes } = aiEntitlement;
    const rateLimitCheck = await checkAndIncrementAiRateLimit(
      userId,
      requestsPerWindow
    );

    if (!rateLimitCheck.allowed) {
      res.set(
        "Retry-After",
        rateLimitCheck.retryAfterSeconds.toString()
      );

      return res.status(429).json({
        message: `AI request limit exceeded. You can make up to ${requestsPerWindow} AI requests per ${windowMinutes} minutes.`,
        code: "RATE_LIMIT_EXCEEDED",
        retryAfterSeconds: rateLimitCheck.retryAfterSeconds,
      });
    }

    const agentRunner =
      workspaceAgentRunnerOverride || runWorkspaceAgent;
    const result = await agentRunner({
      workspaceId: workspace._id.toString(),
      userId: userId.toString(),
      role,
      question,
    });

    const memoryProposal = result.memoryProposal;
    const safeMemoryProposal =
      memoryProposal &&
      typeof memoryProposal === "object" &&
      MEMORY_TYPES.has(memoryProposal.type) &&
      typeof memoryProposal.content === "string" &&
      memoryProposal.content.trim().length > 0 &&
      memoryProposal.content.trim().length <=
        MAX_WORKSPACE_MEMORY_CONTENT_CHARS &&
      MEMORY_IMPORTANCE_LEVELS.has(memoryProposal.importance) &&
      Array.isArray(memoryProposal.sourceMessageIds) &&
      memoryProposal.sourceMessageIds.length <=
        MAX_WORKSPACE_MEMORY_SOURCE_MESSAGES &&
      memoryProposal.sourceMessageIds.every(
        (sourceId) =>
          typeof sourceId === "string" &&
          mongoose.Types.ObjectId.isValid(sourceId)
      )
        ? {
            type: memoryProposal.type,
            content: memoryProposal.content.trim(),
            importance: memoryProposal.importance,
            sourceMessageIds: [
              ...new Set(
                memoryProposal.sourceMessageIds.map((sourceId) =>
                  new mongoose.Types.ObjectId(sourceId).toString()
                )
              ),
            ],
          }
        : null;

    return res.status(200).json({
      answer: result.answer,
      toolsUsed: result.toolsUsed,
      steps: result.steps,
      memoryProposal: safeMemoryProposal,
    });
  } catch (error) {
    if (
      error instanceof WorkspaceAgentError ||
      error instanceof AiProviderError
    ) {
      return res.status(error.status).json({
        message: error.message,
        code: error.code,
      });
    }

    return res.status(500).json({
      message: "Nova could not answer that right now.",
      code: "WORKSPACE_AGENT_FAILED",
    });
  }
};

/**
 * POST /api/workspaces/:workspaceId/ai/memories
 *
 * Persists a Workspace Agent suggestion only after an authenticated member
 * explicitly approves it. This endpoint is an application REST write path;
 * the workspace MCP server remains read-only.
 */
export const saveApprovedWorkspaceMemory = async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const { workspaceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({
        message: "Invalid workspace ID.",
        code: "INVALID_WORKSPACE_ID",
      });
    }

    if (!req.user?._id || !mongoose.Types.ObjectId.isValid(req.user._id)) {
      return res.status(401).json({
        message: "Not authorized, user session is invalid.",
        code: "INVALID_AUTHENTICATED_USER",
      });
    }

    const workspace = await Workspace.findById(workspaceId).select(
      "members"
    );

    if (!workspace) {
      return res.status(404).json({
        message: "Workspace not found.",
        code: "WORKSPACE_NOT_FOUND",
      });
    }

    const isMember = workspace.members.some(
      (memberId) =>
        memberId.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        message: "You are not a member of this workspace.",
        code: "WORKSPACE_ACCESS_DENIED",
      });
    }

    // Workspace membership has no per-workspace role field today. The
    // established write policy therefore permits any current member to
    // approve a suggestion; no synthetic owner/member role is introduced.

    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        message: "Request body must contain a workspace memory.",
        code: "INVALID_MEMORY_REQUEST",
      });
    }

    const unexpectedFields = Object.keys(body).filter(
      (field) => !MEMORY_REQUEST_FIELDS.has(field)
    );

    if (unexpectedFields.length > 0) {
      return res.status(400).json({
        message:
          "Request body contains unsupported workspace memory fields.",
        code: "INVALID_MEMORY_REQUEST",
      });
    }

    if (typeof body.type !== "string" || !MEMORY_TYPES.has(body.type)) {
      return res.status(400).json({
        message: "Invalid workspace memory type.",
        code: "INVALID_MEMORY_TYPE",
      });
    }

    if (typeof body.content !== "string") {
      return res.status(400).json({
        message: "Workspace memory content must be a string.",
        code: "INVALID_MEMORY_CONTENT",
      });
    }

    const content = body.content.trim();

    if (content.length === 0) {
      return res.status(400).json({
        message: "Workspace memory content is required.",
        code: "INVALID_MEMORY_CONTENT",
      });
    }

    if (content.length > MAX_WORKSPACE_MEMORY_CONTENT_CHARS) {
      return res.status(400).json({
        message: `Workspace memory content cannot exceed ${MAX_WORKSPACE_MEMORY_CONTENT_CHARS} characters.`,
        code: "INVALID_MEMORY_CONTENT",
      });
    }

    if (
      typeof body.importance !== "string" ||
      !MEMORY_IMPORTANCE_LEVELS.has(body.importance)
    ) {
      return res.status(400).json({
        message: "Invalid workspace memory importance.",
        code: "INVALID_MEMORY_IMPORTANCE",
      });
    }

    const suppliedSourceIds =
      body.sourceMessageIds === undefined
        ? []
        : body.sourceMessageIds;

    if (!Array.isArray(suppliedSourceIds)) {
      return res.status(400).json({
        message: "sourceMessageIds must be an array.",
        code: "INVALID_MEMORY_PROVENANCE",
      });
    }

    if (
      suppliedSourceIds.length > MAX_WORKSPACE_MEMORY_SOURCE_MESSAGES
    ) {
      return res.status(400).json({
        message: `A workspace memory can reference at most ${MAX_WORKSPACE_MEMORY_SOURCE_MESSAGES} source messages.`,
        code: "INVALID_MEMORY_PROVENANCE",
      });
    }

    if (
      suppliedSourceIds.some(
        (sourceId) =>
          typeof sourceId !== "string" ||
          !mongoose.Types.ObjectId.isValid(sourceId)
      )
    ) {
      return res.status(400).json({
        message: "Every source message ID must be valid.",
        code: "INVALID_MEMORY_PROVENANCE",
      });
    }

    const sourceMessageIds = [
      ...new Set(
        suppliedSourceIds.map((sourceId) =>
          new mongoose.Types.ObjectId(sourceId).toString()
        )
      ),
    ];

    if (sourceMessageIds.length > 0) {
      const authorizedSources = await Message.find({
        _id: { $in: sourceMessageIds },
        workspace: workspace._id,
      })
        .select("_id")
        .lean();

      if (authorizedSources.length !== sourceMessageIds.length) {
        return res.status(400).json({
          message:
            "Every source message must exist in the current workspace.",
          code: "INVALID_MEMORY_PROVENANCE",
        });
      }
    }

    const memory = await createWorkspaceMemory({
      workspaceId: workspace._id,
      type: body.type,
      content,
      sourceMessageIds,
      createdBy: req.user._id,
      importance: body.importance,
    });

    return res.status(201).json({
      memory: {
        id: memory._id.toString(),
        type: memory.type,
        content: memory.content,
        importance: memory.importance,
        sourceMessageIds: memory.sourceMessageIds.map((sourceId) =>
          sourceId.toString()
        ),
        createdAt: memory.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        message: "Workspace memory is invalid.",
        code: "INVALID_MEMORY_REQUEST",
      });
    }

    return res.status(500).json({
      message: "Workspace memory could not be saved right now.",
      code: "WORKSPACE_MEMORY_SAVE_FAILED",
    });
  }
};

/**
 * POST /api/workspaces/:workspaceId/ai/summary
 *
 * Generates an AI summary for a workspace according to scope ("missed" | "recent" | "overview").
 * Plan entitlements (rate limit, max messages, max chars) are resolved from authenticated req.user.
 */
export const getWorkspaceAiSummary = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { scope } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({
        message: "Invalid workspace ID.",
      });
    }

    if (typeof scope !== "string" || !VALID_SCOPES.has(scope)) {
      return res.status(400).json({
        message:
          "Invalid scope. Must be one of: 'missed', 'recent', 'overview'.",
      });
    }

    const workspace = await Workspace.findById(workspaceId).select(
      "members"
    );

    if (!workspace) {
      return res.status(404).json({
        message: "Workspace not found.",
      });
    }

    const isMember = workspace.members.some(
      (memberId) => memberId.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        message: "You are not a member of this workspace.",
      });
    }

    // Resolve plan entitlements strictly from authenticated user (ignoring any client body overrides)
    const entitlements = getEntitlementsForUser(req.user);
    const { requestsPerWindow, windowMinutes, maxMessages, maxChars } =
      entitlements.aiSummary;

    let messages = [];
    let totalEligibleMessages = 0;

    if (scope === "missed") {
      let state = await WorkspaceReadState.findOne({
        user: req.user._id,
        workspace: workspaceId,
      });

      if (!state) {
        // Lazy initialize state to current latest message
        const latestMessage = await Message.findOne({
          workspace: workspaceId,
        })
          .sort({ createdAt: -1, _id: -1 })
          .select("_id createdAt")
          .lean();

        const initFields = latestMessage
          ? {
              lastReadMessage: latestMessage._id,
              lastReadMessageCreatedAt: latestMessage.createdAt,
              lastReadAt: new Date(),
            }
          : {
              lastReadMessage: null,
              lastReadMessageCreatedAt: null,
              lastReadAt: null,
            };

        try {
          state = await WorkspaceReadState.findOneAndUpdate(
            { user: req.user._id, workspace: workspaceId },
            { $setOnInsert: initFields },
            { upsert: true, new: true }
          );
        } catch (error) {
          if (error.code === 11000) {
            state = await WorkspaceReadState.findOne({
              user: req.user._id,
              workspace: workspaceId,
            });
          } else {
            throw error;
          }
        }
      }

      const hasCheckpoint = Boolean(
        state?.lastReadMessage && state?.lastReadMessageCreatedAt
      );

      const missedFilter = hasCheckpoint
        ? {
            workspace: workspaceId,
            $or: [
              { createdAt: { $gt: state.lastReadMessageCreatedAt } },
              {
                createdAt: state.lastReadMessageCreatedAt,
                _id: { $gt: state.lastReadMessage },
              },
            ],
          }
        : { workspace: workspaceId };

      totalEligibleMessages = await Message.countDocuments(missedFilter);

      messages = await Message.find(missedFilter)
        .populate("sender", "name")
        .sort({ createdAt: 1, _id: 1 })
        .limit(maxMessages);
    } else if (scope === "recent") {
      totalEligibleMessages = await Message.countDocuments({
        workspace: workspaceId,
      });

      const newestMessages = await Message.find({
        workspace: workspaceId,
      })
        .populate("sender", "name")
        .sort({ createdAt: -1, _id: -1 })
        .limit(maxMessages);

      // Restore canonical chronological order (createdAt ASC, _id ASC)
      messages = newestMessages.reverse();
    } else if (scope === "overview") {
      totalEligibleMessages = await Message.countDocuments({
        workspace: workspaceId,
      });

      if (totalEligibleMessages <= maxMessages) {
        messages = await Message.find({
          workspace: workspaceId,
        })
          .populate("sender", "name")
          .sort({ createdAt: 1, _id: 1 });
      } else {
        // If workspace history exceeds maxMessages cap, fetch the LATEST maxMessages and reverse into chronological order
        const newestMessages = await Message.find({
          workspace: workspaceId,
        })
          .populate("sender", "name")
          .sort({ createdAt: -1, _id: -1 })
          .limit(maxMessages);

        messages = newestMessages.reverse();
      }
    }

    // 0-message early return: Do NOT call AI provider and do NOT consume rate limit
    if (messages.length === 0) {
      const emptySummary = await generateWorkspaceSummary({
        messages: [],
        scope,
        totalEligibleMessages: 0,
      });

      res.set("Cache-Control", "no-store");
      return res.status(200).json(emptySummary);
    }

    // Enforce user-level rate limit for requests with messages using user's plan limit
    const rateLimitCheck = await checkAndIncrementAiRateLimit(
      req.user._id,
      requestsPerWindow
    );

    if (!rateLimitCheck.allowed) {
      res.set(
        "Retry-After",
        rateLimitCheck.retryAfterSeconds.toString()
      );

      return res.status(429).json({
        message: `AI summary rate limit exceeded. You can make up to ${requestsPerWindow} summary requests per ${windowMinutes} minutes.`,
        code: "RATE_LIMIT_EXCEEDED",
        retryAfterSeconds: rateLimitCheck.retryAfterSeconds,
      });
    }

    const summaryResult = await generateWorkspaceSummary({
      messages,
      scope,
      totalEligibleMessages,
      overrideConfig: {
        ...getAiConfig(),
        maxMessages,
        maxChars,
      },
    });

    res.set("Cache-Control", "no-store");
    return res.status(200).json(summaryResult);
  } catch (error) {
    if (error instanceof AiProviderError) {
      res.set("Cache-Control", "no-store");
      return res.status(error.status).json({
        message: error.message,
        code: error.code,
      });
    }

    res.set("Cache-Control", "no-store");
    return res.status(500).json({
      message: "An unexpected error occurred while generating the summary.",
    });
  }
};
