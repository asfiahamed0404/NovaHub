import mongoose from "mongoose";

const aiUsageRateLimitSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    windowStartedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    requestCount: {
      type: Number,
      required: true,
      default: 1,
      min: 0,
    },

    expireAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index for automatic document expiration after window expires.
aiUsageRateLimitSchema.index(
  { expireAt: 1 },
  { expireAfterSeconds: 0, name: "expireAt_ttl" }
);

// Secondary index for user lookups.
aiUsageRateLimitSchema.index(
  { user: 1, windowStartedAt: 1 },
  { name: "user_window" }
);

const AiUsageRateLimit = mongoose.model(
  "AiUsageRateLimit",
  aiUsageRateLimitSchema
);

export default AiUsageRateLimit;
