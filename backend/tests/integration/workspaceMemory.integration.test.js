/**
 * Workspace Memory Integration Tests
 *
 * Requires: TEST_MONGO_URI pointing to a disposable MongoDB database whose
 * name contains "test", and CONFIRM_WORKSPACE_MEMORY_TEST_DATABASE set to
 * that exact database name.
 *
 * Run via: npm run test:integration:workspace-memory:docker
 */

import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";

import mongoose from "mongoose";

const TEST_DATABASE_PATTERN = /(?:^|[-_])test(?:$|[-_])/i;
const testMongoUri = process.env.TEST_MONGO_URI;

if (!testMongoUri) {
  throw new Error(
    "TEST_MONGO_URI is required for workspace-memory integration tests."
  );
}

const parsedTestMongoUri = new URL(testMongoUri);
const testDatabaseName = decodeURIComponent(
  parsedTestMongoUri.pathname.replace(/^\//, "")
);

if (
  !testDatabaseName ||
  !TEST_DATABASE_PATTERN.test(testDatabaseName) ||
  process.env.CONFIRM_WORKSPACE_MEMORY_TEST_DATABASE !==
    testDatabaseName ||
  (process.env.MONGO_URI && process.env.MONGO_URI === testMongoUri)
) {
  throw new Error(
    "Refusing workspace-memory integration tests: use a dedicated database " +
      "name containing 'test' and set " +
      "CONFIRM_WORKSPACE_MEMORY_TEST_DATABASE to that exact name. " +
      "TEST_MONGO_URI must not equal MONGO_URI."
  );
}

const { default: Message } = await import(
  "../../models/Message.js"
);
const { default: User } = await import(
  "../../models/User.js"
);
const { default: Workspace } = await import(
  "../../models/Workspace.js"
);
const { default: WorkspaceMemory } = await import(
  "../../models/WorkspaceMemory.js"
);
const {
  createWorkspaceMemory,
  createWorkspaceMemoryIfNotExists,
  findExactWorkspaceMemory,
  getWorkspaceMemoryById,
  listWorkspaceMemories,
} = await import(
  "../../services/memory/workspaceMemoryService.js"
);

let identityCounter = 0;

const makeUser = async (label = "user") => {
  identityCounter += 1;
  return User.create({
    name: `${label} ${identityCounter}`,
    email:
      `${label}-${identityCounter}@workspace-memory.integration.test`.toLowerCase(),
    password: "integration-test-password-hash",
  });
};

const makeWorkspace = async (owner) =>
  Workspace.create({
    name: `Memory workspace ${identityCounter}`,
    description: "Disposable workspace-memory integration test",
    createdBy: owner._id,
    members: [owner._id],
  });

before(async () => {
  await mongoose.connect(testMongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  assert.equal(
    mongoose.connection.name,
    testDatabaseName,
    "Mongoose connected to an unexpected database"
  );

  await mongoose.connection.dropDatabase();

  await Promise.all([
    User.init(),
    Workspace.init(),
    Message.init(),
    WorkspaceMemory.init(),
  ]);
});

beforeEach(async () => {
  await Promise.all([
    WorkspaceMemory.deleteMany({}),
    Message.deleteMany({}),
    Workspace.deleteMany({}),
    User.deleteMany({}),
  ]);
});

after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test("a memory can be created for a workspace", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace(owner);

  const memory = await createWorkspaceMemory({
    workspaceId: workspace._id,
    type: "decision",
    content: "  Production backend is hosted on Railway.  ",
    createdBy: owner._id,
  });

  assert.equal(memory.workspace.toString(), workspace._id.toString());
  assert.equal(memory.type, "decision");
  assert.equal(memory.content, "Production backend is hosted on Railway.");
  assert.equal(memory.createdBy.toString(), owner._id.toString());
  assert.ok(memory.createdAt instanceof Date);
  assert.ok(memory.updatedAt instanceof Date);
});

test("unsupported memory types are rejected", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace(owner);

  await assert.rejects(
    createWorkspaceMemory({
      workspaceId: workspace._id,
      type: "speculation",
      content: "This type is unsupported.",
      createdBy: owner._id,
    }),
    (error) =>
      error instanceof mongoose.Error.ValidationError &&
      error.errors.type?.kind === "enum"
  );
});

test("empty memory content is rejected after trimming", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace(owner);

  await assert.rejects(
    createWorkspaceMemory({
      workspaceId: workspace._id,
      type: "fact",
      content: "   ",
      createdBy: owner._id,
    }),
    (error) =>
      error instanceof mongoose.Error.ValidationError &&
      error.errors.content?.kind === "required"
  );
});

test("listing memories only returns the requested workspace", async () => {
  const owner = await makeUser("owner");
  const workspaceA = await makeWorkspace(owner);
  const workspaceB = await makeWorkspace(owner);

  await Promise.all([
    createWorkspaceMemory({
      workspaceId: workspaceA._id,
      type: "fact",
      content: "Workspace A memory",
      createdBy: owner._id,
    }),
    createWorkspaceMemory({
      workspaceId: workspaceB._id,
      type: "fact",
      content: "Workspace B memory",
      createdBy: owner._id,
    }),
  ]);

  const memories = await listWorkspaceMemories({
    workspaceId: workspaceA._id,
  });

  assert.equal(memories.length, 1);
  assert.equal(memories[0].content, "Workspace A memory");
  assert.equal(
    memories[0].workspace.toString(),
    workspaceA._id.toString()
  );
});

