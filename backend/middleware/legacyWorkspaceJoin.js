export const isLegacyWorkspaceJoinEnabled = () =>
  process.env.ENABLE_LEGACY_WORKSPACE_JOIN
    ?.trim()
    .toLowerCase() === "true";

const requireLegacyWorkspaceJoinEnabled = (
  _req,
  res,
  next
) => {
  if (isLegacyWorkspaceJoinEnabled()) {
    return next();
  }

  return res.status(410).json({
    message:
      "Joining by workspace ID is disabled. Use a secure workspace invitation link.",
    code: "LEGACY_WORKSPACE_JOIN_DISABLED",
  });
};

export default requireLegacyWorkspaceJoinEnabled;
