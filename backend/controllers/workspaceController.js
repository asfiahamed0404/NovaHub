import Workspace from "../models/Workspace.js";
import mongoose from "mongoose";

export const createWorkspace = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (
      typeof name !== "string" ||
      name.trim().length < 2
    ) {
      return res.status(400).json({
        message: "Workspace name must contain at least 2 characters.",
      });
    }

    const workspace = await Workspace.create({
      name: name.trim(),
      description:
        typeof description === "string"
          ? description.trim()
          : "",
      createdBy: req.user._id,
      members: [req.user._id],
    });

    res.status(201).json({
      message: "Workspace created successfully",
      workspace,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getMyWorkspaces = async (req, res) => {
  try {
    const workspaces = await Workspace.find({
      members: req.user._id,
    })
      .populate("createdBy", "name email avatar status")
      .populate("members", "name email avatar status")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      count: workspaces.length,
      workspaces,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getWorkspaceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid workspace ID.",
      });
    }

    const workspace = await Workspace.findById(id);

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
        message: "You are not allowed to access this workspace.",
      });
    }

    await workspace.populate(
      "createdBy",
      "name email avatar status"
    );

    await workspace.populate(
      "members",
      "name email avatar status"
    );

    res.status(200).json({
      workspace,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const joinWorkspace = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid workspace ID.",
      });
    }

    const workspace = await Workspace.findById(id);

    if (!workspace) {
      return res.status(404).json({
        message: "Workspace not found.",
      });
    }

    const isAlreadyMember = workspace.members.some(
      (memberId) =>
        memberId.toString() === req.user._id.toString()
    );

    if (isAlreadyMember) {
      return res.status(400).json({
        message: "You are already a member of this workspace.",
      });
    }

    workspace.members.push(req.user._id);

    await workspace.save();

    await workspace.populate(
      "createdBy",
      "name email avatar status"
    );

    await workspace.populate(
      "members",
      "name email avatar status"
    );

    const io = req.app.get("io");

    io.to(id).emit(
      "workspace_updated",
      workspace
    );

    res.status(200).json({
      message: "Joined workspace successfully",
      workspace,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const leaveWorkspace = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid workspace ID.",
      });
    }

    const workspace = await Workspace.findById(id);

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

    const isCreator =
      workspace.createdBy.toString() === req.user._id.toString();

    if (isCreator) {
      return res.status(400).json({
        message:
          "Workspace creator cannot leave the workspace. Transfer ownership or delete the workspace instead.",
      });
    }

    workspace.members = workspace.members.filter(
      (memberId) =>
        memberId.toString() !== req.user._id.toString()
    );

    await workspace.save();

    await workspace.populate(
      "createdBy",
      "name email avatar status"
    );

    await workspace.populate(
      "members",
      "name email avatar status"
    );

    const io = req.app.get("io");

    io.to(id).emit(
      "workspace_updated",
      workspace
    );

    res.status(200).json({
      message: "Left workspace successfully",
      workspace,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};