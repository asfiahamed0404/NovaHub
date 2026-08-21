import express from "express";

import { getWorkspaceAiSummary } from "../controllers/aiController.js";
import protect from "../middleware/authMiddleware.js";

// mergeParams: true exposes :workspaceId from the parent router in app.js
const router = express.Router({ mergeParams: true });

router.post("/summary", protect, getWorkspaceAiSummary);

export default router;
