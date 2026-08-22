import mongoose from "mongoose";

import Message from "../models/Message.js";
import Workspace from "../models/Workspace.js";
import WorkspaceReadState from "../models/WorkspaceReadState.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when messageA is strictly AFTER messageB in canonical order:
 *   1. messageA.createdAt > messageB.createdAt, OR
 *   2. same createdAt AND messageA._id > messageB._id (ObjectId lexical order)
 *
 * Both arguments must have { _id, createdAt } populated.
 * When messageB checkpoint is null the incoming message is always newer.
 */
const isStrictlyAfter = (messageA, stateB) => {
  if (!stateB.lastReadMessage || !stateB.lastReadMessageCreatedAt) {
    return true;
  }

  const aTime = messageA.createdAt.getTime();
  const bTime = stateB.lastReadMessageCreatedAt.getTime();

  if (aTime !== bTime) {
    return aTime > bTime;
  }

  // Same timestamp: compare ObjectId strings (lexicographically equivalent
  // to ObjectId's natural sort order for the same-second range).
  return messageA._id.toString() > stateB.lastReadMessage.toString();
};

/**
 * The MongoDB filter that matches a WorkspaceReadState document whose
 * current checkpoint is strictly BEFORE the given message.
 * Used in the monotonic advance update to prevent regression.
 */
const checkpointIsBeforeFilter = (message) => ({
  $or: [
    { lastReadMessageCreatedAt: null },
    { lastReadMessageCreatedAt: { $lt: message.createdAt } },
    {
      lastReadMessageCreatedAt: message.createdAt,
      lastReadMessage: { $lt: message._id },
    },
  ],
});

/**
 * Lazily initialise a WorkspaceReadState document for (userId, workspaceId).
 *
 * Initialization rule:
 *   Set checkpoint to the workspace's current latest message.
 *   This means existing history is NOT treated as "missed" when the
 *   feature is first introduced for an existing member.
 *   For an empty workspace lastReadMessage is set to null.
 *
 * Handles concurrent initialization safely: if two requests race,
 * the duplicate-key error (11000) from the unique index is caught
 * and we fall back to a normal findOne.
 *
 * Returns the WorkspaceReadState document (always non-null on success).
 */
const lazyInitReadState = async (userId, workspaceId) => {
  // Find the latest message in the workspace using canonical ordering.
  const latestMessage = await Message.findOne({
    workspace: workspaceId,
  })
    .sort({ createdAt: -1, _id: -1 })
    .select("_id createdAt")
    .lean();

  const initFields = latestMessage
    ? {
        lastReadMessage: latestMessage._id,
        lastReadMessageCreatedAt: latestMessage.createdAt,
        lastReadAt: new Date(),
      }
    : {
        lastReadMessage: null,
        lastReadMessageCreatedAt: null,
        lastReadAt: null,
      };

  try {
    const state = await WorkspaceReadState.findOneAndUpdate(
      { user: userId, workspace: workspaceId },
      { $setOnInsert: initFields },
      { upsert: true, new: true }
    );

    return state;
  } catch (error) {
    // Duplicate-key: another concurrent request already inserted the document.
    if (error.code === 11000) {
      const state = await WorkspaceReadState.findOne({
        user: userId,
        workspace: workspaceId,
      });

      // Should not happen after a successful concurrent insert,
      // but guard against it defensively.
      if (!state) {
        throw new Error(
          "WorkspaceReadState could not be initialized."
        );
      }

      return state;
    }

    throw error;
  }
};

/**
 * Count workspace messages that are chronologically AFTER the given
 * checkpoint, using the canonical (createdAt ASC, _id ASC) ordering.
 *
 * When lastReadMessage is null (empty-workspace init), count all messages.
 */
