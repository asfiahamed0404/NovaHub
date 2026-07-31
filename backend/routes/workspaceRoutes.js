import express from "express";

import {createWorkspace,getMyWorkspaces,} from "../controllers/workspaceController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createWorkspace);
router.get("/", protect, getMyWorkspaces);

export default router;