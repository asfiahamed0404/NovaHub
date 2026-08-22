import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    messageType: {
      type: String,
      enum: ["text", "file"],
      default: "text",
    },

    fileUrl: {
      type: String,
      default: "",
    },

    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound index for canonical workspace message ordering.
// Supports: latest-message lookup, missedCount calculation,
// and future Catch Me Up range queries.
// Canonical order: (workspace, createdAt ASC, _id ASC)
messageSchema.index(
  { workspace: 1, createdAt: 1, _id: 1 },
  { name: "workspace_createdAt_id" }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;