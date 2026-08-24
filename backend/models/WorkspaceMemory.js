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
