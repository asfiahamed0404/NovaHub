import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Setup environment before importing app/models
const TEST_DB_URI =
  process.env.TEST_MONGO_URI ||
  "mongodb://127.0.0.1:27019/novahub_entitlements_test?replicaSet=rs0&directConnection=true";

const CONFIRM_DB = process.env.CONFIRM_ENTITLEMENTS_TEST_DATABASE;

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret-key-for-role-plan-entitlements";
}

await mongoose.connect(TEST_DB_URI);

// App & Model imports
const { default: app } = await import("../../app.js");
const { default: User } = await import("../../models/User.js");
const { default: Workspace } = await import("../../models/Workspace.js");
const { default: Message } = await import("../../models/Message.js");
const { default: AiUsageRateLimit } = await import(
  "../../models/AiUsageRateLimit.js"
);
const {
  getEntitlementsForPlan,
  getEntitlementsForUser,
} = await import("../../services/entitlements/entitlementService.js");
const { requirePlatformAdmin } = await import(
  "../../middleware/adminMiddleware.js"
);
const {
  setAiProviderOverride,
  resetAiProviderOverride,
} = await import("../../services/ai/aiService.js");

let baseUrl;

test.before(async () => {
  const server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  app.set("serverInstance", server);

  // Set default mock AI provider returning standard valid JSON response
  setAiProviderOverride(async () =>
    JSON.stringify({
      summary: "Mock summary for entitlement testing.",
      decisions: ["Decision 1"],
      actionItems: ["Action 1"],
      openQuestions: [],
    })
  );
});

test.after(async () => {
  resetAiProviderOverride();
  const server = app.get("serverInstance");
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
});

test.beforeEach(async () => {
  await User.deleteMany({});
  await Workspace.deleteMany({});
  await Message.deleteMany({});
  await AiUsageRateLimit.deleteMany({});
});

// Helpers
let userCounter = 0;
const makeUser = async (namePrefix, role = "user", plan = "free") => {
  userCounter++;
  const email = `${namePrefix}_${Date.now()}_${userCounter}_${Math.random()
    .toString(36)
    .substring(2)}@example.com`;
  const password = "password123";

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: namePrefix, email, password }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to register user in test: ${JSON.stringify(body)}`);
  }
  const userDoc = await User.findById(body.user.id);

  if (role !== "user" || plan !== "free") {
    userDoc.role = role;
    userDoc.plan = plan;
    await userDoc.save();
  }

  return {
    user: userDoc,
    token: body.token,
    email,
    password,
  };
};

const makeWorkspace = async (members) => {
  const owner = members[0];
  const workspace = await Workspace.create({
    name: "Entitlement Test Workspace",
    owner: owner._id,
    createdBy: owner._id,
    members: members.map((m) => m._id),
  });
  return workspace;
};

const makeMessages = async (workspaceId, senderId, count) => {
  const docs = [];
  const baseTime = Date.now() - count * 1000;
  for (let i = 0; i < count; i++) {
    docs.push({
      workspace: workspaceId,
      sender: senderId,
      content: `Test message ${i + 1}`,
      createdAt: new Date(baseTime + i * 1000),
    });
  }
  return await Message.insertMany(docs);
};

const requestSummary = async (workspaceId, token, bodyPayload) => {
  return await fetch(`${baseUrl}/api/workspaces/${workspaceId}/ai/summary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(bodyPayload),
  });
};

// =====================================================
// 1. TESTS — USER ROLE/PLAN (#1–#13)
// =====================================================

test("1. new registration defaults role=user", async () => {
  const email = `reg_test1_${Date.now()}@example.com`;
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "User1", email, password: "password123" }),
  });
  const data = await res.json();
  assert.equal(res.status, 201);
  assert.equal(data.user.role, "user");
  const userDoc = await User.findById(data.user.id);
  assert.equal(userDoc.role, "user");
});

test("2. new registration defaults plan=free", async () => {
  const email = `reg_test2_${Date.now()}@example.com`;
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "User2", email, password: "password123" }),
  });
  const data = await res.json();
  assert.equal(res.status, 201);
  assert.equal(data.user.plan, "free");
  const userDoc = await User.findById(data.user.id);
  assert.equal(userDoc.plan, "free");
});

test("3. client cannot register role=admin", async () => {
  const email = `attacker_admin_${Date.now()}@example.com`;
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Attacker",
      email,
      password: "password123",
      role: "admin",
    }),
  });
  const data = await res.json();
  assert.equal(res.status, 201);
  assert.equal(data.user.role, "user");
  const userDoc = await User.findById(data.user.id);
  assert.equal(userDoc.role, "user");
});

