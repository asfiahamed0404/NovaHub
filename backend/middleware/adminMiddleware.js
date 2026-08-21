/**
 * Middleware requiring platform admin role.
 * Must run AFTER authentication protect middleware (req.user must be populated).
 */
export const requirePlatformAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Not authorized. Authentication required.",
    });
  }

  const role = req.user.role || "user";

  if (role !== "admin") {
    return res.status(403).json({
      message: "Access denied. Platform admin privileges required.",
    });
  }

  next();
};

export default requirePlatformAdmin;
