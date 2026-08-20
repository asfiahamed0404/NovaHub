import express from "express";

import {createWorkspace,getMyWorkspaces,getWorkspaceById,joinWorkspace,leaveWorkspace} from "../controllers/workspaceController.js";
import {
  createInvitation,
  listWorkspaceInvitations,
  revokeInvitation,
} from "../controllers/invitationController.js";

import protect from "../middleware/authMiddleware.js";
import requireLegacyWorkspaceJoinEnabled from "../middleware/legacyWorkspaceJoin.js";

const router = express.Router();

router.post("/", protect, createWorkspace);
router.get("/", protect, getMyWorkspaces);
router.get("/:id", protect, getWorkspaceById);
router.post(
  "/:id/join",
  protect,
  requireLegacyWorkspaceJoinEnabled,
  joinWorkspace
);
router.delete("/:id/leave", protect, leaveWorkspace);
router.post(
  "/:workspaceId/invitations",
  protect,
  createInvitation
);
router.get(
  "/:workspaceId/invitations",
  protect,
  listWorkspaceInvitations
);
router.patch(
  "/:workspaceId/invitations/:invitationId/revoke",
  protect,
  revokeInvitation
);

export default router;
