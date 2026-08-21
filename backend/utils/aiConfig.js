const CONFIGURATION_RULES = Object.freeze({
  rateLimitMax: {
    environmentVariable: "AI_SUMMARY_RATE_LIMIT_MAX",
    defaultValue: 5,
    minimum: 1,
    maximum: 1000,
  },
  rateLimitWindowMinutes: {
    environmentVariable: "AI_SUMMARY_RATE_LIMIT_WINDOW_MINUTES",
    defaultValue: 60,
    minimum: 1,
    maximum: 1440,
  },
  maxMessages: {
    environmentVariable: "AI_SUMMARY_MAX_MESSAGES",
    defaultValue: 100,
    minimum: 1,
    maximum: 1000,
  },
  maxChars: {
    environmentVariable: "AI_SUMMARY_MAX_CHARS",
    defaultValue: 18000,
    minimum: 100,
    maximum: 500000,
  },
  timeoutMs: {
    environmentVariable: "AI_PROVIDER_TIMEOUT_MS",
    defaultValue: 20000,
    minimum: 1000,
    maximum: 120000,
  },
});

const readBoundedInteger = ({
  environmentVariable,
  defaultValue,
  minimum,
  maximum,
}) => {
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

  const boundedConfig = Object.fromEntries(
    Object.entries(CONFIGURATION_RULES).map(
      ([configurationKey, rule]) => [
        configurationKey,
        readBoundedInteger(rule),
      ]
    )
  );

  return {
    accountId,
    apiToken,
    model,
    ...boundedConfig,
  };
};