const countMissedMessages = async (workspaceId, state) => {
  if (!state.lastReadMessage || !state.lastReadMessageCreatedAt) {
    return Message.countDocuments({ workspace: workspaceId });
  }

  return Message.countDocuments({
    workspace: workspaceId,
    $or: [
      {
        createdAt: { $gt: state.lastReadMessageCreatedAt },
      },
      {
        createdAt: state.lastReadMessageCreatedAt,
        _id: { $gt: state.lastReadMessage },
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/workspaces/:workspaceId/read-state
 *
 * Returns the current authenticated user's read checkpoint for the workspace.
 * Lazily initializes the state document on first access.
 *
 * Response: {
 *   lastReadMessageId,
 *   lastReadMessageCreatedAt,
 *   lastReadAt,
 *   latestMessageId,
 *   latestMessageCreatedAt,
 *   missedCount
 * }
 */
export const getWorkspaceReadState = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({
        message: "Invalid workspace ID.",
      });
    }

    const workspace = await Workspace.findById(workspaceId).select(
      "members"
    );

    if (!workspace) {
      return res.status(404).json({
        message: "Workspace not found.",
      });
    }

    const isMember = workspace.members.some(
      (memberId) =>
        memberId.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        message: "You are not a member of this workspace.",
      });
    }

    // Ensure a state document exists for this (user, workspace).
    let state = await WorkspaceReadState.findOne({
      user: req.user._id,
      workspace: workspaceId,
    });

    if (!state) {
      state = await lazyInitReadState(
        req.user._id,
        workspaceId
      );
    }

    // Find the workspace's current latest message.
    const latestMessage = await Message.findOne({
      workspace: workspaceId,
    })
      .sort({ createdAt: -1, _id: -1 })
      .select("_id createdAt")
      .lean();

    const missedCount = await countMissedMessages(
      workspaceId,
      state
    );

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      lastReadMessageId: state.lastReadMessage ?? null,
      lastReadMessageCreatedAt:
        state.lastReadMessageCreatedAt ?? null,
      lastReadAt: state.lastReadAt ?? null,
      latestMessageId: latestMessage?._id ?? null,
      latestMessageCreatedAt:
        latestMessage?.createdAt ?? null,
      missedCount,
    });
  } catch (error) {
    return res.status(500).json({
      message:
        "An unexpected error occurred while loading the read state.",
    });
  }
};

/**
 * PUT /api/workspaces/:workspaceId/read-state
 *
 * Advances the authenticated user's read checkpoint to the given messageId.
 * The checkpoint is MONOTONIC — it will never move backward.
 * An update that targets a message older than the current checkpoint
 * is silently ignored and the current checkpoint is returned unchanged.
 *
 * Request body: { "messageId": "<ObjectId>" }
 *
 * Response: {
 *   lastReadMessageId,
 *   lastReadMessageCreatedAt,
 *   lastReadAt
 * }
 */
export const advanceWorkspaceReadState = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { messageId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({
        message: "Invalid workspace ID.",
      });
    }

    if (
      typeof messageId !== "string" ||
      !mongoose.Types.ObjectId.isValid(messageId)
    ) {
      return res.status(400).json({
        message: "Invalid message ID.",
      });
    }

    const workspace = await Workspace.findById(workspaceId).select(
      "members"
    );

    if (!workspace) {
      return res.status(404).json({
        message: "Workspace not found.",
      });
    }

    const isMember = workspace.members.some(
      (memberId) =>
        memberId.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        message: "You are not a member of this workspace.",
      });
    }

    // Verify the message exists AND belongs to this workspace.
    const message = await Message.findOne({
      _id: messageId,
      workspace: workspaceId,
    })
      .select("_id createdAt")
      .lean();

    if (!message) {
      return res.status(404).json({
        message: "Message not found.",
      });
    }

    // Ensure a state document exists; initialize if needed.
    let state = await WorkspaceReadState.findOne({
      user: req.user._id,
      workspace: workspaceId,
    });

    if (!state) {
      state = await lazyInitReadState(
        req.user._id,
        workspaceId
      );
    }

    const now = new Date();

    // Only advance if the incoming message is strictly newer than the
    // current checkpoint.  The conditional query filter prevents regression
    // in concurrent updates — if another device has already advanced the
    // checkpoint past this message, the update will find no matching document
    // and we fall back to reading the current (already-newer) state.
    if (isStrictlyAfter(message, state)) {
      const updated = await WorkspaceReadState.findOneAndUpdate(
        {
          user: req.user._id,
          workspace: workspaceId,
          ...checkpointIsBeforeFilter(message),
        },
        {
          $set: {
            lastReadMessage: message._id,
            lastReadMessageCreatedAt: message.createdAt,
            lastReadAt: now,
          },
        },
        { new: true }
      );

      // If updated is null, a concurrent device raced ahead.
      // Reload the current (winning) state.
      if (updated) {
        state = updated;
      } else {
        state = await WorkspaceReadState.findOne({
          user: req.user._id,
          workspace: workspaceId,
        });
      }
    }
    // If not strictly after — message is same or older than current checkpoint.
    // Leave state unchanged and return current state.

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      lastReadMessageId: state.lastReadMessage ?? null,
      lastReadMessageCreatedAt:
        state.lastReadMessageCreatedAt ?? null,
      lastReadAt: state.lastReadAt ?? null,
    });
  } catch (error) {
    return res.status(500).json({
      message:
        "An unexpected error occurred while updating the read state.",
    });
  }
};
