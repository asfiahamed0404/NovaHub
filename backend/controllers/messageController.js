import mongoose from "mongoose";

import Message from "../models/Message.js";
import Workspace from "../models/Workspace.js";

export const sendMessage = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { content } = req.body;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({
        message: "Invalid workspace ID.",
      });
    }

    if (
      typeof content !== "string" ||
      content.trim().length === 0
    ) {
      return res.status(400).json({
        message: "Message content is required.",
      });
    }

    if (content.trim().length > 2000) {
      return res.status(400).json({
        message: "Message cannot be more than 2000 characters.",
      });
    }

    const workspace = await Workspace.findById(workspaceId);

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
        message: "Only workspace members can send messages.",
      });
    }

    const chatMessage = await Message.create({
      workspace: workspace._id,
      sender: req.user._id,
      content: content.trim(),
      messageType: "text",
      readBy: [req.user._id],
    });

    await chatMessage.populate(
      "sender",
      "name email avatar status"
    );

    res.status(201).json({
      message: "Message sent successfully",
      chatMessage,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};