test("fetching a memory through another workspace returns no result", async () => {
  const owner = await makeUser("owner");
  const workspaceA = await makeWorkspace(owner);
  const workspaceB = await makeWorkspace(owner);
  const workspaceBMemory = await createWorkspaceMemory({
    workspaceId: workspaceB._id,
    type: "note",
    content: "Private to workspace B",
    createdBy: owner._id,
  });

  const result = await getWorkspaceMemoryById({
    workspaceId: workspaceA._id,
    memoryId: workspaceBMemory._id,
  });

  assert.equal(result, null);
});

test("source message IDs can be stored", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace(owner);
  const sourceMessage = await Message.create({
    workspace: workspace._id,
    sender: owner._id,
    content: "The frontend uses React.",
    messageType: "text",
    readBy: [owner._id],
  });

  const memory = await createWorkspaceMemory({
    workspaceId: workspace._id,
    type: "fact",
    content: "NovaHub's frontend uses React.",
    sourceMessageIds: [sourceMessage._id],
    createdBy: owner._id,
  });

  assert.deepEqual(
    memory.sourceMessageIds.map((id) => id.toString()),
    [sourceMessage._id.toString()]
  );
});

test("importance defaults to normal", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace(owner);

  const memory = await createWorkspaceMemory({
    workspaceId: workspace._id,
    type: "task",
    content: "Verify the invitation flow before release.",
    createdBy: owner._id,
  });

  assert.equal(memory.importance, "normal");
  assert.deepEqual(memory.sourceMessageIds, []);
});

test("source message provenance is bounded to 20 IDs", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace(owner);

  await assert.rejects(
    createWorkspaceMemory({
      workspaceId: workspace._id,
      type: "note",
      content: "Too many provenance references.",
      sourceMessageIds: Array.from(
        { length: 21 },
        () => new mongoose.Types.ObjectId()
      ),
      createdBy: owner._id,
    }),
    (error) =>
      error instanceof mongoose.Error.ValidationError &&
      Boolean(error.errors.sourceMessageIds)
  );
});

test("exact lookup normalizes case and whitespace within workspace and type", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace(owner);
  const memory = await createWorkspaceMemory({
    workspaceId: workspace._id,
    type: "decision",
    content:
      "Production hosting: Railway for backend, Vercel for frontend",
    createdBy: owner._id,
    importance: "high",
  });

  const exactMatch = await findExactWorkspaceMemory({
    workspaceId: workspace._id,
    type: "decision",
    content:
      "Production hosting: Railway for backend, Vercel for frontend",
  });
  const normalizedMatch = await findExactWorkspaceMemory({
    workspaceId: workspace._id,
    type: "decision",
    content:
      "  production hosting: railway for backend,   vercel for frontend  ",
  });

  assert.equal(exactMatch._id.toString(), memory._id.toString());
  assert.equal(normalizedMatch._id.toString(), memory._id.toString());
});

test("exact lookup keeps memory types independent", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace(owner);
  await createWorkspaceMemory({
    workspaceId: workspace._id,
    type: "decision",
    content: "Use Railway",
    createdBy: owner._id,
  });

  const match = await findExactWorkspaceMemory({
    workspaceId: workspace._id,
    type: "note",
    content: "Use Railway",
  });

  assert.equal(match, null);
});

test("exact lookup does not use semantic, fuzzy, or punctuation matching", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace(owner);
  await createWorkspaceMemory({
    workspaceId: workspace._id,
    type: "decision",
    content: "Railway hosts the backend.",
    createdBy: owner._id,
  });

  const changedMeaning = await findExactWorkspaceMemory({
    workspaceId: workspace._id,
    type: "decision",
    content: "The backend migrated from Railway to AWS.",
  });
  const changedPunctuation = await findExactWorkspaceMemory({
    workspaceId: workspace._id,
    type: "decision",
    content: "Railway hosts the backend",
  });

  assert.equal(changedMeaning, null);
  assert.equal(changedPunctuation, null);
});

test("exact lookup never crosses workspace boundaries", async () => {
  const owner = await makeUser("owner");
  const workspaceA = await makeWorkspace(owner);
  const workspaceB = await makeWorkspace(owner);
  await createWorkspaceMemory({
    workspaceId: workspaceA._id,
    type: "decision",
    content: "Use Railway",
    createdBy: owner._id,
  });

  const match = await findExactWorkspaceMemory({
    workspaceId: workspaceB._id,
    type: "decision",
    content: "Use Railway",
  });
  const result = await createWorkspaceMemoryIfNotExists({
    workspaceId: workspaceB._id,
    type: "decision",
    content: "Use Railway",
    createdBy: owner._id,
  });

  assert.equal(match, null);
  assert.equal(result.duplicate, false);
  assert.equal(await WorkspaceMemory.countDocuments({}), 2);
});

test("exact lookup recognizes legacy records without rewriting them", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace(owner);
  const legacyId = new mongoose.Types.ObjectId();

  await WorkspaceMemory.collection.insertOne({
    _id: legacyId,
    workspace: workspace._id,
    type: "decision",
    content: "Legacy  Railway decision",
    sourceMessageIds: [],
    createdBy: owner._id,
    importance: "normal",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const match = await findExactWorkspaceMemory({
    workspaceId: workspace._id,
    type: "decision",
    content: " legacy railway DECISION ",
  });
  const stored = await WorkspaceMemory.collection.findOne({
    _id: legacyId,
  });

  assert.equal(match._id.toString(), legacyId.toString());
  assert.equal("normalizedContent" in stored, false);
});