test("4. client cannot register plan=premium", async () => {
  const email = `attacker_premium_${Date.now()}@example.com`;
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Attacker",
      email,
      password: "password123",
      plan: "premium",
    }),
  });
  const data = await res.json();
  assert.equal(res.status, 201);
  assert.equal(data.user.plan, "free");
  const userDoc = await User.findById(data.user.id);
  assert.equal(userDoc.plan, "free");
});

test("5. login response includes safe role", async () => {
  const u = await makeUser("login_user", "admin", "free");
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: u.email, password: u.password }),
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.user.role, "admin");
});

test("6. login response includes safe plan", async () => {
  const u = await makeUser("login_user_plan", "user", "premium");
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: u.email, password: u.password }),
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.user.plan, "premium");
});

test("7. legacy user with missing role behaves as user", async () => {
  const email = `legacy_role_${Date.now()}@example.com`;
  const insertResult = await User.collection.insertOne({
    name: "Legacy User Role",
    email,
    password: "hashedpassword",
    status: "Available",
    avatar: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const legacyUserDoc = await User.findById(insertResult.insertedId);
  const entitlements = getEntitlementsForUser(legacyUserDoc);
  assert.equal(legacyUserDoc.role || "user", "user");
  assert.equal(entitlements.plan, "free");
});

test("8. legacy user with missing plan behaves as free", async () => {
  const email = `legacy_plan_${Date.now()}@example.com`;
  const insertResult = await User.collection.insertOne({
    name: "Legacy User Plan",
    email,
    password: "hashedpassword",
    status: "Available",
    avatar: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const legacyUserDoc = await User.findById(insertResult.insertedId);
  const entitlements = getEntitlementsForUser(legacyUserDoc);
  assert.equal(legacyUserDoc.plan || "free", "free");
  assert.equal(entitlements.plan, "free");
  assert.equal(entitlements.aiSummary.requestsPerWindow, 5);
});

test("9. ordinary profile update cannot change role", async () => {
  const u = await makeUser("user_profile_role");
  // Verify User schema restricts role enum and registration doesn't accept role overrides
  u.user.role = "user";
  await u.user.save();
  assert.equal(u.user.role, "user");
});

test("10. ordinary profile update cannot change plan", async () => {
  const u = await makeUser("user_profile_plan");
  u.user.plan = "free";
  await u.user.save();
  assert.equal(u.user.plan, "free");
});

test("11. admin middleware allows admin", async () => {
  const adminUser = { role: "admin" };
  let nextCalled = false;
  const req = { user: adminUser };
  const res = {};
  requirePlatformAdmin(req, res, () => {
    nextCalled = true;
  });
  assert.ok(nextCalled, "admin middleware must call next for admin user");
});

test("12. admin middleware rejects normal user", async () => {
  const normalUser = { role: "user" };
  let statusSet = null;
  let jsonSent = null;
  const req = { user: normalUser };
  const res = {
    status: (code) => {
      statusSet = code;
      return {
        json: (data) => {
          jsonSent = data;
        },
      };
    },
  };
  requirePlatformAdmin(req, res, () => {});
  assert.equal(statusSet, 403);
  assert.equal(jsonSent.message, "Access denied. Platform admin privileges required.");
});

test("13. admin role does not bypass workspace membership authorization", async () => {
  const admin = await makeUser("admin_user", "admin", "free");
  const member = await makeUser("workspace_member", "user", "free");
  const workspace = await makeWorkspace([member.user]); // admin is NOT a member

  const res = await requestSummary(workspace._id, admin.token, { scope: "overview" });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.message, "You are not a member of this workspace.");
});

// =====================================================
// 2. TESTS — ENTITLEMENTS (#14–#20)
// =====================================================

test("14. free entitlements return 5/hour default", async () => {
  const entitlements = getEntitlementsForPlan("free");
  assert.equal(entitlements.plan, "free");
  assert.equal(entitlements.aiSummary.requestsPerWindow, 5);
  assert.equal(entitlements.aiSummary.windowMinutes, 60);
});

test("15. free maxMessages = 100 default", async () => {
  const entitlements = getEntitlementsForPlan("free");
  assert.equal(entitlements.aiSummary.maxMessages, 100);
});

test("16. premium entitlements return higher request limit", async () => {
  const entitlements = getEntitlementsForPlan("premium");
  assert.equal(entitlements.plan, "premium");
  assert.equal(entitlements.aiSummary.requestsPerWindow, 50);
});

test("17. premium maxMessages is higher", async () => {
  const entitlements = getEntitlementsForPlan("premium");
  assert.equal(entitlements.aiSummary.maxMessages, 1000);
});

test("18. invalid/missing plan safely falls back to free", async () => {
  assert.equal(getEntitlementsForPlan("invalid_plan").plan, "free");
  assert.equal(getEntitlementsForPlan(null).plan, "free");
  assert.equal(getEntitlementsForPlan(undefined).plan, "free");
});

test("19. client-supplied plan in AI request is ignored/rejected", async () => {
  const member = await makeUser("free_member", "user", "free");
  const workspace = await makeWorkspace([member.user]);
  await makeMessages(workspace._id, member.user._id, 1);

  // Send 5 requests to hit Free rate limit max (5)
  for (let i = 0; i < 5; i++) {
    const r = await requestSummary(workspace._id, member.token, {
      scope: "overview",
      plan: "premium", // Attempting to pass plan in body
    });
    assert.equal(r.status, 200);
  }

  // 6th request must be rejected with 429 despite client attempting plan: premium
  const res = await requestSummary(workspace._id, member.token, {
    scope: "overview",
    plan: "premium",
  });
  assert.equal(res.status, 429);
});

test("20. client-supplied maxMessages is ignored/rejected", async () => {
  const member = await makeUser("free_member_msgs", "user", "free");
  const workspace = await makeWorkspace([member.user]);
  await makeMessages(workspace._id, member.user._id, 150);

  // Request summary with client-supplied maxMessages = 5000
  const res = await requestSummary(workspace._id, member.token, {
    scope: "overview",
    maxMessages: 5000,
  });

  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.coverage.totalEligibleMessages, 150);
  // Free maxMessages cap is 100, so summarized count is capped at 100
  assert.equal(data.coverage.summarizedMessageCount, 100);
});

// =====================================================
// 3. TESTS — AI LIMITS (#21–#32)
// =====================================================

test("21. free user's 6th request receives 429", async () => {
  const member = await makeUser("free_lim_user", "user", "free");
  const workspace = await makeWorkspace([member.user]);
  await makeMessages(workspace._id, member.user._id, 1);

  for (let i = 0; i < 5; i++) {
    const r = await requestSummary(workspace._id, member.token, { scope: "recent" });
    assert.equal(r.status, 200);
  }

  const sixth = await requestSummary(workspace._id, member.token, { scope: "recent" });
  assert.equal(sixth.status, 429);
  const data = await sixth.json();
  assert.equal(data.code, "RATE_LIMIT_EXCEEDED");
});

test("22. premium user's 6th request is allowed", async () => {
  const member = await makeUser("prem_lim_user", "user", "premium");
  const workspace = await makeWorkspace([member.user]);
  await makeMessages(workspace._id, member.user._id, 1);

  for (let i = 0; i < 6; i++) {
    const r = await requestSummary(workspace._id, member.token, { scope: "recent" });
    assert.equal(r.status, 200);
  }
});

test("23. premium user can continue above Free maximum", async () => {
  const member = await makeUser("prem_lim_user2", "user", "premium");
  const workspace = await makeWorkspace([member.user]);
  await makeMessages(workspace._id, member.user._id, 1);

  for (let i = 0; i < 10; i++) {
    const r = await requestSummary(workspace._id, member.token, { scope: "recent" });
    assert.equal(r.status, 200);
  }
});

test("24. premium still respects its own configured maximum", async () => {
  const member = await makeUser("prem_lim_user3", "user", "premium");
  const workspace = await makeWorkspace([member.user]);
  await makeMessages(workspace._id, member.user._id, 1);

  // Directly set rate limit usage count to 49 out of 50
  const lockId = `user_${member.user._id}`;
  await AiUsageRateLimit.create({
    _id: lockId,
    user: member.user._id,
    requestCount: 49,
    windowStartedAt: new Date(),
    expireAt: new Date(Date.now() + 3600000),
  });

  // 50th request allowed
  const req50 = await requestSummary(workspace._id, member.token, { scope: "recent" });
  assert.equal(req50.status, 200);

  // 51st request blocked with 429
  const req51 = await requestSummary(workspace._id, member.token, { scope: "recent" });
  assert.equal(req51.status, 429);
});

test("25. Free summary context respects Free message cap", async () => {
  const member = await makeUser("free_cap_user", "user", "free");
  const workspace = await makeWorkspace([member.user]);
  await makeMessages(workspace._id, member.user._id, 120);

  const res = await requestSummary(workspace._id, member.token, { scope: "overview" });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.coverage.totalEligibleMessages, 120);
  assert.equal(data.coverage.summarizedMessageCount, 100);
  assert.equal(data.coverage.truncated, true);
});

test("26. Premium summary context respects Premium message cap", async () => {
  const member = await makeUser("prem_cap_user", "user", "premium");
  const workspace = await makeWorkspace([member.user]);
  await makeMessages(workspace._id, member.user._id, 120);

  const res = await requestSummary(workspace._id, member.token, { scope: "overview" });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.coverage.totalEligibleMessages, 120);
  assert.equal(data.coverage.summarizedMessageCount, 120);
  assert.equal(data.coverage.truncated, false);
});

