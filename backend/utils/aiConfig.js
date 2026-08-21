const readBoundedInteger = (environmentVariable, defaultValue, minimum, maximum) => {
  const configuredValue = process.env[environmentVariable];

  if (typeof configuredValue !== "string") {
    return defaultValue;
  }

  const trimmedValue = configuredValue.trim();

  if (!/^\d+$/.test(trimmedValue)) {
    return defaultValue;
  }

  const parsedValue = Number(trimmedValue);

  if (
    !Number.isSafeInteger(parsedValue) ||
    parsedValue < minimum ||
    parsedValue > maximum
  ) {
    return defaultValue;
  }

  return parsedValue;
};

export const getAiConfig = () => {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || "";
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim() || "";
  const model =
    process.env.CLOUDFLARE_AI_MODEL?.trim() ||
    "@cf/qwen/qwen3-30b-a3b-fp8";

  const rateLimitWindowMinutes = readBoundedInteger(
    "AI_SUMMARY_RATE_LIMIT_WINDOW_MINUTES",
    60,
    1,
    1440
  );

  const timeoutMs = readBoundedInteger(
    "AI_PROVIDER_TIMEOUT_MS",
    20000,
    1000,
    120000
  );

  // Free tier config precedence: AI_FREE_SUMMARY_* -> legacy AI_SUMMARY_* -> default
  const legacyRateLimitMax = readBoundedInteger(
    "AI_SUMMARY_RATE_LIMIT_MAX",
    5,
    1,
    1000
  );
  const freeRateLimitMax = readBoundedInteger(
    "AI_FREE_SUMMARY_RATE_LIMIT_MAX",
    legacyRateLimitMax,
    1,
    1000
  );

  const legacyMaxMessages = readBoundedInteger(
    "AI_SUMMARY_MAX_MESSAGES",
    100,
    1,
    1000
  );
  const freeMaxMessages = readBoundedInteger(
    "AI_FREE_SUMMARY_MAX_MESSAGES",
    legacyMaxMessages,
    1,
    1000
  );

  const legacyMaxChars = readBoundedInteger(
    "AI_SUMMARY_MAX_CHARS",
    18000,
    100,
    500000
  );
  const freeMaxChars = readBoundedInteger(
    "AI_FREE_SUMMARY_MAX_CHARS",
    legacyMaxChars,
    100,
    500000
  );

  // Premium tier config
  const premiumRateLimitMax = readBoundedInteger(
    "AI_PREMIUM_SUMMARY_RATE_LIMIT_MAX",
    50,
    1,
    1000
  );
  const premiumMaxMessages = readBoundedInteger(
    "AI_PREMIUM_SUMMARY_MAX_MESSAGES",
    1000,
    1,
    5000
  );
  const premiumMaxChars = readBoundedInteger(
    "AI_PREMIUM_SUMMARY_MAX_CHARS",
    60000,
    100,
    500000
  );

  return {
    accountId,
    apiToken,
    model,
    rateLimitWindowMinutes,
    timeoutMs,
    // Free limits
    freeRateLimitMax,
    freeMaxMessages,
    freeMaxChars,
    // Premium limits
    premiumRateLimitMax,
    premiumMaxMessages,
    premiumMaxChars,
    // Legacy properties for backward compatibility
    rateLimitMax: freeRateLimitMax,
    maxMessages: freeMaxMessages,
    maxChars: freeMaxChars,
  };
};
