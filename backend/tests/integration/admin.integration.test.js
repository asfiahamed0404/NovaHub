/**
 * Platform Admin API Integration Tests
 *
 * Requires TEST_MONGO_URI to point at a disposable MongoDB replica-set
 * database whose name contains a standalone "test" segment. The exact
 * database name must also be supplied through
 * CONFIRM_ADMIN_TEST_DATABASE.
 *
 * The suite starts the real Express application on an ephemeral local port,
 * authenticates with real test JWTs, and never invokes an AI provider.
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

// Safety guards must run before importing the application or its models.
const TEST_DATABASE_PATTERN = /(?:^|[-_])test(?:$|[-_])/i;
const testMongoUri = process.env.TEST_MONGO_URI;

if (!testMongoUri) {
  throw new Error(
    "TEST_MONGO_URI is required for admin integration tests."
  );
}

let parsedTestMongoUri;

try {
  parsedTestMongoUri = new URL(testMongoUri);
} catch {
  throw new Error(
    "TEST_MONGO_URI must be a valid MongoDB connection URL."
  );
}

const testDatabaseName = decodeURIComponent(
  parsedTestMongoUri.pathname.replace(/^\//, "")
);

if (
  !testDatabaseName ||
  !TEST_DATABASE_PATTERN.test(testDatabaseName) ||
  process.env.CONFIRM_ADMIN_TEST_DATABASE !== testDatabaseName ||
  (process.env.MONGO_URI && process.env.MONGO_URI === testMongoUri)
) {
  throw new Error(
    "Refusing admin integration tests: use a dedicated database name " +
      "containing 'test' and set CONFIRM_ADMIN_TEST_DATABASE to that " +
      "exact name. TEST_MONGO_URI must not equal MONGO_URI."
  );
}

process.env.JWT_SECRET = "novahub-admin-integration-test-secret";
process.env.CLIENT_URL = "http://127.0.0.1:5173";
process.env.INVITE_EXPIRY_HOURS = "24";
process.env.INVITE_CREATION_RATE_LIMIT_MAX = "100";
process.env.INVITE_CREATION_RATE_LIMIT_WINDOW_MINUTES = "15";
process.env.INVITE_MAX_ACTIVE_PER_MEMBER = "100";
process.env.INVITE_MAX_ACTIVE_PER_WORKSPACE = "100";
process.env.AI_SUMMARY_RATE_LIMIT_WINDOW_MINUTES = "60";
process.env.AI_FREE_SUMMARY_RATE_LIMIT_MAX = "5";
process.env.AI_PREMIUM_SUMMARY_RATE_LIMIT_MAX = "50";

const { default: app } = await import("../../app.js");
const { default: AiUsageRateLimit } = await import(
  "../../models/AiUsageRateLimit.js"
);
const { default: Message } = await import(
  "../../models/Message.js"
);
const { default: PlatformAdminRoleLock } = await import(
  "../../models/PlatformAdminRoleLock.js"
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
  LastPlatformAdminError,
  updateUserWithAdminInvariant,
} = await import(
  "../../services/admin/adminUserService.js"
);

let baseUrl;
let httpServer;
let identityCounter = 0;

const TEST_PASSWORD = "admin-integration-password-hash";
const FORBIDDEN_RESPONSE_KEYS = new Set([
  "password",
  "passwordhash",
  "hashedpassword",
  "token",
  "tokenhash",
  "accesstoken",
  "refreshtoken",
  "invitationtoken",
  "invitationtokenhash",
  "resettoken",
  "jwtsecret",
  "normalizedcontent",
]);

const makeObjectId = () => new mongoose.Types.ObjectId();

const signToken = (userId) =>
  jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );

const makeUser = async (
  label,
  {
    role = "user",
    plan = "free",
    createdAt,
  } = {}
) => {
  identityCounter += 1;

  const user = await User.create({
    name: `${label} ${identityCounter}`,
    email:
      `${label}-${identityCounter}@admin.integration.test`.toLowerCase(),
    password: TEST_PASSWORD,
    role,
    plan,
    ...(createdAt
      ? { createdAt, updatedAt: createdAt }
      : {}),
  });

  return {
    user,
    token: signToken(user._id),
  };
};

const makeWorkspace = async (
  name,
  members,
  { createdAt } = {}
) => {
  const workspace = await Workspace.create({
    name,
    description: `${name} integration fixture`,
    createdBy: members[0]._id,
    members: members.map((member) => member._id),
    ...(createdAt
      ? { createdAt, updatedAt: createdAt }
      : {}),
  });

  return workspace;
};

const makeMessage = async (
  workspace,
  sender,
  content = "Admin integration test message"
) =>
  Message.create({
    workspace: workspace._id,
    sender: sender._id,
    content,
    messageType: "text",
    readBy: [sender._id],
  });

const makeMemory = async ({
  workspace,
  createdBy,
  type = "fact",
  content,
  importance = "normal",
  sourceMessageIds = [],
}) =>
  WorkspaceMemory.create({
    workspace: workspace._id,
    createdBy: createdBy._id,
    type,
    content:
      content || `Admin memory fixture ${++identityCounter}`,
    importance,
    sourceMessageIds,
  });

const makeUsage = async (
  user,
  requestCount,
  {
    windowStartedAt = new Date(Date.now() - 5 * 60 * 1000),
  } = {}
) =>
  AiUsageRateLimit.create({
    _id: `user_${user._id}`,
    user: user._id,
    requestCount,
    windowStartedAt,
    expireAt: new Date(
      windowStartedAt.getTime() + 60 * 60 * 1000
    ),
  });

const request = async (
  path,
  { method = "GET", token, body } = {}
) => {
  const headers = {};
  const options = {
    method,
    headers,
    signal: AbortSignal.timeout(15000),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, options);
  const responseText = await response.text();
  let responseBody = null;

  if (responseText) {
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }
  }

  return {
    body: responseBody,
    headers: response.headers,
    status: response.status,
    text: responseText,
  };
};

const assertPagination = (
  responseBody,
  {
    page,
    limit,
    total,
    pages,
  } = {}
) => {
  assert.ok(Array.isArray(responseBody?.items));
  assert.ok(responseBody?.pagination);
  assert.equal(typeof responseBody.pagination.page, "number");
  assert.equal(typeof responseBody.pagination.limit, "number");
  assert.equal(typeof responseBody.pagination.total, "number");
  assert.equal(typeof responseBody.pagination.pages, "number");

  if (page !== undefined) {
    assert.equal(responseBody.pagination.page, page);
  }
  if (limit !== undefined) {
    assert.equal(responseBody.pagination.limit, limit);
  }
  if (total !== undefined) {
    assert.equal(responseBody.pagination.total, total);
  }
  if (pages !== undefined) {
    assert.equal(responseBody.pagination.pages, pages);
  }
};

const assertNoSecrets = (value, path = "response") => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertNoSecrets(item, `${path}[${index}]`);
    });
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  Object.entries(value).forEach(([key, nestedValue]) => {
    const normalizedKey = key.toLowerCase().replace(/[_-]/gu, "");
    assert.equal(
      FORBIDDEN_RESPONSE_KEYS.has(normalizedKey),
      false,
      `Sensitive key ${path}.${key} must not be returned`
    );
    assertNoSecrets(nestedValue, `${path}.${key}`);
  });

  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /admin-integration-password-hash/i);
  assert.doesNotMatch(serialized, /novahub-admin-integration-test-secret/i);
};

const findUserItem = (items, email) =>
  items.find((item) => item.email === email);

const findUsageItem = (items, user) =>
  items.find((item) => {
    const itemUser = item.user || item;
    return (
      itemUser.id === user._id.toString() ||
      itemUser.email === user.email
    );
  });

const readUsageCount = (item) =>
  item.usageCount ?? item.requestCount ?? item.usage;

const readUsageLimit = (item) =>
  item.limit ?? item.quota ?? item.requestsPerWindow;

const readRateLimited = (item) =>
  item.isRateLimited ?? item.rateLimited ?? item.limited;

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
    "Admin integration tests require a replica set"
  );

  await mongoose.connection.dropDatabase();
  await Promise.all([
    User.init(),
    Workspace.init(),
    Message.init(),
    PlatformAdminRoleLock.init(),
    WorkspaceMemory.init(),
    AiUsageRateLimit.init(),
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

beforeEach(async (context) => {
  // Node's beforeEach hooks also run for nested t.test() cases. Only the
  // numbered top-level scenarios own database isolation; clearing before a
  // nested authorization/validation matrix entry would delete that parent
  // scenario's authenticated fixtures.
  if (!/^\d+\./u.test(context.name)) {
    return;
  }

  await Promise.all([
    AiUsageRateLimit.deleteMany({}),
    WorkspaceMemory.deleteMany({}),
    Message.deleteMany({}),
    PlatformAdminRoleLock.deleteMany({}),
    Workspace.deleteMany({}),
    User.deleteMany({}),
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

test("1. unauthenticated requests cannot access any admin API", async (t) => {
  const id = makeObjectId().toString();
  const checks = [
    ["GET", "/api/admin/dashboard"],
    ["GET", "/api/admin/users"],
    ["GET", `/api/admin/users/${id}`],
    ["PATCH", `/api/admin/users/${id}`, { plan: "premium" }],
    ["GET", "/api/admin/workspaces"],
    ["GET", `/api/admin/workspaces/${id}`],
    ["GET", "/api/admin/ai-usage"],
    ["GET", "/api/admin/memories"],
    ["DELETE", `/api/admin/memories/${id}`],
  ];

  for (const [method, path, body] of checks) {
    await t.test(`${method} ${path}`, async () => {
      const response = await request(path, { method, body });
      assert.equal(response.status, 401);
      assertNoSecrets(response.body);
    });
  }
});

test("2. normal users receive 403 across admin reads and mutations", async (t) => {
  const normal = await makeUser("normal-access");
  const target = await makeUser("normal-target");
  const workspace = await makeWorkspace(
    "Normal access workspace",
    [target.user]
  );
  const memory = await makeMemory({
    workspace,
    createdBy: target.user,
    content: "Normal users cannot govern this memory",
  });
  const checks = [
    ["GET", "/api/admin/dashboard"],
    ["GET", "/api/admin/users"],
    ["GET", `/api/admin/users/${target.user._id}`],
    [
      "PATCH",
      `/api/admin/users/${target.user._id}`,
      { plan: "premium" },
    ],
    ["GET", "/api/admin/workspaces"],
    ["GET", `/api/admin/workspaces/${workspace._id}`],
    ["GET", "/api/admin/ai-usage"],
    ["GET", "/api/admin/memories"],
    ["DELETE", `/api/admin/memories/${memory._id}`],
  ];

  for (const [method, path, body] of checks) {
    await t.test(`${method} ${path}`, async () => {
      const response = await request(path, {
        method,
        token: normal.token,
        body,
      });
      assert.equal(response.status, 403);
      assertNoSecrets(response.body);
    });
  }
});

test("3. an admin can access truthful dashboard totals and bounded recent lists", async () => {
  const admin = await makeUser("dashboard-admin", {
    role: "admin",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
  });
  const freeUser = await makeUser("dashboard-free");
  const premiumUser = await makeUser("dashboard-premium", {
    plan: "premium",
  });
  const firstWorkspace = await makeWorkspace(
    "Dashboard first",
    [admin.user, freeUser.user]
  );
  const secondWorkspace = await makeWorkspace(
    "Dashboard second",
    [premiumUser.user]
  );
  await Promise.all([
    makeMessage(firstWorkspace, admin.user, "Dashboard message one"),
    makeMessage(firstWorkspace, freeUser.user, "Dashboard message two"),
    makeMessage(secondWorkspace, premiumUser.user, "Dashboard message three"),
  ]);
  await Promise.all([
    makeMemory({
      workspace: firstWorkspace,
      createdBy: admin.user,
      content: "Dashboard memory one",
    }),
    makeMemory({
      workspace: secondWorkspace,
      createdBy: premiumUser.user,
      content: "Dashboard memory two",
    }),
  ]);

  const response = await request("/api/admin/dashboard", {
    token: admin.token,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.stats, {
    users: 3,
    workspaces: 2,
    messages: 3,
    memories: 2,
  });
  assert.equal(response.body.usersByPlan.free, 2);
  assert.equal(response.body.usersByPlan.premium, 1);
  assert.equal(response.body.usersByRole.user, 2);
  assert.equal(response.body.usersByRole.admin, 1);
  assert.ok(Array.isArray(response.body.recentUsers));
  assert.ok(Array.isArray(response.body.recentWorkspaces));
  assert.ok(Array.isArray(response.body.recentMemories));
  assert.ok(response.body.recentUsers.length <= 10);
  assert.ok(response.body.recentWorkspaces.length <= 10);
  assert.ok(response.body.recentMemories.length <= 10);
  assertNoSecrets(response.body);
});

test("4. users are paginated and ordered newest first", async () => {
  const admin = await makeUser("users-admin", {
    role: "admin",
    createdAt: new Date("2020-01-01T00:00:00.000Z"),
  });
  const oldest = await makeUser("users-oldest", {
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
  });
  const middle = await makeUser("users-middle", {
    createdAt: new Date("2024-02-01T00:00:00.000Z"),
  });
  const newest = await makeUser("users-newest", {
    createdAt: new Date("2024-03-01T00:00:00.000Z"),
  });

  const firstPage = await request(
    "/api/admin/users?page=1&limit=2",
    { token: admin.token }
  );
  assert.equal(firstPage.status, 200);
  assertPagination(firstPage.body, {
    page: 1,
    limit: 2,
    total: 4,
    pages: 2,
  });
  assert.deepEqual(
    firstPage.body.items.map((item) => item.email),
    [newest.user.email, middle.user.email]
  );

  const secondPage = await request(
    "/api/admin/users?page=2&limit=2",
    { token: admin.token }
  );
  assert.equal(secondPage.status, 200);
  assert.deepEqual(
    secondPage.body.items.map((item) => item.email),
    [oldest.user.email, admin.user.email]
  );
});

test("5. user search, role filter, and plan filter compose correctly", async () => {
  const admin = await makeUser("filters-admin", { role: "admin" });
  const alice = await makeUser("Alice-Roadrunner", {
    role: "user",
    plan: "premium",
  });
  await makeUser("Bob-Builder", {
    role: "user",
    plan: "free",
  });
  await makeUser("Other-Admin", {
    role: "admin",
    plan: "premium",
  });

  const query = new URLSearchParams({
    search: "roadrunner",
    role: "user",
    plan: "premium",
  });
  const response = await request(
    `/api/admin/users?${query}`,
    { token: admin.token }
  );

  assert.equal(response.status, 200);
  assertPagination(response.body, { total: 1, pages: 1 });
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.items[0].email, alice.user.email);
  assert.equal(response.body.items[0].role, "user");
  assert.equal(response.body.items[0].plan, "premium");
});

test("6. page size is hard-capped and malformed list filters are rejected", async (t) => {
  const admin = await makeUser("pagination-admin", { role: "admin" });
  await makeUser("pagination-user");

  const response = await request(
    "/api/admin/users?page=1&limit=1000",
    { token: admin.token }
  );

  assert.equal(response.status, 200);
  assertPagination(response.body, { page: 1, limit: 100 });
  assert.ok(response.body.items.length <= 100);

  const invalidPaths = [
    "/api/admin/users?role=owner",
    "/api/admin/users?plan=enterprise",
    "/api/admin/users?page=one",
    "/api/admin/users?page=10001",
    "/api/admin/workspaces?limit=many",
    "/api/admin/ai-usage?plan=enterprise",
    "/api/admin/memories?type=secret",
    "/api/admin/memories?importance=urgent",
    "/api/admin/memories?workspaceId=not-an-object-id",
  ];

  for (const path of invalidPaths) {
    await t.test(path, async () => {
      const invalidResponse = await request(path, {
        token: admin.token,
      });
      assert.equal(invalidResponse.status, 400);
      assertNoSecrets(invalidResponse.body);
    });
  }
});

test("7. admin user detail returns safe account, workspace, and AI information", async () => {
  const admin = await makeUser("detail-admin", { role: "admin" });
  const target = await makeUser("detail-target", { plan: "premium" });
  await makeWorkspace("Detail workspace one", [target.user]);
  await makeWorkspace("Detail workspace two", [admin.user, target.user]);
  await makeUsage(target.user, 7);

  const response = await request(
    `/api/admin/users/${target.user._id}`,
    { token: admin.token }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.user.id, target.user._id.toString());
  assert.equal(response.body.user.email, target.user.email);
  assert.equal(response.body.user.plan, "premium");
  assert.equal(response.body.workspaceCount, 2);
  assert.ok(Array.isArray(response.body.workspaces));
  assert.ok(response.body.workspaces.length <= 10);
  assert.equal(response.body.aiUsage.requestCount, 7);
  assert.equal(response.body.aiUsage.limit, 50);
  assertNoSecrets(response.body);
});

test("8. user list and detail never expose authentication secrets", async () => {
  const admin = await makeUser("safe-user-admin", { role: "admin" });
  const target = await makeUser("safe-user-target");

  const listResponse = await request("/api/admin/users", {
    token: admin.token,
  });
  const detailResponse = await request(
    `/api/admin/users/${target.user._id}`,
    { token: admin.token }
  );

  assert.equal(listResponse.status, 200);
  assert.equal(detailResponse.status, 200);
  assertNoSecrets(listResponse.body);
  assertNoSecrets(detailResponse.body);
});

test("9. user update rejects every field outside the role/plan allowlist", async (t) => {
  const admin = await makeUser("allowlist-admin", { role: "admin" });
  const target = await makeUser("allowlist-target");
  const attempts = [
    { email: "replacement@example.com" },
    { password: "replacement-password" },
    { name: "Replacement Name" },
    { _id: makeObjectId().toString() },
    { createdAt: new Date().toISOString() },
    { unknown: true },
    { $set: { plan: "premium" } },
    { plan: "premium", email: "mixed@example.com" },
  ];

  for (const body of attempts) {
    await t.test(JSON.stringify(body), async () => {
      const response = await request(
        `/api/admin/users/${target.user._id}`,
        {
          method: "PATCH",
          token: admin.token,
          body,
        }
      );
      assert.equal(response.status, 400);
      assertNoSecrets(response.body);
    });
  }

  const unchanged = await User.findById(target.user._id).select("+password");
  assert.equal(unchanged.email, target.user.email);
  assert.equal(unchanged.name, target.user.name);
  assert.equal(unchanged.plan, "free");
  assert.equal(unchanged.password, TEST_PASSWORD);
});

test("10. an empty user update is rejected", async () => {
  const admin = await makeUser("empty-update-admin", { role: "admin" });
  const target = await makeUser("empty-update-target");
  const response = await request(
    `/api/admin/users/${target.user._id}`,
    { method: "PATCH", token: admin.token, body: {} }
  );

  assert.equal(response.status, 400);
  assert.equal(
    (await User.findById(target.user._id)).plan,
    "free"
  );
});

test("11. an admin can apply a valid platform-role update", async () => {
  const admin = await makeUser("role-update-admin", { role: "admin" });
  const target = await makeUser("role-update-target");
  const response = await request(
    `/api/admin/users/${target.user._id}`,
    {
      method: "PATCH",
      token: admin.token,
      body: { role: "admin" },
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.user.role, "admin");
  assert.equal(
    (await User.findById(target.user._id)).role,
    "admin"
  );
  assertNoSecrets(response.body);
});

test("12. an admin can apply a valid plan update", async () => {
  const admin = await makeUser("plan-update-admin", { role: "admin" });
  const target = await makeUser("plan-update-target");
  const response = await request(
    `/api/admin/users/${target.user._id}`,
    {
      method: "PATCH",
      token: admin.token,
      body: { plan: "premium" },
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.user.plan, "premium");
  assert.equal(
    (await User.findById(target.user._id)).plan,
    "premium"
  );
  assertNoSecrets(response.body);
});

test("13. an invalid platform role is rejected without mutation", async () => {
  const admin = await makeUser("invalid-role-admin", { role: "admin" });
  const target = await makeUser("invalid-role-target");
  const response = await request(
    `/api/admin/users/${target.user._id}`,
    {
      method: "PATCH",
      token: admin.token,
      body: { role: "owner" },
    }
  );

  assert.equal(response.status, 400);
  assert.equal((await User.findById(target.user._id)).role, "user");
});

test("14. an invalid product plan is rejected without mutation", async () => {
  const admin = await makeUser("invalid-plan-admin", { role: "admin" });
  const target = await makeUser("invalid-plan-target");
  const response = await request(
    `/api/admin/users/${target.user._id}`,
    {
      method: "PATCH",
      token: admin.token,
      body: { plan: "enterprise" },
    }
  );

  assert.equal(response.status, 400);
  assert.equal((await User.findById(target.user._id)).plan, "free");
});

test("15. the last remaining admin cannot be demoted", async () => {
  const soleAdmin = await makeUser("last-admin", { role: "admin" });
  await makeUser("last-admin-normal-user");
  const response = await request(
    `/api/admin/users/${soleAdmin.user._id}`,
    {
      method: "PATCH",
      token: soleAdmin.token,
      body: { role: "user" },
    }
  );

  assert.equal(response.status, 409);
  assert.equal(
    (await User.findById(soleAdmin.user._id)).role,
    "admin"
  );
});

test("16. an admin may be demoted when another admin remains", async () => {
  const actingAdmin = await makeUser("acting-admin", { role: "admin" });
  const targetAdmin = await makeUser("target-admin", { role: "admin" });
  const response = await request(
    `/api/admin/users/${targetAdmin.user._id}`,
    {
      method: "PATCH",
      token: actingAdmin.token,
      body: { role: "user" },
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.user.role, "user");
  assert.equal(
    (await User.findById(targetAdmin.user._id)).role,
    "user"
  );
});

test("17. workspace list search returns correct related-document counts", async () => {
  const admin = await makeUser("workspace-list-admin", { role: "admin" });
  const member = await makeUser("workspace-list-member");
  const alpha = await makeWorkspace(
    "Alpha Counted Workspace",
    [admin.user, member.user]
  );
  const beta = await makeWorkspace(
    "Beta Other Workspace",
    [member.user]
  );
  const firstMessage = await makeMessage(
    alpha,
    admin.user,
    "Alpha message one"
  );
  await makeMessage(alpha, member.user, "Alpha message two");
  await makeMessage(beta, member.user, "Beta message");
  await Promise.all([
    makeMemory({
      workspace: alpha,
      createdBy: admin.user,
      content: "Alpha memory one",
      sourceMessageIds: [firstMessage._id],
    }),
    makeMemory({
      workspace: alpha,
      createdBy: member.user,
      content: "Alpha memory two",
    }),
    makeMemory({
      workspace: beta,
      createdBy: member.user,
      content: "Beta memory",
    }),
  ]);

  const response = await request(
    "/api/admin/workspaces?search=alpha&page=1&limit=10",
    { token: admin.token }
  );

  assert.equal(response.status, 200);
  assertPagination(response.body, {
    page: 1,
    limit: 10,
    total: 1,
    pages: 1,
  });
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.items[0].id, alpha._id.toString());
  assert.equal(response.body.items[0].memberCount, 2);
  assert.equal(response.body.items[0].messageCount, 2);
  assert.equal(response.body.items[0].memoryCount, 2);
  assertNoSecrets(response.body);
});

test("18. workspace detail is bounded, safe, and reports accurate counts", async () => {
  const admin = await makeUser("workspace-detail-admin", { role: "admin" });
  const member = await makeUser("workspace-detail-member", {
    plan: "premium",
  });
  const workspace = await makeWorkspace(
    "Workspace Detail Fixture",
    [admin.user, member.user]
  );
  const message = await makeMessage(
    workspace,
    member.user,
    "Workspace detail message"
  );
  await makeMemory({
    workspace,
    createdBy: member.user,
    type: "decision",
    content: "Workspace detail memory",
    importance: "high",
    sourceMessageIds: [message._id],
  });

  const response = await request(
    `/api/admin/workspaces/${workspace._id}`,
    { token: admin.token }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.workspace.id, workspace._id.toString());
  assert.equal(response.body.workspace.memberCount, 2);
  assert.equal(response.body.workspace.messageCount, 1);
  assert.equal(response.body.workspace.memoryCount, 1);
  assert.ok(Array.isArray(response.body.members));
  assert.equal(response.body.members.length, 2);
  assert.ok(response.body.recentMessages.length <= 10);
  assert.ok(response.body.recentMemories.length <= 10);
  assertNoSecrets(response.body);
});

test("19. AI usage exposes the one shared counter and plan-derived limits", async () => {
  const admin = await makeUser("usage-admin", { role: "admin" });
  const freeUser = await makeUser("Shared-Counter-Free", {
    plan: "free",
  });
  const premiumUser = await makeUser("Shared-Counter-Premium", {
    plan: "premium",
  });
  const freeWindow = new Date(Date.now() - 10 * 60 * 1000);
  const premiumWindow = new Date(Date.now() - 20 * 60 * 1000);
  await Promise.all([
    makeUsage(freeUser.user, 5, { windowStartedAt: freeWindow }),
    makeUsage(premiumUser.user, 7, { windowStartedAt: premiumWindow }),
  ]);

  const response = await request(
    "/api/admin/ai-usage?search=shared-counter&limit=20",
    { token: admin.token }
  );

  assert.equal(response.status, 200);
  assertPagination(response.body, { total: 2, pages: 1 });
  const freeItem = findUsageItem(response.body.items, freeUser.user);
  const premiumItem = findUsageItem(
    response.body.items,
    premiumUser.user
  );
  assert.ok(freeItem);
  assert.ok(premiumItem);
  assert.equal(readUsageCount(freeItem), 5);
  assert.equal(readUsageCount(premiumItem), 7);
  assert.equal(readUsageLimit(freeItem), 5);
  assert.equal(readUsageLimit(premiumItem), 50);
  assert.equal(readRateLimited(freeItem), true);
  assert.equal(readRateLimited(premiumItem), false);
  assert.match(String(freeItem.quotaScope), /shared.*user|user.*shared/i);
  assert.match(String(premiumItem.quotaScope), /shared.*user|user.*shared/i);
  assert.equal(new Date(freeItem.resetAt).getTime(),
    freeWindow.getTime() + 60 * 60 * 1000);
  assert.equal(new Date(premiumItem.resetAt).getTime(),
    premiumWindow.getTime() + 60 * 60 * 1000);

  const serialized = JSON.stringify(response.body).toLowerCase();
  assert.doesNotMatch(serialized, /asknovacalls|ask_nova_calls/);
  assert.doesNotMatch(serialized, /catchmeupcalls|catch_me_up_calls/);
  assert.doesNotMatch(serialized, /featureusage|usagebyfeature/);
  assertNoSecrets(response.body);
});

test("20. AI usage search and plan filters compose", async () => {
  const admin = await makeUser("usage-filter-admin", { role: "admin" });
  const matching = await makeUser("Needle-Premium-Usage", {
    plan: "premium",
  });
  const wrongPlan = await makeUser("Needle-Free-Usage", {
    plan: "free",
  });
  const wrongSearch = await makeUser("Other-Premium-Usage", {
    plan: "premium",
  });
  await Promise.all([
    makeUsage(matching.user, 9),
    makeUsage(wrongPlan.user, 4),
    makeUsage(wrongSearch.user, 8),
  ]);

  const response = await request(
    "/api/admin/ai-usage?search=needle&plan=premium",
    { token: admin.token }
  );

  assert.equal(response.status, 200);
  assertPagination(response.body, { total: 1, pages: 1 });
  assert.equal(response.body.items.length, 1);
  assert.equal(
    (response.body.items[0].user || response.body.items[0]).email,
    matching.user.email
  );
});

test("21. memory search and all requested filters compose", async () => {
  const admin = await makeUser("memory-list-admin", { role: "admin" });
  const author = await makeUser("memory-list-author");
  const alpha = await makeWorkspace(
    "Alpha Memory Workspace",
    [author.user]
  );
  const beta = await makeWorkspace(
    "Beta Memory Workspace",
    [author.user]
  );
  const sourceMessage = await makeMessage(
    alpha,
    author.user,
    "Memory source message"
  );
  const matching = await makeMemory({
    workspace: alpha,
    createdBy: author.user,
    type: "decision",
    content: "Adopt the Aurora roadmap for launch",
    importance: "high",
    sourceMessageIds: [sourceMessage._id],
  });
  await Promise.all([
    makeMemory({
      workspace: alpha,
      createdBy: author.user,
      type: "fact",
      content: "Aurora is the project codename",
      importance: "high",
    }),
    makeMemory({
      workspace: alpha,
      createdBy: author.user,
      type: "decision",
      content: "Use another roadmap",
      importance: "low",
    }),
    makeMemory({
      workspace: beta,
      createdBy: author.user,
      type: "decision",
      content: "Adopt the Aurora roadmap elsewhere",
      importance: "high",
    }),
  ]);

  const query = new URLSearchParams({
    search: "aurora roadmap",
    type: "decision",
    importance: "high",
    workspaceId: alpha._id.toString(),
    page: "1",
    limit: "20",
  });
  const response = await request(
    `/api/admin/memories?${query}`,
    { token: admin.token }
  );

  assert.equal(response.status, 200);
  assertPagination(response.body, {
    page: 1,
    limit: 20,
    total: 1,
    pages: 1,
  });
  assert.equal(response.body.items.length, 1);
  const item = response.body.items[0];
  assert.equal(item.id, matching._id.toString());
  assert.equal(item.type, "decision");
  assert.equal(item.importance, "high");
  assert.equal(item.content, matching.content);
  assert.equal(item.workspace.id, alpha._id.toString());
  assert.equal(item.workspace.name, alpha.name);
  assert.equal(item.createdBy.id, author.user._id.toString());
  assert.equal(item.sourceMessageIdsCount, 1);
  assert.equal(Object.hasOwn(item, "sourceMessageIds"), false);
  assertNoSecrets(response.body);
});

test("22. an admin can delete exactly one workspace memory", async () => {
  const admin = await makeUser("memory-delete-admin", { role: "admin" });
  const workspace = await makeWorkspace(
    "Memory Delete Workspace",
    [admin.user]
  );
  const target = await makeMemory({
    workspace,
    createdBy: admin.user,
    content: "Delete this platform-governed memory",
  });
  const survivor = await makeMemory({
    workspace,
    createdBy: admin.user,
    content: "Keep this platform-governed memory",
  });

  const response = await request(
    `/api/admin/memories/${target._id}`,
    { method: "DELETE", token: admin.token }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.deletedMemoryId, target._id.toString());
  assert.equal(typeof response.body.message, "string");
  assert.equal(await WorkspaceMemory.exists({ _id: target._id }), null);
  assert.ok(await WorkspaceMemory.exists({ _id: survivor._id }));
  assertNoSecrets(response.body);
});

test("23. deleting a memory never deletes any source message", async () => {
  const admin = await makeUser("source-delete-admin", { role: "admin" });
  const workspace = await makeWorkspace(
    "Source Preservation Workspace",
    [admin.user]
  );
  const source = await makeMessage(
    workspace,
    admin.user,
    "This source must remain"
  );
  const memory = await makeMemory({
    workspace,
    createdBy: admin.user,
    content: "Memory backed by a durable source message",
    sourceMessageIds: [source._id],
  });

  const response = await request(
    `/api/admin/memories/${memory._id}`,
    { method: "DELETE", token: admin.token }
  );

  assert.equal(response.status, 200);
  assert.equal(await WorkspaceMemory.exists({ _id: memory._id }), null);
  assert.ok(await Message.exists({ _id: source._id }));
});

test("24. malformed and nonexistent resource IDs fail safely", async (t) => {
  const admin = await makeUser("invalid-id-admin", { role: "admin" });
  const nonexistentId = makeObjectId().toString();
  const malformedChecks = [
    ["GET", "/api/admin/users/not-an-object-id", undefined, 400],
    [
      "PATCH",
      "/api/admin/users/not-an-object-id",
      { plan: "premium" },
      400,
    ],
    ["GET", "/api/admin/workspaces/not-an-object-id", undefined, 400],
    ["DELETE", "/api/admin/memories/not-an-object-id", undefined, 400],
  ];
  const missingChecks = [
    ["GET", `/api/admin/users/${nonexistentId}`, undefined, 404],
    [
      "PATCH",
      `/api/admin/users/${nonexistentId}`,
      { plan: "premium" },
      404,
    ],
    ["GET", `/api/admin/workspaces/${nonexistentId}`, undefined, 404],
    ["DELETE", `/api/admin/memories/${nonexistentId}`, undefined, 404],
  ];

  for (const [method, path, body, status] of [
    ...malformedChecks,
    ...missingChecks,
  ]) {
    await t.test(`${method} ${path}`, async () => {
      const response = await request(path, {
        method,
        token: admin.token,
        body,
      });
      assert.equal(response.status, status);
      assertNoSecrets(response.body);
      assert.doesNotMatch(response.text, /CastError|ValidationError|stack/i);
    });
  }
});

test("25. every admin read response recursively excludes secret fields", async () => {
  const admin = await makeUser("recursive-safe-admin", { role: "admin" });
  const member = await makeUser("recursive-safe-member", {
    plan: "premium",
  });
  const workspace = await makeWorkspace(
    "Recursive Safety Workspace",
    [admin.user, member.user]
  );
  const message = await makeMessage(
    workspace,
    member.user,
    "Recursive safety message"
  );
  await makeMemory({
    workspace,
    createdBy: member.user,
    content: "Recursive safety memory",
    sourceMessageIds: [message._id],
  });
  await makeUsage(member.user, 3);

  const paths = [
    "/api/admin/dashboard",
    "/api/admin/users",
    `/api/admin/users/${member.user._id}`,
    "/api/admin/workspaces",
    `/api/admin/workspaces/${workspace._id}`,
    "/api/admin/ai-usage",
    "/api/admin/memories",
  ];

  for (const path of paths) {
    const response = await request(path, { token: admin.token });
    assert.equal(response.status, 200, `${path} should succeed`);
    assertNoSecrets(response.body, path);
  }
});

test("26. malformed bodies and unknown admin routes return safe JSON", async () => {
  const admin = await makeUser("safe-error-admin", { role: "admin" });
  const target = await makeUser("safe-error-target");

  const malformedResponse = await fetch(
    `${baseUrl}/api/admin/users/${target.user._id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${admin.token}`,
        "Content-Type": "application/json",
      },
      body: "{not-valid-json",
      signal: AbortSignal.timeout(15000),
    }
  );
  const malformedText = await malformedResponse.text();
  const malformedBody = JSON.parse(malformedText);

  assert.equal(malformedResponse.status, 400);
  assert.equal(malformedBody.code, "INVALID_ADMIN_REQUEST_BODY");
  assert.match(
    malformedResponse.headers.get("cache-control") || "",
    /no-store/i
  );
  assert.doesNotMatch(malformedText, /SyntaxError|stack|at Object/i);
  assertNoSecrets(malformedBody);

  const unknownResponse = await request("/api/admin/not-a-route", {
    token: admin.token,
  });
  assert.equal(unknownResponse.status, 404);
  assert.equal(unknownResponse.body.code, "ADMIN_ROUTE_NOT_FOUND");
  assertNoSecrets(unknownResponse.body);
});

test("27. concurrent demotions cannot remove every platform admin", async () => {
  const firstAdmin = await makeUser("concurrent-admin-one", {
    role: "admin",
  });
  const secondAdmin = await makeUser("concurrent-admin-two", {
    role: "admin",
  });

  const results = await Promise.allSettled([
    updateUserWithAdminInvariant({
      userId: firstAdmin.user._id,
      updates: { role: "user" },
    }),
    updateUserWithAdminInvariant({
      userId: secondAdmin.user._id,
      updates: { role: "user" },
    }),
  ]);

  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1
  );
  const [rejectedResult] = results.filter(
    (result) => result.status === "rejected"
  );
  assert.ok(rejectedResult.reason instanceof LastPlatformAdminError);
  assert.equal(await User.countDocuments({ role: "admin" }), 1);
});

test("28. legacy users participate in default role and plan filters", async () => {
  const admin = await makeUser("legacy-filter-admin", { role: "admin" });
  const legacyId = makeObjectId();
  const now = new Date();

  await User.collection.insertOne({
    _id: legacyId,
    name: "Legacy Filter Account",
    email: "legacy-filter@admin.integration.test",
    password: TEST_PASSWORD,
    createdAt: now,
    updatedAt: now,
  });
  await AiUsageRateLimit.create({
    _id: `user_${legacyId}`,
    user: legacyId,
    requestCount: 2,
    windowStartedAt: now,
    expireAt: new Date(now.getTime() + 60 * 60 * 1000),
  });

  const [usersResponse, usageResponse, dashboardResponse] =
    await Promise.all([
      request(
        "/api/admin/users?search=legacy-filter&role=user&plan=free",
        { token: admin.token }
      ),
      request(
        "/api/admin/ai-usage?search=legacy-filter&plan=free",
        { token: admin.token }
      ),
      request("/api/admin/dashboard", { token: admin.token }),
    ]);

  assert.equal(usersResponse.status, 200);
  assert.equal(usersResponse.body.pagination.total, 1);
  assert.equal(usersResponse.body.items[0].role, "user");
  assert.equal(usersResponse.body.items[0].plan, "free");

  assert.equal(usageResponse.status, 200);
  assert.equal(usageResponse.body.pagination.total, 1);
  assert.equal(usageResponse.body.items[0].user.role, "user");
  assert.equal(usageResponse.body.items[0].plan, "free");

  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardResponse.body.usersByRole.user, 1);
  assert.equal(dashboardResponse.body.usersByRole.admin, 1);
  assert.equal(dashboardResponse.body.usersByPlan.free, 2);

  assertNoSecrets(usersResponse.body);
  assertNoSecrets(usageResponse.body);
  assertNoSecrets(dashboardResponse.body);
});

test("29. workspace detail caps member records and reports truncation", async () => {
  const admin = await makeUser("bounded-members-admin", { role: "admin" });
  const owner = await makeUser("bounded-members-owner");
  const additionalMembers = await Promise.all(
    Array.from({ length: 55 }, (_, index) =>
      makeUser(`bounded-member-${index}`)
    )
  );
  const workspace = await makeWorkspace(
    "Large bounded member workspace",
    [
      owner.user,
      ...additionalMembers.map((member) => member.user),
    ]
  );

  const response = await request(
    `/api/admin/workspaces/${workspace._id}`,
    { token: admin.token }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.workspace.memberCount, 56);
  assert.equal(response.body.members.length, 50);
  assert.equal(response.body.membersTruncated, true);
  assertNoSecrets(response.body);
});
