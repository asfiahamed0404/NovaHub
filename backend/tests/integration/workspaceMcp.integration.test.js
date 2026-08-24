/**
 * Workspace MCP Integration Tests
 *
 * Exercises the real MCP Client, McpServer, and linked in-memory transports
 * against a guarded disposable MongoDB database.
 *
 * Run via: npm run test:integration:workspace-mcp:docker
 */

import assert from "node:assert/strict";
import {
  after,
  afterEach,
  before,
  beforeEach,
  test,
} from "node:test";

import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import mongoose from "mongoose";

const TEST_DATABASE_PATTERN = /(?:^|[-_])test(?:$|[-_])/i;
const testMongoUri = process.env.TEST_MONGO_URI;

if (!testMongoUri) {
  throw new Error(
    "TEST_MONGO_URI is required for workspace MCP integration tests."
  );
}

const parsedTestMongoUri = new URL(testMongoUri);
const testDatabaseName = decodeURIComponent(
  parsedTestMongoUri.pathname.replace(/^\//, "")
);

if (
  !testDatabaseName ||
  !TEST_DATABASE_PATTERN.test(testDatabaseName) ||
  process.env.CONFIRM_WORKSPACE_MCP_TEST_DATABASE !==
    testDatabaseName ||
  (process.env.MONGO_URI && process.env.MONGO_URI === testMongoUri)
) {
  throw new Error(
    "Refusing workspace MCP integration tests: use a dedicated database " +
      "name containing 'test' and set " +
      "CONFIRM_WORKSPACE_MCP_TEST_DATABASE to that exact name. " +
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
const { createWorkspaceMemory } = await import(
  "../../services/memory/workspaceMemoryService.js"
);
const { createWorkspaceMcpServer } = await import(
  "../../mcp/workspaceMcpServer.js"
);

const EXPECTED_TOOL_NAMES = [
  "get_workspace_info",
  "get_recent_messages",
  "search_workspace_messages",
  "list_workspace_memories",
  "get_workspace_memory",
];

let identityCounter = 0;
const connections = [];

const makeUser = async (label) => {
  identityCounter += 1;
  return User.create({
    name: `${label} ${identityCounter}`,
    email:
      `${label}-${identityCounter}@workspace-mcp.integration.test`.toLowerCase(),
    password: "integration-test-password-hash",
  });
};

const makeWorkspace = async (owner, name) =>
  Workspace.create({
    name,
    description: `${name} description`,
    createdBy: owner._id,
    members: [owner._id],
  });

const makeMessage = async ({
  workspace,
  sender,
  content,
  createdAt,
}) =>
  Message.create({
    workspace: workspace._id,
    sender: sender._id,
    content,
    messageType: "text",
    readBy: [sender._id],
    createdAt,
  });

const connectWorkspaceClient = async ({
  workspaceId,
  userId,
  role = "user",
}) => {
  const server = createWorkspaceMcpServer({
    workspaceId,
    userId,
    role,
  });
  const client = new Client({
    name: "novahub-workspace-mcp-integration-test",
    version: "1.0.0",
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  connections.push({ client, server });

  return { client, server };
};

const seedIsolatedWorkspaces = async () => {
  const ownerA = await makeUser("owner-a");
  const ownerB = await makeUser("owner-b");
  const workspaceA = await makeWorkspace(
    ownerA,
    "Workspace Alpha"
  );
  const workspaceB = await makeWorkspace(
    ownerB,
    "Workspace Beta"
  );

  const baseTime = Date.UTC(2026, 0, 1, 12, 0, 0);

  const messageA = await makeMessage({
    workspace: workspaceA,
    sender: ownerA,
    content: "Alpha shared-term message",
    createdAt: new Date(baseTime + 1000),
  });
  const messageB = await makeMessage({
    workspace: workspaceB,
    sender: ownerB,
    content: "Beta shared-term private message",
    createdAt: new Date(baseTime + 2000),
  });

  const memoryA = await createWorkspaceMemory({
    workspaceId: workspaceA._id,
    type: "fact",
    content: "Alpha durable fact",
    sourceMessageIds: [messageA._id],
    createdBy: ownerA._id,
    importance: "high",
  });
  const memoryB = await createWorkspaceMemory({
    workspaceId: workspaceB._id,
    type: "fact",
    content: "Beta private durable fact",
    sourceMessageIds: [messageB._id],
    createdBy: ownerB._id,
    importance: "high",
  });

  return {
    ownerA,
    ownerB,
    workspaceA,
    workspaceB,
    messageA,
    messageB,
    memoryA,
    memoryB,
  };
};

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

afterEach(async () => {
  const activeConnections = connections.splice(0);

  await Promise.allSettled(
    activeConnections.flatMap(({ client, server }) => [
      client.close(),
      server.close(),
    ])
  );
});

after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test("client discovers the five workspace tools", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace(owner, "Discovery workspace");
  const { client } = await connectWorkspaceClient({
    workspaceId: workspace._id,
    userId: owner._id,
  });

  const { tools } = await client.listTools();

  assert.deepEqual(
    tools.map((tool) => tool.name).sort(),
    [...EXPECTED_TOOL_NAMES].sort()
  );
});

test("all advertised tools have read-only metadata and no workspaceId input", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace(owner, "Metadata workspace");
  const { client } = await connectWorkspaceClient({
    workspaceId: workspace._id,
    userId: owner._id,
  });

  const { tools } = await client.listTools();

  for (const tool of tools) {
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(
      Object.hasOwn(tool.inputSchema.properties || {}, "workspaceId"),
      false
    );
  }
});

test("get_recent_messages returns only bound-workspace messages", async () => {
  const fixture = await seedIsolatedWorkspaces();
  const { client } = await connectWorkspaceClient({
    workspaceId: fixture.workspaceA._id,
    userId: fixture.ownerA._id,
  });

  const result = await client.callTool({
    name: "get_recent_messages",
    arguments: { limit: 20 },
  });

  assert.equal(result.isError, undefined);
  assert.deepEqual(
    result.structuredContent.messages.map((message) =>
      message.content
    ),
    ["Alpha shared-term message"]
  );
  assert.equal(
    Object.hasOwn(result.structuredContent.messages[0], "workspace"),
    false
  );
});

test("search_workspace_messages never returns another workspace's messages", async () => {
  const fixture = await seedIsolatedWorkspaces();
  const { client } = await connectWorkspaceClient({
    workspaceId: fixture.workspaceA._id,
    userId: fixture.ownerA._id,
  });

  const result = await client.callTool({
    name: "search_workspace_messages",
    arguments: { query: "shared-term", limit: 20 },
  });

  assert.equal(result.structuredContent.count, 1);
  assert.equal(
    result.structuredContent.messages[0].content,
    "Alpha shared-term message"
  );
});

test("message search treats regex characters as literal text", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace(owner, "Regex workspace");
  const baseTime = Date.UTC(2026, 0, 2, 12, 0, 0);

  await makeMessage({
    workspace,
    sender: owner,
    content: "Ordinary message that must not match",
    createdAt: new Date(baseTime),
  });
  await makeMessage({
    workspace,
    sender: owner,
    content: "Message containing literal .* characters",
    createdAt: new Date(baseTime + 1000),
  });

  const { client } = await connectWorkspaceClient({
    workspaceId: workspace._id,
    userId: owner._id,
  });
  const result = await client.callTool({
    name: "search_workspace_messages",
    arguments: { query: ".*" },
  });

  assert.equal(result.structuredContent.count, 1);
  assert.equal(
    result.structuredContent.messages[0].content,
    "Message containing literal .* characters"
  );
});

test("list_workspace_memories returns only bound-workspace memories", async () => {
  const fixture = await seedIsolatedWorkspaces();
  const { client } = await connectWorkspaceClient({
    workspaceId: fixture.workspaceA._id,
    userId: fixture.ownerA._id,
  });

  const result = await client.callTool({
    name: "list_workspace_memories",
    arguments: {},
  });

  assert.equal(result.structuredContent.count, 1);
  assert.equal(
    result.structuredContent.memories[0].content,
    "Alpha durable fact"
  );
  assert.equal(
    Object.hasOwn(result.structuredContent.memories[0], "workspace"),
    false
  );
});

test("get_workspace_memory hides another workspace's memory", async () => {
  const fixture = await seedIsolatedWorkspaces();
  const { client } = await connectWorkspaceClient({
    workspaceId: fixture.workspaceA._id,
    userId: fixture.ownerA._id,
  });

  const result = await client.callTool({
    name: "get_workspace_memory",
    arguments: { memoryId: fixture.memoryB._id.toString() },
  });

  assert.equal(result.isError, undefined);
  assert.deepEqual(result.structuredContent, {
    found: false,
    memory: null,
  });
  assert.equal(
    JSON.stringify(result).includes("Beta private durable fact"),
    false
  );
});

test("empty message search queries are rejected by MCP input validation", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace(owner, "Validation workspace");
  const { client } = await connectWorkspaceClient({
    workspaceId: workspace._id,
    userId: owner._id,
  });

  const result = await client.callTool({
    name: "search_workspace_messages",
    arguments: { query: "   " },
  });

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /Input validation error/);
});

