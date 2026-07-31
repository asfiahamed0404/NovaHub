import express from "express";

import {sendMessage,getWorkspaceMessages,} from "../controllers/messageController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router({ mergeParams: true });

router.post("/", protect, sendMessage);
router.get("/", protect, getWorkspaceMessages);

export default router;