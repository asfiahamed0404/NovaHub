const INVITATION_TOKEN_PATTERN = /^[A-Za-z\d_-]{43}$/;

function isValidInvitationToken(token) {
  return (
    typeof token === "string" &&
    INVITATION_TOKEN_PATTERN.test(token)
  );
}

function getInvitationPath(token) {
  return isValidInvitationToken(token)
    ? `/invite/${token}`
    : null;
}

function getSafeInvitationReturnPath(state) {
  if (!state || typeof state.from !== "string") {
    return null;
  }

  const match = state.from.match(/^\/invite\/([^/]+)$/);

  return match && isValidInvitationToken(match[1])
    ? state.from
    : null;
}

export {
  getInvitationPath,
  getSafeInvitationReturnPath,
  isValidInvitationToken,
};
