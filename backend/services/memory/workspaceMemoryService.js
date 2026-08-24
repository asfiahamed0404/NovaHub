import WorkspaceMemory, {
  normalizeWorkspaceMemoryContent,
} from "../../models/WorkspaceMemory.js";

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

export const findExactWorkspaceMemory = async ({
  workspaceId,
  type,
  content,
}) => {
  const normalizedContent = normalizeWorkspaceMemoryContent(content);

  if (!normalizedContent) {
    return null;
  }

  const indexedMatch = await WorkspaceMemory.findOne({
    workspace: workspaceId,
    type,
    normalizedContent,
  });

  if (indexedMatch) {
    return indexedMatch;
  }

  // Compatibility for records created before normalizedContent existed. This
  // remains workspace/type scoped and streams results instead of loading an
  // unbounded collection into application memory.
  const legacyMemories = WorkspaceMemory.find({
    workspace: workspaceId,
    type,
    normalizedContent: { $exists: false },
  }).cursor();

  for await (const memory of legacyMemories) {
    if (
      normalizeWorkspaceMemoryContent(memory.content) ===
      normalizedContent
    ) {
      return memory;
    }
  }

  return null;
};

export const createWorkspaceMemoryIfNotExists = async (memoryInput) => {
  const existingMemory = await findExactWorkspaceMemory(memoryInput);

  if (existingMemory) {
    return { memory: existingMemory, duplicate: true };
  }

  try {
    const memory = await createWorkspaceMemory(memoryInput);
    return { memory, duplicate: false };
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    // A concurrent request may have inserted the same canonical key after the
    // pre-check. Return that winner as an idempotent duplicate response.
    const concurrentMemory = await findExactWorkspaceMemory(memoryInput);

    if (concurrentMemory) {
      return { memory: concurrentMemory, duplicate: true };
    }

    throw error;
  }
};

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
