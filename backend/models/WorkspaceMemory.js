import mongoose from "mongoose";

const workspaceMemorySchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },

    type: {
      type: String,
      enum: ["fact", "decision", "task", "note"],
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },

    sourceMessageIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Message",
        },
      ],
      default: [],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    importance: {
      type: String,
      enum: ["low", "normal", "high"],
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
