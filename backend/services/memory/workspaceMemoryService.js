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

export const listWorkspaceMemories = ({
  workspaceId,
  type,
  importance,
  limit,
}) => {
  const workspaceFilter = { workspace: workspaceId };

  if (type !== undefined) {
    workspaceFilter.type = type;
  }

  if (importance !== undefined) {
    workspaceFilter.importance = importance;
  }

  const query = WorkspaceMemory.find(workspaceFilter).sort({
    createdAt: -1,
    _id: -1,
  });

  if (limit !== undefined) {
    query.limit(limit);
  }

  return query;
};

export const getWorkspaceMemoryById = ({
  workspaceId,
  memoryId,
}) =>
  WorkspaceMemory.findOne({
    _id: memoryId,
    workspace: workspaceId,
  });