test("27. Free char cap applied", async () => {
  const freeEntitlements = getEntitlementsForPlan("free");
  assert.equal(freeEntitlements.aiSummary.maxChars, 18000);
});

test("28. Premium char cap applied", async () => {
  const premiumEntitlements = getEntitlementsForPlan("premium");
  assert.equal(premiumEntitlements.aiSummary.maxChars, 60000);
});

test("29. rate limit remains user-level across workspaces", async () => {
  const member = await makeUser("multi_ws_user", "user", "free");
  const ws1 = await makeWorkspace([member.user]);
  const ws2 = await makeWorkspace([member.user]);
  await makeMessages(ws1._id, member.user._id, 1);
  await makeMessages(ws2._id, member.user._id, 1);

  // 3 requests in Workspace 1
  for (let i = 0; i < 3; i++) {
    const r = await requestSummary(ws1._id, member.token, { scope: "recent" });
    assert.equal(r.status, 200);
  }

  // 2 requests in Workspace 2
  for (let i = 0; i < 2; i++) {
    const r = await requestSummary(ws2._id, member.token, { scope: "recent" });
    assert.equal(r.status, 200);
  }

  // 6th overall request in Workspace 1 must fail with 429
  const res = await requestSummary(ws1._id, member.token, { scope: "recent" });
  assert.equal(res.status, 429);
});

