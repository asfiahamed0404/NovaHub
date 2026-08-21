import mongoose from "mongoose";

import Message from "../models/Message.js";
import Workspace from "../models/Workspace.js";
import WorkspaceReadState from "../models/WorkspaceReadState.js";
import AiUsageRateLimit from "../models/AiUsageRateLimit.js";
import { getAiConfig } from "../utils/aiConfig.js";
import {
  generateWorkspaceSummary,
  AiProviderError,
} from "../services/ai/aiService.js";

const VALID_SCOPES = new Set(["missed", "recent", "overview"]);

/**
 * Enforce MongoDB-backed user-level rate limit across all workspaces.
 * Limit: 60-minute request window anchored at first request.
 * Returns retryAfterSeconds if rate limit is exceeded.
 */
const checkAndIncrementAiRateLimit = async (userId) => {
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
          requestCount: { $lt: config.rateLimitMax },
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
      // If window is still active, limit is exceeded
      if (currentLock.windowStartedAt.getTime() > windowStartCutoff.getTime()) {
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
 * POST /api/workspaces/:workspaceId/ai/summary
 *
 * Generates an AI summary for a workspace according to scope ("missed" | "recent" | "overview").
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

    const config = getAiConfig();
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

      if (state?.lastReadMessage && state?.lastReadMessageCreatedAt) {
        const missedFilter = {
          workspace: workspaceId,
          $or: [
            { createdAt: { $gt: state.lastReadMessageCreatedAt } },
            {
              createdAt: state.lastReadMessageCreatedAt,
              _id: { $gt: state.lastReadMessage },
            },
          ],
        };

        totalEligibleMessages = await Message.countDocuments(missedFilter);

        messages = await Message.find(missedFilter)
          .populate("sender", "name")
          .sort({ createdAt: 1, _id: 1 })
          .limit(config.maxMessages);
      } else {
        totalEligibleMessages = 0;
        messages = [];
      }
    } else if (scope === "recent") {
      totalEligibleMessages = await Message.countDocuments({
        workspace: workspaceId,
      });

      const newestMessages = await Message.find({
        workspace: workspaceId,
      })
        .populate("sender", "name")
        .sort({ createdAt: -1, _id: -1 })
        .limit(config.maxMessages);

      // Restore canonical chronological order (createdAt ASC, _id ASC)
      messages = newestMessages.reverse();
    } else if (scope === "overview") {
      totalEligibleMessages = await Message.countDocuments({
        workspace: workspaceId,
      });

      if (totalEligibleMessages <= config.maxMessages) {
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
          .limit(config.maxMessages);

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

    // Enforce user-level rate limit for requests with messages
    const rateLimitCheck = await checkAndIncrementAiRateLimit(
      req.user._id
    );

    if (!rateLimitCheck.allowed) {
      res.set(
        "Retry-After",
        rateLimitCheck.retryAfterSeconds.toString()
      );

      return res.status(429).json({
        message: `AI summary rate limit exceeded. You can make up to ${config.rateLimitMax} summary requests per ${config.rateLimitWindowMinutes} minutes.`,
        code: "RATE_LIMIT_EXCEEDED",
        retryAfterSeconds: rateLimitCheck.retryAfterSeconds,
      });
    }

    const summaryResult = await generateWorkspaceSummary({
      messages,
      scope,
      totalEligibleMessages,
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
