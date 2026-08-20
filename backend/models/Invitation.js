import mongoose from "mongoose";

export const INVITATION_STATUSES = Object.freeze({
  ACTIVE: "active",
  USED: "used",
  EXPIRED: "expired",
  REVOKED: "revoked",
});

export const deriveInvitationStatus = (
  invitation,
  now = new Date()
) => {
  if (invitation.usedAt) {
    return INVITATION_STATUSES.USED;
  }

  if (invitation.revokedAt) {
    return INVITATION_STATUSES.REVOKED;
  }

  if (invitation.expiresAt.getTime() <= now.getTime()) {
    return INVITATION_STATUSES.EXPIRED;
  }

  return INVITATION_STATUSES.ACTIVE;
};

const invitationSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      immutable: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      select: false,
      minlength: 64,
      maxlength: 64,
      match: /^[a-f0-9]{64}$/,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      immutable: true,
      index: true,
    },

    usedAt: {
      type: Date,
      default: null,
    },

    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

invitationSchema.virtual("status").get(function () {
  return deriveInvitationStatus(this);
});

const Invitation = mongoose.model(
  "Invitation",
  invitationSchema
);

export default Invitation;
