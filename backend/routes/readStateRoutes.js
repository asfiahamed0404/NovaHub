import express from "express";

import {
  getWorkspaceReadState,
  advanceWorkspaceReadState,
} from "../controllers/readStateController.js";

import protect from "../middleware/authMiddleware.js";

// mergeParams: true exposes :workspaceId from the parent router
// (same pattern used by messageRoutes.js).
const router = express.Router({ mergeParams: true });

router.get("/", protect, getWorkspaceReadState);
router.put("/", protect, advanceWorkspaceReadState);

export default router;
