import mongoose from "mongoose";

const workspaceReadStateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },

    // ObjectId of the last message the user has read.
    // null means the checkpoint has never been set
    // (e.g. an empty workspace at initialization time).
    lastReadMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    // createdAt of lastReadMessage, stored redundantly so
    // range queries can use the canonical (createdAt, _id)
    // compound index without a join.
    lastReadMessageCreatedAt: {
      type: Date,
      default: null,
    },

    // Wall-clock time when the checkpoint was last advanced.
    lastReadAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: exactly one read-state document
// per (user, workspace) pair.  Also serves as the lookup
// index for every read-state query.
workspaceReadStateSchema.index(
  { user: 1, workspace: 1 },
  { unique: true, name: "user_workspace_unique" }
);

const WorkspaceReadState = mongoose.model(
  "WorkspaceReadState",
  workspaceReadStateSchema
);

export default WorkspaceReadState;