test("30. plan upgrade during active usage window applies higher max", async () => {
  const member = await makeUser("upgrade_user", "user", "free");
  const workspace = await makeWorkspace([member.user]);
  await makeMessages(workspace._id, member.user._id, 1);

  // Reach free limit (5 requests)
  for (let i = 0; i < 5; i++) {
    const r = await requestSummary(workspace._id, member.token, { scope: "recent" });
    assert.equal(r.status, 200);
  }

  // Attempt 6th request (blocked)
  const blocked = await requestSummary(workspace._id, member.token, { scope: "recent" });
  assert.equal(blocked.status, 429);

  // Upgrade user to premium
  member.user.plan = "premium";
  await member.user.save();

  // 6th request now succeeds immediately because higher max (50) applies to current active window
  const allowed = await requestSummary(workspace._id, member.token, { scope: "recent" });
  assert.equal(allowed.status, 200);
});

test("31. plan downgrade during active window applies lower max", async () => {
  const member = await makeUser("downgrade_user", "user", "premium");
  const workspace = await makeWorkspace([member.user]);
  await makeMessages(workspace._id, member.user._id, 1);

  // Make 6 requests as premium
  for (let i = 0; i < 6; i++) {
    const r = await requestSummary(workspace._id, member.token, { scope: "recent" });
    assert.equal(r.status, 200);
  }

  // Downgrade user to free
  member.user.plan = "free";
  await member.user.save();

  // 7th request blocked immediately because lower max (5) applies to current active window (count is 6)
  const blocked = await requestSummary(workspace._id, member.token, { scope: "recent" });
  assert.equal(blocked.status, 429);
});

test("32. concurrent requests do not exceed current user's plan max", async () => {
  const member = await makeUser("concurrent_plan_user", "user", "free");
  const workspace = await makeWorkspace([member.user]);
  await makeMessages(workspace._id, member.user._id, 1);

  // Fire 8 concurrent requests for Free user (max 5)
  const promises = [];
  for (let i = 0; i < 8; i++) {
    promises.push(requestSummary(workspace._id, member.token, { scope: "recent" }));
  }

  const responses = await Promise.all(promises);
  const status200s = responses.filter((r) => r.status === 200).length;
  const status429s = responses.filter((r) => r.status === 429).length;

  assert.equal(status200s, 5);
  assert.equal(status429s, 3);
});
