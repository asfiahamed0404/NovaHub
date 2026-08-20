import {
  createHash,
  randomBytes,
} from "node:crypto";

const INVITATION_TOKEN_BYTES = 32;
const INVITATION_TOKEN_LENGTH = 43;
const INVITATION_TOKEN_PATTERN =
  /^[A-Za-z0-9_-]{43}$/;

const DEFAULT_INVITE_EXPIRY_HOURS = 24;
const MIN_INVITE_EXPIRY_HOURS = 1;
const MAX_INVITE_EXPIRY_HOURS = 168;

export const generateInvitationToken = () =>
  randomBytes(INVITATION_TOKEN_BYTES).toString(
    "base64url"
  );

export const isValidInvitationToken = (token) => {
  if (
    typeof token !== "string" ||
    token.length !== INVITATION_TOKEN_LENGTH ||
    !INVITATION_TOKEN_PATTERN.test(token)
  ) {
    return false;
  }

  const decodedToken = Buffer.from(
    token,
    "base64url"
  );

  return (
    decodedToken.length === INVITATION_TOKEN_BYTES &&
    decodedToken.toString("base64url") === token
  );
};

export const hashInvitationToken = (token) =>
  createHash("sha256")
    .update(token, "utf8")
    .digest("hex");

export const getInviteExpiryHours = () => {
  const configuredValue =
    process.env.INVITE_EXPIRY_HOURS;

  if (typeof configuredValue !== "string") {
    return DEFAULT_INVITE_EXPIRY_HOURS;
  }

  const trimmedValue = configuredValue.trim();

  if (!/^\d+$/.test(trimmedValue)) {
    return DEFAULT_INVITE_EXPIRY_HOURS;
  }

  const parsedValue = Number(trimmedValue);

  if (
    !Number.isSafeInteger(parsedValue) ||
    parsedValue < MIN_INVITE_EXPIRY_HOURS ||
    parsedValue > MAX_INVITE_EXPIRY_HOURS
  ) {
    return DEFAULT_INVITE_EXPIRY_HOURS;
  }

  return parsedValue;
};

export const createInvitationExpiry = (
  now = new Date()
) =>
  new Date(
    now.getTime() +
      getInviteExpiryHours() * 60 * 60 * 1000
  );
