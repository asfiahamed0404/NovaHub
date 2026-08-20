import mongoose from "mongoose";

const invitationCreationLockSchema =
  new mongoose.Schema(
    {
      _id: {
        type: String,
      },

      workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace",
        required: true,
        immutable: true,
      },

      member: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        immutable: true,
      },

      version: {
        type: Number,
        default: 0,
        min: 0,
      },

      rateWindowStartedAt: {
        type: Date,
        required: true,
        default: Date.now,
      },

      rateCount: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },
    },
    {
      timestamps: true,
    }
  );

const InvitationCreationLock = mongoose.model(
  "InvitationCreationLock",
  invitationCreationLockSchema
);

export default InvitationCreationLock;
