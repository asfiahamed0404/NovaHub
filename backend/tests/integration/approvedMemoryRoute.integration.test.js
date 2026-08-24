/**
 * Human-approved Workspace Memory Route Integration Tests
 *
 * Exercises the real JWT, workspace-membership, provenance-validation, memory
 * service, and MongoDB paths. No AI provider is called by this suite.
 */

import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  after,
  before,
  beforeEach,
  test,
} from "node:test";

import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const TEST_DATABASE_PATTERN = /(?:^|[-_])test(?:$|[-_])/i;
const testMongoUri = process.env.TEST_MONGO_URI;

if (!testMongoUri) {
  throw new Error(
    "TEST_MONGO_URI is required for approved-memory route tests."
  );
}

const parsedTestMongoUri = new URL(testMongoUri);
const testDatabaseName = decodeURIComponent(
  parsedTestMongoUri.pathname.replace(/^\//, "")
);

if (
  !testDatabaseName ||
  !TEST_DATABASE_PATTERN.test(testDatabaseName) ||
  process.env.CONFIRM_APPROVED_MEMORY_TEST_DATABASE !==
    testDatabaseName ||
  (process.env.MONGO_URI && process.env.MONGO_URI === testMongoUri)
) {
  throw new Error(
    "Refusing approved-memory route tests: use a dedicated database name " +
      "containing 'test' and set CONFIRM_APPROVED_MEMORY_TEST_DATABASE " +
      "to that exact name. TEST_MONGO_URI must not equal MONGO_URI."
  );
}

process.env.JWT_SECRET = "novahub-approved-memory-test-secret";
process.env.CLIENT_URL = "http://127.0.0.1:5173";

const { default: app } = await import("../../app.js");
const { createWorkspaceMcpServer } = await import(
  "../../mcp/workspaceMcpServer.js"
);
const { default: Message } = await import(
  "../../models/Message.js"
);
const { default: User } = await import("../../models/User.js");
const { default: Workspace } = await import(
  "../../models/Workspace.js"
);
const { default: WorkspaceMemory } = await import(
  "../../models/WorkspaceMemory.js"
);

let baseUrl;
let httpServer;
let identityCounter = 0;

const makeUser = async (label = "user") => {
  identityCounter += 1;
  const user = await User.create({
    name: `${label} ${identityCounter}`,
    email:
      `${label}-${identityCounter}@approved-memory.integration.test`.toLowerCase(),
    password: "integration-test-password-hash",
  });

  return {
    user,
    token: jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    ),
  };
};

const makeWorkspace = async (members) =>
  Workspace.create({
    name: `Approved memory workspace ${identityCounter}`,
    description: "Disposable approved-memory route test",
    createdBy: members[0]._id,
    members: members.map((member) => member._id),
  });

const makeMessage = async (workspace, sender, content) =>
  Message.create({
    workspace: workspace._id,
    sender: sender._id,
    content,
    messageType: "text",
    readBy: [sender._id],
  });

const buildMemoryRequest = (overrides = {}) => ({
  type: "decision",
  content: "Production backend uses Railway.",
  importance: "high",
  sourceMessageIds: [],
  ...overrides,
});

