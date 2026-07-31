import express from "express";

import {createWorkspace,getMyWorkspaces,getWorkspaceById,joinWorkspace,leaveWorkspace} from "../controllers/workspaceController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createWorkspace);
router.get("/", protect, getMyWorkspaces);
router.get("/:id", protect, getWorkspaceById);
router.post("/:id/join", protect, joinWorkspace);
router.delete("/:id/leave", protect, leaveWorkspace);

export default router;