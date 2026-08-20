import express from "express";

import {
  acceptInvitation,
  getInvitation,
} from "../controllers/invitationController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:token", getInvitation);
router.post("/:token/accept", protect, acceptInvitation);

export default router;