test("excessive tool limits are rejected by MCP input validation", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace(owner, "Limit workspace");
  const { client } = await connectWorkspaceClient({
    workspaceId: workspace._id,
    userId: owner._id,
  });

  const recentResult = await client.callTool({
    name: "get_recent_messages",
    arguments: { limit: 51 },
  });
  const searchResult = await client.callTool({
    name: "search_workspace_messages",
    arguments: { query: "message", limit: 21 },
  });

  assert.equal(recentResult.isError, true);
  assert.equal(searchResult.isError, true);
});

test("invalid memory IDs are handled safely", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace(owner, "Memory ID workspace");
  const { client } = await connectWorkspaceClient({
    workspaceId: workspace._id,
    userId: owner._id,
  });

  const result = await client.callTool({
    name: "get_workspace_memory",
    arguments: { memoryId: "not-an-object-id" },
  });

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /Input validation error/);
  assert.equal(result.content[0].text.includes("CastError"), false);
});

test("get_workspace_info returns only safe bound-workspace fields", async () => {
  const fixture = await seedIsolatedWorkspaces();
  const { client } = await connectWorkspaceClient({
    workspaceId: fixture.workspaceA._id,
    userId: fixture.ownerA._id,
  });

  const result = await client.callTool({
    name: "get_workspace_info",
    arguments: {},
  });
  const workspace = result.structuredContent.workspace;

  assert.equal(workspace.id, fixture.workspaceA._id.toString());
  assert.equal(workspace.name, "Workspace Alpha");
  assert.deepEqual(Object.keys(workspace).sort(), [
    "createdAt",
    "description",
    "id",
    "name",
  ]);
});

