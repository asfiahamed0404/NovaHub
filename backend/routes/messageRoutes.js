import express from "express";

import {
  sendMessage,
} from "../controllers/messageController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router({ mergeParams: true });

router.post("/", protect, sendMessage);

export default router;