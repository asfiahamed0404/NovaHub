import mongoose from "mongoose";

export const WORKSPACE_MEMORY_TYPES = Object.freeze([
  "fact",
  "decision",
  "task",
  "note",
]);
export const WORKSPACE_MEMORY_IMPORTANCE_LEVELS = Object.freeze([
  "low",
  "normal",
  "high",
]);
export const MAX_WORKSPACE_MEMORY_CONTENT_CHARS = 4000;
export const MAX_WORKSPACE_MEMORY_SOURCE_MESSAGES = 20;

export const normalizeWorkspaceMemoryContent = (content) =>
  typeof content === "string"
    ? content.trim().replace(/\s+/gu, " ").toLowerCase()
    : "";

const workspaceMemorySchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },

    type: {
      type: String,
      enum: WORKSPACE_MEMORY_TYPES,
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_WORKSPACE_MEMORY_CONTENT_CHARS,
    },

    // Internal canonical value used only for conservative exact duplicate
    // detection. Existing records can remain without it until they are
    // otherwise saved; the service has a scoped compatibility lookup.
    normalizedContent: {
      type: String,
      select: false,
    },

    sourceMessageIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Message",
        },
      ],
      default: [],
      validate: {
        validator: (sourceIds) =>
          sourceIds.length <= MAX_WORKSPACE_MEMORY_SOURCE_MESSAGES,
        message: `A workspace memory can reference at most ${MAX_WORKSPACE_MEMORY_SOURCE_MESSAGES} source messages.`,
      },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    importance: {
      type: String,
      enum: WORKSPACE_MEMORY_IMPORTANCE_LEVELS,
      default: "normal",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

workspaceMemorySchema.pre("validate", function setNormalizedContent() {
  const normalizedContent = normalizeWorkspaceMemoryContent(
    this.content
  );

  this.normalizedContent = normalizedContent || undefined;
});

// The canonical key makes approved saves idempotent under concurrent requests
// while preserving independent memories across workspaces and memory types.
workspaceMemorySchema.index(
  { workspace: 1, type: 1, normalizedContent: 1 },
  {
    name: "workspace_type_normalized_content_unique",
    unique: true,
    partialFilterExpression: {
      normalizedContent: { $type: "string" },
    },
  }
);

// Supports listing all memories in a workspace from newest to oldest.
workspaceMemorySchema.index(
  { workspace: 1, createdAt: -1, _id: -1 },
  { name: "workspace_createdAt_id" }
);

// Supports the same chronological listing when filtered by memory type.
workspaceMemorySchema.index(
  { workspace: 1, type: 1, createdAt: -1, _id: -1 },
  { name: "workspace_type_createdAt_id" }
);

const WorkspaceMemory = mongoose.model(
  "WorkspaceMemory",
  workspaceMemorySchema
);

export default WorkspaceMemory;