test("recent messages select newest records then return chronological order", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace(owner, "Ordering workspace");
  const baseTime = Date.UTC(2026, 0, 3, 12, 0, 0);

  for (let index = 1; index <= 3; index += 1) {
    await makeMessage({
      workspace,
      sender: owner,
      content: `Ordered message ${index}`,
      createdAt: new Date(baseTime + index * 1000),
    });
  }

  const { client } = await connectWorkspaceClient({
    workspaceId: workspace._id,
    userId: owner._id,
  });
  const result = await client.callTool({
    name: "get_recent_messages",
    arguments: { limit: 2 },
  });

  assert.deepEqual(
    result.structuredContent.messages.map((message) =>
      message.content
    ),
    ["Ordered message 2", "Ordered message 3"]
  );
});

test("memory type and importance filters are applied together", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace(owner, "Filter workspace");

  await Promise.all([
    createWorkspaceMemory({
      workspaceId: workspace._id,
      type: "fact",
      content: "High fact",
      createdBy: owner._id,
      importance: "high",
    }),
    createWorkspaceMemory({
      workspaceId: workspace._id,
      type: "fact",
      content: "Low fact",
      createdBy: owner._id,
      importance: "low",
    }),
    createWorkspaceMemory({
      workspaceId: workspace._id,
      type: "task",
      content: "High task",
      createdBy: owner._id,
      importance: "high",
    }),
  ]);

  const { client } = await connectWorkspaceClient({
    workspaceId: workspace._id,
    userId: owner._id,
  });
  const result = await client.callTool({
    name: "list_workspace_memories",
    arguments: { type: "fact", importance: "high" },
  });

  assert.equal(result.structuredContent.count, 1);
  assert.equal(
    result.structuredContent.memories[0].content,
    "High fact"
  );
});

test("two concurrent MCP servers retain independent workspace context", async () => {
  const fixture = await seedIsolatedWorkspaces();
  const [{ client: clientA }, { client: clientB }] =
    await Promise.all([
      connectWorkspaceClient({
        workspaceId: fixture.workspaceA._id,
        userId: fixture.ownerA._id,
      }),
      connectWorkspaceClient({
        workspaceId: fixture.workspaceB._id,
        userId: fixture.ownerB._id,
      }),
    ]);

  const [resultA, resultB] = await Promise.all([
    clientA.callTool({
      name: "get_recent_messages",
      arguments: {},
    }),
    clientB.callTool({
      name: "get_recent_messages",
      arguments: {},
    }),
  ]);

  assert.deepEqual(
    resultA.structuredContent.messages.map((message) =>
      message.content
    ),
    ["Alpha shared-term message"]
  );
  assert.deepEqual(
    resultB.structuredContent.messages.map((message) =>
      message.content
    ),
    ["Beta shared-term private message"]
  );
});

test("factory rejects malformed trusted context IDs", () => {
  const validId = new mongoose.Types.ObjectId();

  assert.throws(
    () =>
      createWorkspaceMcpServer({
        workspaceId: "invalid",
        userId: validId,
      }),
    /workspaceId must be a valid MongoDB ObjectId/
  );
  assert.throws(
    () =>
      createWorkspaceMcpServer({
        workspaceId: validId,
        userId: "invalid",
      }),
    /userId must be a valid MongoDB ObjectId/
  );
});

test("a missing bound workspace returns a safe MCP error", async () => {
  const owner = await makeUser("owner");
  const { client } = await connectWorkspaceClient({
    workspaceId: new mongoose.Types.ObjectId(),
    userId: owner._id,
  });

  const result = await client.callTool({
    name: "get_workspace_info",
    arguments: {},
  });

  assert.equal(result.isError, true);
  assert.equal(result.content[0].text, "Workspace not found.");
});
