/**
 * Read-State Integration Tests
 *
 * Requires: TEST_MONGO_URI pointing to a MongoDB replica set whose database
 * name contains "test", and CONFIRM_READSTATE_TEST_DATABASE set to that
 * exact database name.
 *
 * Run via: npm run test:integration:readstate:docker
 * (Handles Docker Compose lifecycle automatically.)
 */

import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  after,
  before,
  beforeEach,
  test,
} from "node:test";

import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// Safety guards — must run before any app imports
// ---------------------------------------------------------------------------

const TEST_DATABASE_PATTERN =
  /(?:^|[-_])test(?:$|[-_])/i;
const testMongoUri = process.env.TEST_MONGO_URI;

if (!testMongoUri) {
  throw new Error(
    "TEST_MONGO_URI is required for read-state integration tests."
  );
}

const parsedTestMongoUri = new URL(testMongoUri);
const testDatabaseName = decodeURIComponent(
  parsedTestMongoUri.pathname.replace(/^\//, "")
);

if (
  !testDatabaseName ||
  !TEST_DATABASE_PATTERN.test(testDatabaseName) ||
  process.env.CONFIRM_READSTATE_TEST_DATABASE !==
    testDatabaseName ||
  (process.env.MONGO_URI &&
    process.env.MONGO_URI === testMongoUri)
) {
  throw new Error(
    "Refusing read-state integration tests: use a dedicated database name " +
      "containing 'test' and set CONFIRM_READSTATE_TEST_DATABASE to that " +
      "exact name. TEST_MONGO_URI must not equal MONGO_URI."
  );
}

// Set env vars before importing any app modules (ESM top-level await).
process.env.JWT_SECRET =
  "novahub-readstate-integration-test-secret";
process.env.CLIENT_URL = "http://127.0.0.1:5173";
// Not needed for read-state but app.js reads them for invitation routes.
process.env.INVITE_EXPIRY_HOURS = "24";
process.env.INVITE_CREATION_RATE_LIMIT_MAX = "100";
process.env.INVITE_CREATION_RATE_LIMIT_WINDOW_MINUTES =
  "15";
process.env.INVITE_MAX_ACTIVE_PER_MEMBER = "100";
process.env.INVITE_MAX_ACTIVE_PER_WORKSPACE = "100";

// ---------------------------------------------------------------------------
// App imports (after env vars are set)
// ---------------------------------------------------------------------------

const { default: app } = await import("../../app.js");
const { default: Message } = await import(
  "../../models/Message.js"
);
const { default: User } = await import(
  "../../models/User.js"
);
const { default: Workspace } = await import(
  "../../models/Workspace.js"
);
const { default: WorkspaceReadState } = await import(
  "../../models/WorkspaceReadState.js"
);

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

let baseUrl;
let httpServer;
let identityCounter = 0;

const makeUser = async (label = "user") => {
  identityCounter += 1;
  const user = await User.create({
    name: `${label} ${identityCounter}`,
    email:
      `${label}-${identityCounter}@readstate.integration.test`.toLowerCase(),
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
    name: `RS workspace ${identityCounter}`,
    description: "Disposable read-state integration test",
    createdBy: members[0]._id,
    members: members.map((m) => m._id),
  });

/**
 * Create a Message document directly in MongoDB (bypassing HTTP so we can
 * set specific createdAt values for deterministic ordering tests).
 */
const makeMessage = async (workspaceId, senderId, overrides = {}) => {
  identityCounter += 1;
  return Message.create({
    workspace: workspaceId,
    sender: senderId,
    content: `Integration test message ${identityCounter}`,
    messageType: "text",
    readBy: [senderId],
    ...overrides,
  });
};

const request = async (
  path,
  { method = "GET", token, body } = {}
) => {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
    signal: AbortSignal.timeout(15000),
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(
    `${baseUrl}${path}`,
    options
  );
  const responseText = await response.text();
  let responseBody = null;

  if (responseText) {
    responseBody = JSON.parse(responseText);
  }

  return {
    body: responseBody,
    headers: response.headers,
    status: response.status,
  };
};

const getReadState = (workspaceId, token) =>
  request(
    `/api/workspaces/${workspaceId}/read-state`,
    { token }
  );

const putReadState = (workspaceId, token, messageId) =>
  request(
    `/api/workspaces/${workspaceId}/read-state`,
    { method: "PUT", token, body: { messageId } }
  );

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

before(async () => {
  await mongoose.connect(testMongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  assert.equal(
    mongoose.connection.name,
    testDatabaseName,
    "Mongoose connected to an unexpected database"
  );

  const hello = await mongoose.connection.db.command({
    hello: 1,
  });
  assert.equal(
    typeof hello.setName,
    "string",
    "Read-state integration tests require a replica set"
  );

  await mongoose.connection.dropDatabase();

  // Ensure indexes are created before tests run.
  await Promise.all([
    User.init(),
    Workspace.init(),
    Message.init(),
    WorkspaceReadState.init(),
  ]);

  app.set("io", {
    to() {
      return { emit() {} };
    },
  });

  httpServer = createServer(app);
  await new Promise((resolve) => {
    httpServer.listen(0, "127.0.0.1", resolve);
  });
  const address = httpServer.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  await Promise.all([
    Message.deleteMany({}),
    Workspace.deleteMany({}),
    User.deleteMany({}),
    WorkspaceReadState.deleteMany({}),
  ]);
});

after(async () => {
  if (httpServer) {
    await new Promise((resolve) => {
      httpServer.close(resolve);
    });
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// 1. Unauthenticated GET → 401
test("1. unauthenticated GET returns 401", async () => {
  const member = await makeUser("owner");
  const workspace = await makeWorkspace([member.user]);

  const res = await getReadState(workspace._id);

  assert.equal(res.status, 401);
});

// 2. Unauthenticated PUT → 401
test("2. unauthenticated PUT returns 401", async () => {
  const member = await makeUser("owner");
  const workspace = await makeWorkspace([member.user]);
  const msg = await makeMessage(
    workspace._id,
    member.user._id
  );

  const res = await putReadState(
    workspace._id,
    undefined,
    msg._id.toString()
  );

  assert.equal(res.status, 401);
});

// 3. Invalid workspaceId
test("3. invalid workspaceId returns 400", async () => {
  const member = await makeUser("owner");

  const resGet = await getReadState(
    "not-an-objectid",
    member.token
  );
  assert.equal(resGet.status, 400);

  const resPut = await putReadState(
    "not-an-objectid",
    member.token,
    new mongoose.Types.ObjectId().toString()
  );
  assert.equal(resPut.status, 400);
});

// 4. Nonexistent workspace
test("4. nonexistent workspace returns 404", async () => {
  const member = await makeUser("owner");
  const fakeId = new mongoose.Types.ObjectId().toString();

  const resGet = await getReadState(fakeId, member.token);
  assert.equal(resGet.status, 404);

  const resPut = await putReadState(
    fakeId,
    member.token,
    new mongoose.Types.ObjectId().toString()
  );
  assert.equal(resPut.status, 404);
});

// 5. Non-member → 403
test("5. non-member returns 403", async () => {
  const owner = await makeUser("owner");
  const stranger = await makeUser("stranger");
  const workspace = await makeWorkspace([owner.user]);

  const resGet = await getReadState(
    workspace._id,
    stranger.token
  );
  assert.equal(resGet.status, 403);

  const resPut = await putReadState(
    workspace._id,
    stranger.token,
    new mongoose.Types.ObjectId().toString()
  );
  assert.equal(resPut.status, 403);
});

// 6. Empty workspace first initialization
test("6. empty workspace initializes with null checkpoint and missedCount 0", async () => {
  const member = await makeUser("owner");
  const workspace = await makeWorkspace([member.user]);

  const res = await getReadState(
    workspace._id,
    member.token
  );

  assert.equal(res.status, 200);
  assert.equal(res.body.lastReadMessageId, null);
  assert.equal(res.body.lastReadMessageCreatedAt, null);
  assert.equal(res.body.latestMessageId, null);
  assert.equal(res.body.latestMessageCreatedAt, null);
  assert.equal(res.body.missedCount, 0);
});

// 7. Existing workspace first initialization → latest message as checkpoint
test("7. existing workspace initializes checkpoint to latest message", async () => {
  const member = await makeUser("owner");
  const workspace = await makeWorkspace([member.user]);

  const m1 = await makeMessage(workspace._id, member.user._id);
  const m2 = await makeMessage(workspace._id, member.user._id);
  const m3 = await makeMessage(workspace._id, member.user._id);

  const res = await getReadState(
    workspace._id,
    member.token
  );

  assert.equal(res.status, 200);
  assert.equal(
    res.body.lastReadMessageId,
    m3._id.toString()
  );
  assert.equal(res.body.missedCount, 0);
  assert.equal(
    res.body.latestMessageId,
    m3._id.toString()
  );
});

// 8. Old history NOT treated as missed on first initialization
test("8. old messages not missed on first init", async () => {
  const member = await makeUser("owner");
  const workspace = await makeWorkspace([member.user]);

  // Pre-existing messages before feature is introduced.
  await makeMessage(workspace._id, member.user._id);
  await makeMessage(workspace._id, member.user._id);

  const res = await getReadState(
    workspace._id,
    member.token
  );

  assert.equal(res.status, 200);
  // missedCount must be 0, not 2.
  assert.equal(res.body.missedCount, 0);
});

// 9. Second request reuses same state document
test("9. second GET request returns same state", async () => {
  const member = await makeUser("owner");
  const workspace = await makeWorkspace([member.user]);

  await getReadState(workspace._id, member.token);
  await getReadState(workspace._id, member.token);

  const count = await WorkspaceReadState.countDocuments({
    user: member.user._id,
    workspace: workspace._id,
  });

  assert.equal(count, 1);
});

// 10. Exactly one state document per user/workspace
test("10. exactly one WorkspaceReadState per user/workspace", async () => {
  const member = await makeUser("owner");
  const workspace = await makeWorkspace([member.user]);

  // Multiple concurrent-ish requests.
  await Promise.all([
    getReadState(workspace._id, member.token),
    getReadState(workspace._id, member.token),
    getReadState(workspace._id, member.token),
  ]);

  const count = await WorkspaceReadState.countDocuments({
    user: member.user._id,
    workspace: workspace._id,
  });

  assert.equal(count, 1);
});

// 11. New messages increase missedCount
test("11. messages after checkpoint increase missedCount", async () => {
  const member = await makeUser("owner");
  const workspace = await makeWorkspace([member.user]);

  // Init checkpoint to nothing (empty workspace).
  // Then add 3 messages.
  await getReadState(workspace._id, member.token);

  await makeMessage(workspace._id, member.user._id);
  await makeMessage(workspace._id, member.user._id);
  await makeMessage(workspace._id, member.user._id);

  const res = await getReadState(
    workspace._id,
    member.token
  );

  assert.equal(res.status, 200);
  assert.equal(res.body.missedCount, 3);
});

// 12. Own messages remain part of chronological range (no sender exclusion)
test("12. own sent messages are counted in missedCount range", async () => {
  const owner = await makeUser("owner");
  const other = await makeUser("other");
  const workspace = await makeWorkspace([
    owner.user,
    other.user,
  ]);

  // Initialize owner's checkpoint to current latest (empty).
  await getReadState(workspace._id, owner.token);

  // Other sends a message, then owner sends one.
  await makeMessage(workspace._id, other.user._id);
  await makeMessage(workspace._id, owner.user._id);

  const res = await getReadState(
    workspace._id,
    owner.token
  );

  // Both messages are after checkpoint — no sender filter.
  assert.equal(res.body.missedCount, 2);
});

// 13. Same createdAt values use _id as tie-breaker
test("13. messages with same createdAt use _id tie-breaker", async () => {
  const member = await makeUser("owner");
  const workspace = await makeWorkspace([member.user]);

  const sameTime = new Date("2026-01-01T12:00:00.000Z");
  const m1 = await makeMessage(
    workspace._id,
    member.user._id,
    { createdAt: sameTime }
  );

  // Initialize checkpoint to m1.
  const initRes = await getReadState(
    workspace._id,
    member.token
  );
  assert.equal(initRes.status, 200);
  assert.equal(
    initRes.body.lastReadMessageId,
    m1._id.toString()
  );

  // Create m2 with identical createdAt timestamp.
  const m2 = await makeMessage(
    workspace._id,
    member.user._id,
    { createdAt: sameTime }
  );

  // Ensure m1._id < m2._id (natural insert order).
  assert.ok(
    m1._id.toString() < m2._id.toString(),
    "m1._id should be less than m2._id for this test to be valid"
  );

  // Only m2 (same createdAt, higher _id) should be missed.
  const getRes = await getReadState(
    workspace._id,
    member.token
  );
  assert.equal(getRes.body.missedCount, 1);
});

// 14. Forward checkpoint update
test("14. advancing checkpoint to a newer message succeeds", async () => {
  const member = await makeUser("owner");
  const workspace = await makeWorkspace([member.user]);

  const m1 = await makeMessage(workspace._id, member.user._id);
  const m2 = await makeMessage(workspace._id, member.user._id);
  const m3 = await makeMessage(workspace._id, member.user._id);

  // Init checkpoint → m3 (latest).
  await getReadState(workspace._id, member.token);

  // Add m4 after init.
  const m4 = await makeMessage(workspace._id, member.user._id);

  // Advance to m4.
  const putRes = await putReadState(
    workspace._id,
    member.token,
    m4._id.toString()
  );
  assert.equal(putRes.status, 200);
  assert.equal(
    putRes.body.lastReadMessageId,
    m4._id.toString()
  );

  // missedCount should now be 0.
  const getRes = await getReadState(
    workspace._id,
    member.token
  );
  assert.equal(getRes.body.missedCount, 0);

  // Suppress unused-variable lint warning.
  void m1; void m2; void m3;
});

// 15. Backward update does not regress checkpoint
test("15. advancing to older message does not regress checkpoint", async () => {
  const member = await makeUser("owner");
  const workspace = await makeWorkspace([member.user]);

  const m1 = await makeMessage(workspace._id, member.user._id);
  const m3 = await makeMessage(workspace._id, member.user._id);

  // Set checkpoint to m3.
  await putReadState(
    workspace._id,
    member.token,
    m3._id.toString()
  );

  // Attempt to regress to m1.
  const putRes = await putReadState(
    workspace._id,
    member.token,
    m1._id.toString()
  );

  assert.equal(putRes.status, 200);
  // Checkpoint must still be m3, not m1.
  assert.equal(
    putRes.body.lastReadMessageId,
    m3._id.toString()
  );
});

// 16. Same checkpoint update is idempotent
test("16. advancing to same message twice is idempotent", async () => {
  const member = await makeUser("owner");
  const workspace = await makeWorkspace([member.user]);

  const m1 = await makeMessage(workspace._id, member.user._id);

  await putReadState(
    workspace._id,
    member.token,
    m1._id.toString()
  );
  const res2 = await putReadState(
    workspace._id,
    member.token,
    m1._id.toString()
  );

  assert.equal(res2.status, 200);
  assert.equal(
    res2.body.lastReadMessageId,
    m1._id.toString()
  );

  const count = await WorkspaceReadState.countDocuments({
    user: member.user._id,
    workspace: workspace._id,
  });
  assert.equal(count, 1);
});

// 17. Message from different workspace returns 404
test("17. message from a different workspace returns 404", async () => {
  const member = await makeUser("owner");
  const workspace1 = await makeWorkspace([member.user]);
  const workspace2 = await makeWorkspace([member.user]);

  // Create a message in workspace2.
  const msg = await makeMessage(
    workspace2._id,
    member.user._id
  );

  // Try to advance workspace1's checkpoint using workspace2's message.
  const res = await putReadState(
    workspace1._id,
    member.token,
    msg._id.toString()
  );

  assert.equal(res.status, 404);
  assert.equal(res.body.message, "Message not found.");
});

// 18. Invalid messageId in PUT body
test("18. invalid messageId in PUT body returns 400", async () => {
  const member = await makeUser("owner");
  const workspace = await makeWorkspace([member.user]);

  const res = await putReadState(
    workspace._id,
    member.token,
    "not-an-objectid"
  );

  assert.equal(res.status, 400);
});

// 19. Nonexistent message returns 404
test("19. nonexistent messageId returns 404", async () => {
  const member = await makeUser("owner");
  const workspace = await makeWorkspace([member.user]);

  const fakeId = new mongoose.Types.ObjectId().toString();
  const res = await putReadState(
    workspace._id,
    member.token,
    fakeId
  );

  assert.equal(res.status, 404);
});

// 20. Two users have isolated checkpoints
test("20. two users in same workspace have isolated checkpoints", async () => {
  const alice = await makeUser("alice");
  const bob = await makeUser("bob");
  const workspace = await makeWorkspace([
    alice.user,
    bob.user,
  ]);

  // Alice sees empty workspace at init.
  await getReadState(workspace._id, alice.token);

  // Add 3 messages.
  const m1 = await makeMessage(workspace._id, alice.user._id);
  const m2 = await makeMessage(workspace._id, bob.user._id);
  const m3 = await makeMessage(workspace._id, alice.user._id);

  // Alice advances to m2.
  await putReadState(
    workspace._id,
    alice.token,
    m2._id.toString()
  );

  // Bob initializes after m3 exists — checkpoint = m3.
  const bobRes = await getReadState(
    workspace._id,
    bob.token
  );

  const aliceRes = await getReadState(
    workspace._id,
    alice.token
  );

  // Alice missed m3 (1 missed).
  assert.equal(aliceRes.body.missedCount, 1);
  assert.equal(
    aliceRes.body.lastReadMessageId,
    m2._id.toString()
  );

  // Bob initialized to latest (m3) — 0 missed.
  assert.equal(bobRes.body.missedCount, 0);
  assert.equal(
    bobRes.body.lastReadMessageId,
    m3._id.toString()
  );
});

// 21. One user in two workspaces has isolated checkpoints
test("21. one user in two workspaces has isolated checkpoints", async () => {
  const member = await makeUser("member");
  const ws1 = await makeWorkspace([member.user]);
  const ws2 = await makeWorkspace([member.user]);

  await makeMessage(ws1._id, member.user._id);
  await makeMessage(ws1._id, member.user._id);

  // ws2 is empty at init.
  const res1 = await getReadState(ws1._id, member.token);
  const res2 = await getReadState(ws2._id, member.token);

  assert.equal(res1.body.missedCount, 0);
  assert.notEqual(res1.body.lastReadMessageId, null);

  assert.equal(res2.body.missedCount, 0);
  assert.equal(res2.body.lastReadMessageId, null);

  // Add a message to ws2 — should not appear in ws1 missed count.
  await makeMessage(ws2._id, member.user._id);

  const res1After = await getReadState(ws1._id, member.token);
  assert.equal(res1After.body.missedCount, 0);
});

// 22. Concurrent initialization leaves exactly one state document
test("22. concurrent initialization leaves exactly one state document", async () => {
  const member = await makeUser("member");
  const workspace = await makeWorkspace([member.user]);

  // Fire 5 concurrent GET requests.
  await Promise.all(
    Array.from({ length: 5 }, () =>
      getReadState(workspace._id, member.token)
    )
  );

  const count = await WorkspaceReadState.countDocuments({
    user: member.user._id,
    workspace: workspace._id,
  });

  assert.equal(count, 1);
});

// 23. Concurrent forward updates retain the newest checkpoint
test("23. concurrent advance updates retain the newest checkpoint", async () => {
  const member = await makeUser("member");
  const workspace = await makeWorkspace([member.user]);

  const messages = await Promise.all(
    Array.from({ length: 5 }, () =>
      makeMessage(workspace._id, member.user._id)
    )
  );

  // Sort by canonical order (createdAt ASC, _id ASC) to find newest.
  const sorted = [...messages].sort((a, b) => {
    const timeDiff =
      a.createdAt.getTime() - b.createdAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    return a._id.toString() < b._id.toString() ? -1 : 1;
  });
  const newestId = sorted[sorted.length - 1]._id.toString();

  // Send all update requests concurrently.
  await Promise.all(
    messages.map((m) =>
      putReadState(
        workspace._id,
        member.token,
        m._id.toString()
      )
    )
  );

  const state = await WorkspaceReadState.findOne({
    user: member.user._id,
    workspace: workspace._id,
  });

  assert.ok(state, "State document must exist");
  assert.equal(state.lastReadMessage.toString(), newestId);
});

// 24. Stale-device update cannot regress a newer state
test("24. stale-device update cannot regress a newer checkpoint", async () => {
  const member = await makeUser("member");
  const workspace = await makeWorkspace([member.user]);

  const m1 = await makeMessage(workspace._id, member.user._id);
  const m3 = await makeMessage(workspace._id, member.user._id);

  // "Laptop" advances to m3.
  await putReadState(
    workspace._id,
    member.token,
    m3._id.toString()
  );

  // "Old phone" tries to submit m1 (stale).
  const staleRes = await putReadState(
    workspace._id,
    member.token,
    m1._id.toString()
  );

  assert.equal(staleRes.status, 200);
  // Checkpoint must still be m3.
  assert.equal(
    staleRes.body.lastReadMessageId,
    m3._id.toString()
  );
});
