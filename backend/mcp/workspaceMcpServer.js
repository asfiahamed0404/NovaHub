import { McpServer } from "@modelcontextprotocol/server";
import mongoose from "mongoose";
import { z } from "zod";

import Message from "../models/Message.js";
import Workspace from "../models/Workspace.js";
import {
  getWorkspaceMemoryById,
  listWorkspaceMemories,
} from "../services/memory/workspaceMemoryService.js";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const MEMORY_TYPES = ["fact", "decision", "task", "note"];
const MEMORY_IMPORTANCE_LEVELS = ["low", "normal", "high"];

const READ_ONLY_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
});

const workspaceDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  createdAt: z.string(),
});

const messageDtoSchema = z.object({
  id: z.string(),
  senderId: z.string().nullable(),
  senderName: z.string().nullable(),
  content: z.string(),
  createdAt: z.string(),
});

const memoryDtoSchema = z.object({
  id: z.string(),
  type: z.enum(MEMORY_TYPES),
  content: z.string(),
  sourceMessageIds: z.array(z.string()),
  createdBy: z.string(),
  importance: z.enum(MEMORY_IMPORTANCE_LEVELS),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const toIsoString = (value) => new Date(value).toISOString();

const toWorkspaceDto = (workspace) => ({
  id: workspace._id.toString(),
  name: workspace.name,
  description: workspace.description || "",
  createdAt: toIsoString(workspace.createdAt),
});

const toMessageDto = (message) => ({
  id: message._id.toString(),
  senderId: message.sender?._id
    ? message.sender._id.toString()
    : null,
  senderName:
    typeof message.sender?.name === "string"
      ? message.sender.name
      : null,
  content: message.content,
  createdAt: toIsoString(message.createdAt),
});

const toMemoryDto = (memory) => ({
  id: memory._id.toString(),
  type: memory.type,
  content: memory.content,
  sourceMessageIds: memory.sourceMessageIds.map((id) =>
    id.toString()
  ),
  createdBy: memory.createdBy.toString(),
  importance: memory.importance,
  createdAt: toIsoString(memory.createdAt),
  updatedAt: toIsoString(memory.updatedAt),
});

const successResult = (text, structuredContent) => ({
  content: [{ type: "text", text }],
  structuredContent,
});

const errorResult = (message) => ({
  content: [{ type: "text", text: message }],
  isError: true,
});

const normalizeObjectId = (value, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new TypeError(
      `${fieldName} must be a valid MongoDB ObjectId.`
    );
  }

  return new mongoose.Types.ObjectId(value);
};

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Creates a read-only MCP server bound to one trusted workspace context.
 *
 * The caller must authenticate the user and verify workspace membership
 * before constructing this server. This factory validates identifier shape,
 * but it intentionally does not repeat public HTTP authentication or
 * workspace-membership authorization.
 */
export const createWorkspaceMcpServer = ({
  workspaceId,
  userId,
  role,
}) => {
  const trustedContext = Object.freeze({
    workspaceId: normalizeObjectId(workspaceId, "workspaceId"),
    userId: normalizeObjectId(userId, "userId"),
    role: role === undefined ? null : role,
  });

  if (
    trustedContext.role !== null &&
    typeof trustedContext.role !== "string"
  ) {
    throw new TypeError("role must be a string when provided.");
  }

  const server = new McpServer({
    name: "novahub-workspace",
    version: "1.0.0",
  });

  server.registerTool(
    "get_workspace_info",
    {
      description:
        "Get safe basic information about the authorized workspace.",
      inputSchema: z.object({}).strict(),
      outputSchema: z.object({
        workspace: workspaceDtoSchema,
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => {
      try {
        const workspace = await Workspace.findOne({
          _id: trustedContext.workspaceId,
        })
          .select("_id name description createdAt")
          .lean();

        if (!workspace) {
          return errorResult("Workspace not found.");
        }

        const structuredContent = {
          workspace: toWorkspaceDto(workspace),
        };

        return successResult(
          `Workspace: ${structuredContent.workspace.name}`,
          structuredContent
        );
      } catch {
        return errorResult("Unable to retrieve workspace information.");
      }
    }
  );

  server.registerTool(
    "get_recent_messages",
    {
      description:
        "Get recent messages from the authorized workspace in chronological order.",
      inputSchema: z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
        })
        .strict(),
      outputSchema: z.object({
        messages: z.array(messageDtoSchema),
        count: z.number().int(),
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ limit }) => {
      try {
        const messages = await Message.find({
          workspace: trustedContext.workspaceId,
        })
          .select("_id sender content createdAt")
          .populate("sender", "name")
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit)
          .lean();

        messages.reverse();

        const messageDtos = messages.map(toMessageDto);
        const structuredContent = {
          messages: messageDtos,
          count: messageDtos.length,
        };

        return successResult(
          `Retrieved ${messageDtos.length} recent workspace messages.`,
          structuredContent
        );
      } catch {
        return errorResult("Unable to retrieve recent messages.");
      }
    }
  );

  server.registerTool(
    "search_workspace_messages",
    {
      description:
        "Search message text in the authorized workspace using a literal lexical query.",
      inputSchema: z
        .object({
          query: z.string().trim().min(1).max(200),
          limit: z.number().int().min(1).max(20).default(10),
        })
        .strict(),
      outputSchema: z.object({
        query: z.string(),
        messages: z.array(messageDtoSchema),
        count: z.number().int(),
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ query, limit }) => {
      try {
        const escapedQuery = escapeRegex(query);
        const messages = await Message.find({
          workspace: trustedContext.workspaceId,
          content: {
            $regex: escapedQuery,
            $options: "i",
          },
        })
          .select("_id sender content createdAt")
          .populate("sender", "name")
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit)
          .lean();

        messages.reverse();

        const messageDtos = messages.map(toMessageDto);
        const structuredContent = {
          query,
          messages: messageDtos,
          count: messageDtos.length,
        };

        return successResult(
          `Found ${messageDtos.length} matching workspace messages.`,
          structuredContent
        );
      } catch {
        return errorResult("Unable to search workspace messages.");
      }
    }
  );

  server.registerTool(
    "list_workspace_memories",
    {
      description:
        "List durable memories from the authorized workspace with optional filters.",
      inputSchema: z
        .object({
          type: z.enum(MEMORY_TYPES).optional(),
          importance: z
            .enum(MEMORY_IMPORTANCE_LEVELS)
            .optional(),
          limit: z.number().int().min(1).max(50).default(20),
        })
        .strict(),
      outputSchema: z.object({
        memories: z.array(memoryDtoSchema),
        count: z.number().int(),
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ type, importance, limit }) => {
      try {
        const memories = await listWorkspaceMemories({
          workspaceId: trustedContext.workspaceId,
          type,
          importance,
          limit,
        });

        const memoryDtos = memories.map(toMemoryDto);
        const structuredContent = {
          memories: memoryDtos,
          count: memoryDtos.length,
        };

        return successResult(
          `Retrieved ${memoryDtos.length} workspace memories.`,
          structuredContent
        );
      } catch {
        return errorResult("Unable to retrieve workspace memories.");
      }
    }
  );

  server.registerTool(
    "get_workspace_memory",
    {
      description:
        "Get one durable memory by ID from the authorized workspace.",
      inputSchema: z
        .object({
          memoryId: z
            .string()
            .regex(
              OBJECT_ID_PATTERN,
              "memoryId must be a valid MongoDB ObjectId."
            ),
        })
        .strict(),
      outputSchema: z.object({
        found: z.boolean(),
        memory: memoryDtoSchema.nullable(),
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ memoryId }) => {
      try {
        const memory = await getWorkspaceMemoryById({
          workspaceId: trustedContext.workspaceId,
          memoryId,
        });

        if (!memory) {
          return successResult("Workspace memory not found.", {
            found: false,
            memory: null,
          });
        }

        const memoryDto = toMemoryDto(memory);

        return successResult("Workspace memory found.", {
          found: true,
          memory: memoryDto,
        });
      } catch {
        return errorResult("Unable to retrieve workspace memory.");
      }
    }
  );

  return server;
};