const requestMemory = (
  workspaceId,
  token,
  body = buildMemoryRequest()
) => {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${baseUrl}/api/workspaces/${workspaceId}/ai/memories`, {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  }).then(async (response) => {
    const text = await response.text();
    let json = null;

    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }

    return {
      status: response.status,
      headers: response.headers,
      body: json,
    };
  });
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

  const hello = await mongoose.connection.db.command({ hello: 1 });
  assert.equal(
    typeof hello.setName,
    "string",
    "Approved-memory route tests require a replica set"
  );

  await mongoose.connection.dropDatabase();
  await Promise.all([
    User.init(),
    Workspace.init(),
    Message.init(),
    WorkspaceMemory.init(),
  ]);

  httpServer = createServer(app);
  await new Promise((resolve) => {
    httpServer.listen(0, "127.0.0.1", resolve);
  });
  const address = httpServer.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
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
  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test("1. unauthenticated memory save fails", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  const response = await requestMemory(workspace._id);

  assert.equal(response.status, 401);
  assert.equal(await WorkspaceMemory.countDocuments({}), 0);
});

test("2. non-member memory save fails", async () => {
  const owner = await makeUser("owner");
  const outsider = await makeUser("outsider");
  const workspace = await makeWorkspace([owner.user]);

  const response = await requestMemory(
    workspace._id,
    outsider.token
  );

  assert.equal(response.status, 403);
  assert.equal(response.body.code, "WORKSPACE_ACCESS_DENIED");
  assert.equal(await WorkspaceMemory.countDocuments({}), 0);
});

test("3. invalid and missing workspaces map safely", async () => {
  const owner = await makeUser("owner");

  const invalidResponse = await requestMemory("invalid", owner.token);
  const missingResponse = await requestMemory(
    new mongoose.Types.ObjectId(),
    owner.token
  );

  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidResponse.body.code, "INVALID_WORKSPACE_ID");
  assert.equal(missingResponse.status, 404);
  assert.equal(missingResponse.body.code, "WORKSPACE_NOT_FOUND");
});

test("4. invalid memory type fails", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  const response = await requestMemory(
    workspace._id,
    owner.token,
    buildMemoryRequest({ type: "speculation" })
  );

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_MEMORY_TYPE");
});

test("5. empty and oversized content fail", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  const emptyResponse = await requestMemory(
    workspace._id,
    owner.token,
    buildMemoryRequest({ content: "   " })
  );
  const oversizedResponse = await requestMemory(
    workspace._id,
    owner.token,
    buildMemoryRequest({ content: "x".repeat(4001) })
  );

  assert.equal(emptyResponse.status, 400);
  assert.equal(emptyResponse.body.code, "INVALID_MEMORY_CONTENT");
  assert.equal(oversizedResponse.status, 400);
  assert.equal(oversizedResponse.body.code, "INVALID_MEMORY_CONTENT");
});

test("6. invalid importance fails", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  const response = await requestMemory(
    workspace._id,
    owner.token,
    buildMemoryRequest({ importance: "critical" })
  );

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_MEMORY_IMPORTANCE");
});

test("7. invalid source ObjectId fails", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  const response = await requestMemory(
    workspace._id,
    owner.token,
    buildMemoryRequest({ sourceMessageIds: ["invalid-id"] })
  );

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_MEMORY_PROVENANCE");
});

test("8. source IDs must be an array bounded to 20", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  const nonArrayResponse = await requestMemory(
    workspace._id,
    owner.token,
    buildMemoryRequest({ sourceMessageIds: "not-an-array" })
  );
  const nullResponse = await requestMemory(
    workspace._id,
    owner.token,
    buildMemoryRequest({ sourceMessageIds: null })
  );
  const excessiveResponse = await requestMemory(
    workspace._id,
    owner.token,
    buildMemoryRequest({
      sourceMessageIds: Array.from(
        { length: 21 },
        () => new mongoose.Types.ObjectId().toString()
      ),
    })
  );

  assert.equal(nonArrayResponse.status, 400);
  assert.equal(nonArrayResponse.body.code, "INVALID_MEMORY_PROVENANCE");
  assert.equal(nullResponse.status, 400);
  assert.equal(nullResponse.body.code, "INVALID_MEMORY_PROVENANCE");
  assert.equal(excessiveResponse.status, 400);
  assert.equal(excessiveResponse.body.code, "INVALID_MEMORY_PROVENANCE");
});

test("9. source message from another workspace causes rejection", async () => {
  const owner = await makeUser("owner");
  const workspaceA = await makeWorkspace([owner.user]);
  const workspaceB = await makeWorkspace([owner.user]);
  const messageB = await makeMessage(
    workspaceB,
    owner.user,
    "Workspace B private source"
  );

  const response = await requestMemory(
    workspaceA._id,
    owner.token,
    buildMemoryRequest({
      sourceMessageIds: [messageB._id.toString()],
    })
  );

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_MEMORY_PROVENANCE");
  assert.equal(await WorkspaceMemory.countDocuments({}), 0);
});

test("10. nonexistent source message causes rejection", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  const response = await requestMemory(
    workspace._id,
    owner.token,
    buildMemoryRequest({
      sourceMessageIds: [new mongoose.Types.ObjectId().toString()],
    })
  );

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_MEMORY_PROVENANCE");
  assert.equal(await WorkspaceMemory.countDocuments({}), 0);
});

test("11. valid approved memory is created", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);
  const sourceMessage = await makeMessage(
    workspace,
    owner.user,
    "We decided to deploy the backend on Railway."
  );

  const response = await requestMemory(
    workspace._id,
    owner.token,
    buildMemoryRequest({
      content: "  Production backend uses Railway.  ",
      sourceMessageIds: [sourceMessage._id.toString()],
    })
  );

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.body.memory.content, "Production backend uses Railway.");
  assert.deepEqual(response.body.memory.sourceMessageIds, [
    sourceMessage._id.toString(),
  ]);
  assert.equal(await WorkspaceMemory.countDocuments({}), 1);
});

test("12. createdBy and workspace come from trusted server context", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  const response = await requestMemory(workspace._id, owner.token);
  const memory = await WorkspaceMemory.findById(
    response.body.memory.id
  ).lean();

  assert.equal(response.status, 201);
  assert.equal(memory.workspace.toString(), workspace._id.toString());
  assert.equal(memory.createdBy.toString(), owner.user._id.toString());
});

test("13. client-provided trusted fields are rejected", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  for (const forbiddenField of [
    "workspace",
    "createdBy",
    "userId",
    "role",
  ]) {
    const response = await requestMemory(
      workspace._id,
      owner.token,
      {
        ...buildMemoryRequest(),
        [forbiddenField]: new mongoose.Types.ObjectId().toString(),
      }
    );

    assert.equal(response.status, 400);
    assert.equal(response.body.code, "INVALID_MEMORY_REQUEST");
  }

  assert.equal(await WorkspaceMemory.countDocuments({}), 0);
});

test("14. duplicate source IDs are deduplicated", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);
  const sourceMessage = await makeMessage(
    workspace,
    owner.user,
    "The backend uses Railway."
  );
  const sourceId = sourceMessage._id.toString();

  const response = await requestMemory(
    workspace._id,
    owner.token,
    buildMemoryRequest({
      sourceMessageIds: [sourceId, sourceId.toUpperCase()],
    })
  );

  assert.equal(response.status, 201);
  assert.deepEqual(response.body.memory.sourceMessageIds, [sourceId]);
});

test("15. sourceMessageIds may be omitted", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);
  const request = buildMemoryRequest();
  delete request.sourceMessageIds;

  const response = await requestMemory(
    workspace._id,
    owner.token,
    request
  );

  assert.equal(response.status, 201);
  assert.deepEqual(response.body.memory.sourceMessageIds, []);
});

test("16. malformed and missing bodies fail safely", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);
  const missingFetchResponse = await fetch(
    `${baseUrl}/api/workspaces/${workspace._id}/ai/memories`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${owner.token}` },
      signal: AbortSignal.timeout(15000),
    }
  );
  const malformedFetchResponse = await fetch(
    `${baseUrl}/api/workspaces/${workspace._id}/ai/memories`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${owner.token}`,
        "Content-Type": "application/json",
      },
      body: "{",
      signal: AbortSignal.timeout(15000),
    }
  );

  assert.equal(missingFetchResponse.status, 400);
  assert.equal(malformedFetchResponse.status, 400);
  assert.equal(
    (await malformedFetchResponse.json()).code,
    "INVALID_AI_REQUEST_BODY"
  );
});

test("17. approved REST saving does not add or require an MCP write tool", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  const saveResponse = await requestMemory(
    workspace._id,
    owner.token
  );
  assert.equal(saveResponse.status, 201);

  const server = createWorkspaceMcpServer({
    workspaceId: workspace._id,
    userId: owner.user._id,
    role: owner.user.role,
  });
  const client = new Client({
    name: "approved-memory-read-only-check",
    version: "1.0.0",
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  try {
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    const toolResult = await client.listTools();
    const toolNames = toolResult.tools.map((tool) => tool.name);

    assert.equal(toolNames.includes("create_workspace_memory"), false);
    assert.equal(toolNames.includes("create_memory"), false);
    assert.equal(
      toolResult.tools.every(
        (tool) => tool.annotations?.readOnlyHint === true
      ),
      true
    );
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
});
