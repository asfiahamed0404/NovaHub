import mongoose from "mongoose";

// A single document in this collection is updated inside every platform-admin
// demotion transaction. Touching the same document forces concurrent
// demotions to serialize, preventing write-skew from removing all admins.
const platformAdminRoleLockSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    revision: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    versionKey: false,
  }
);

const PlatformAdminRoleLock = mongoose.model(
  "PlatformAdminRoleLock",
  platformAdminRoleLockSchema
);

export default PlatformAdminRoleLock;

