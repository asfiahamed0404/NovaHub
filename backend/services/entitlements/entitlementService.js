import { getAiConfig } from "../../utils/aiConfig.js";

/**
 * Returns entitlement capabilities and limits for a plan string.
 *
 * @param {string} plan - "free" | "premium"
 * @returns {object} Entitlements object containing aiSummary properties
 */
export const getEntitlementsForPlan = (plan) => {
  const normalizedPlan =
    typeof plan === "string" && plan.toLowerCase() === "premium"
      ? "premium"
      : "free";

  const config = getAiConfig();

  if (normalizedPlan === "premium") {
    return {
      plan: "premium",
      aiSummary: {
        enabled: true,
        requestsPerWindow: config.premiumRateLimitMax,
        windowMinutes: config.rateLimitWindowMinutes,
        maxMessages: config.premiumMaxMessages,
        maxChars: config.premiumMaxChars,
        fullHistory: false,
      },
    };
  }

  return {
    plan: "free",
    aiSummary: {
      enabled: true,
      requestsPerWindow: config.freeRateLimitMax,
      windowMinutes: config.rateLimitWindowMinutes,
      maxMessages: config.freeMaxMessages,
      maxChars: config.freeMaxChars,
      fullHistory: false,
    },
  };
};

/**
 * Returns entitlement capabilities and limits for a User document or plain object.
 *
 * @param {object} user - User document or object with plan property
 * @returns {object} Entitlements object
 */
export const getEntitlementsForUser = (user) => {
  const plan = user?.plan || "free";
  return getEntitlementsForPlan(plan);
};
