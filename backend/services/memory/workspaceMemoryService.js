import WorkspaceMemory from "../../models/WorkspaceMemory.js";

export const createWorkspaceMemory = ({
  workspaceId,
  type,
  content,
  sourceMessageIds,
  createdBy,
  importance,
}) =>
  WorkspaceMemory.create({
    workspace: workspaceId,
    type,
    content,
    sourceMessageIds,
    createdBy,
    importance,
  });

export const listWorkspaceMemories = ({ workspaceId, type }) => {
  const workspaceFilter = { workspace: workspaceId };

  if (type !== undefined) {
    workspaceFilter.type = type;
  }

  return WorkspaceMemory.find(workspaceFilter).sort({
    createdAt: -1,
    _id: -1,
  });
};

export const getWorkspaceMemoryById = ({
  workspaceId,
  memoryId,
}) =>
  WorkspaceMemory.findOne({
    _id: memoryId,
    workspace: workspaceId,
  });
