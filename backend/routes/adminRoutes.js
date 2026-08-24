import express from "express";

import {
  deleteAdminMemory,
  getAdminDashboard,
  getAdminUser,
  getAdminWorkspace,
  listAdminAiUsage,
  listAdminMemories,
  listAdminUsers,
  listAdminWorkspaces,
  updateAdminUser,
} from "../controllers/adminController.js";
import requirePlatformAdmin from "../middleware/adminMiddleware.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.use(protect, requirePlatformAdmin);

router.get("/dashboard", getAdminDashboard);

router.get("/users", listAdminUsers);
router.get("/users/:userId", getAdminUser);
router.patch("/users/:userId", updateAdminUser);

router.get("/workspaces", listAdminWorkspaces);
router.get("/workspaces/:workspaceId", getAdminWorkspace);

router.get("/ai-usage", listAdminAiUsage);

router.get("/memories", listAdminMemories);
router.delete("/memories/:memoryId", deleteAdminMemory);

router.use((_req, res) =>
  res.status(404).json({
    message: "Admin route not found.",
    code: "ADMIN_ROUTE_NOT_FOUND",
  })
);

export default router;
