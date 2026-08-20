const CONFIGURATION_RULES = Object.freeze({
  creationRateLimitMax: {
    environmentVariable:
      "INVITE_CREATION_RATE_LIMIT_MAX",
    defaultValue: 10,
    minimum: 1,
    maximum: 1000,
  },
  creationRateLimitWindowMinutes: {
    environmentVariable:
      "INVITE_CREATION_RATE_LIMIT_WINDOW_MINUTES",
    defaultValue: 15,
    minimum: 1,
    maximum: 1440,
  },
  maxActivePerMember: {
    environmentVariable:
      "INVITE_MAX_ACTIVE_PER_MEMBER",
    defaultValue: 10,
    minimum: 1,
    maximum: 1000,
  },
  maxActivePerWorkspace: {
    environmentVariable:
      "INVITE_MAX_ACTIVE_PER_WORKSPACE",
    defaultValue: 100,
    minimum: 1,
    maximum: 10000,
  },
});

const readBoundedInteger = ({
  environmentVariable,
  defaultValue,
  minimum,
  maximum,
}) => {
  const configuredValue =
    process.env[environmentVariable];

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

export const getInvitationAbuseConfig = () =>
  Object.fromEntries(
    Object.entries(CONFIGURATION_RULES).map(
      ([configurationKey, rule]) => [
        configurationKey,
        readBoundedInteger(rule),
      ]
    )
  );

export const INVITATION_ABUSE_CONFIG_DEFAULTS =
  Object.freeze(
    Object.fromEntries(
      Object.entries(CONFIGURATION_RULES).map(
        ([configurationKey, rule]) => [
          configurationKey,
          rule.defaultValue,
        ]
      )
    )
  );
