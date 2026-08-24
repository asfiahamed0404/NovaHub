/**
 * Workspace Agent HTTP Route Integration Tests
 *
 * Requires a dedicated MongoDB replica-set database whose name contains
 * "test". The agent runner is overridden so this suite never calls an AI
 * provider, while JWT, workspace authorization, and Mongo rate limiting run
 * through the real application stack.
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

const TEST_DATABASE_PATTERN = /(?:^|[-_])test(?:$|[-_])/i;
const testMongoUri = process.env.TEST_MONGO_URI;

if (!testMongoUri) {
  throw new Error(
    "TEST_MONGO_URI is required for Workspace Agent route integration tests."
  );
}

const parsedTestMongoUri = new URL(testMongoUri);
const testDatabaseName = decodeURIComponent(
  parsedTestMongoUri.pathname.replace(/^\//, "")
);

if (
  !testDatabaseName ||
  !TEST_DATABASE_PATTERN.test(testDatabaseName) ||
  process.env.CONFIRM_WORKSPACE_AGENT_ROUTE_TEST_DATABASE !==
    testDatabaseName ||
  (process.env.MONGO_URI && process.env.MONGO_URI === testMongoUri)
) {
  throw new Error(
    "Refusing Workspace Agent route integration tests: use a dedicated " +
      "database name containing 'test' and set " +
      "CONFIRM_WORKSPACE_AGENT_ROUTE_TEST_DATABASE to that exact name. " +
      "TEST_MONGO_URI must not equal MONGO_URI."
  );
}

process.env.JWT_SECRET = "novahub-workspace-agent-route-test-secret";
process.env.CLIENT_URL = "http://127.0.0.1:5173";
process.env.AI_SUMMARY_RATE_LIMIT_MAX = "3";
process.env.AI_FREE_SUMMARY_RATE_LIMIT_MAX = "3";
process.env.AI_PREMIUM_SUMMARY_RATE_LIMIT_MAX = "3";
process.env.AI_SUMMARY_RATE_LIMIT_WINDOW_MINUTES = "60";

const { default: app } = await import("../../app.js");
const { default: AiUsageRateLimit } = await import(
  "../../models/AiUsageRateLimit.js"
);
const { default: User } = await import("../../models/User.js");
const { default: Workspace } = await import(
  "../../models/Workspace.js"
);
const {
  resetWorkspaceAgentControllerOverrides,
  setWorkspaceAgentControllerOverrides,
} = await import("../../controllers/aiController.js");
const { AiProviderError } = await import(
  "../../services/ai/aiService.js"
);

let baseUrl;
let httpServer;
let identityCounter = 0;
let runnerCalls = [];

const safeAgentResult = Object.freeze({
  answer: "The team decided to deploy the backend on Railway.",
  toolsUsed: [
    "list_workspace_memories",
    "search_workspace_messages",
  ],
  steps: [
    {
      step: 1,
      tool: "list_workspace_memories",
      success: true,
    },
  ],
  rawObservations: ["private workspace dump"],
  systemPrompt: "hidden system prompt",
  reasoning: "hidden reasoning",
});

const defaultRunner = async (input) => {
  runnerCalls.push(input);
  return safeAgentResult;
};

const makeUser = async (label = "user", overrides = {}) => {
  identityCounter += 1;
  const user = await User.create({
    name: `${label} ${identityCounter}`,
    email: `${label}-${identityCounter}@agent-route.integration.test`,
    password: "integration-test-password-hash",
    ...overrides,
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

const makeWorkspace = async (members, createdBy = members[0]) =>
  Workspace.create({
    name: `Agent route workspace ${identityCounter}`,
    description: "Disposable Workspace Agent HTTP test",
    createdBy: createdBy._id,
    members: members.map((member) => member._id),
  });

const requestAgent = (
  workspaceId,
  token,
  body = { question: "What did we decide about deployment?" }
) => {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${baseUrl}/api/workspaces/${workspaceId}/ai/agent`, {
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
    "Workspace Agent route tests require a replica set"
  );

  await mongoose.connection.dropDatabase();
  await Promise.all([
    User.init(),
    Workspace.init(),
    AiUsageRateLimit.init(),
  ]);

  app.set("io", { to() { return { emit() {} }; } });

  httpServer = createServer(app);
  await new Promise((resolve) => {
    httpServer.listen(0, "127.0.0.1", resolve);
  });
  const address = httpServer.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  runnerCalls = [];
  setWorkspaceAgentControllerOverrides({ runner: defaultRunner });
  await Promise.all([
    AiUsageRateLimit.deleteMany({}),
    Workspace.deleteMany({}),
    User.deleteMany({}),
  ]);
});

after(async () => {
  resetWorkspaceAgentControllerOverrides();

  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test("1. unauthenticated request is rejected", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  const response = await requestAgent(workspace._id);

  assert.equal(response.status, 401);
  assert.equal(runnerCalls.length, 0);
});

test("2. non-workspace-member cannot invoke the agent", async () => {
  const owner = await makeUser("owner");
  const outsider = await makeUser("outsider");
  const workspace = await makeWorkspace([owner.user]);

  const response = await requestAgent(workspace._id, outsider.token);

  assert.equal(response.status, 403);
  assert.equal(response.body.code, "WORKSPACE_ACCESS_DENIED");
  assert.equal(runnerCalls.length, 0);
});

test("3. user without the existing AI entitlement is rejected", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);
  setWorkspaceAgentControllerOverrides({
    runner: defaultRunner,
    entitlementResolver: () => ({
      plan: "free",
      aiSummary: { enabled: false },
    }),
  });

  const response = await requestAgent(workspace._id, owner.token);

  assert.equal(response.status, 403);
  assert.equal(response.body.code, "AI_NOT_ENTITLED");
  assert.equal(runnerCalls.length, 0);
});

test("4. empty question is rejected", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  const response = await requestAgent(workspace._id, owner.token, {
    question: "   ",
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_AGENT_QUESTION");
  assert.equal(runnerCalls.length, 0);
});

test("5. oversized question is rejected", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  const response = await requestAgent(workspace._id, owner.token, {
    question: "x".repeat(2001),
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_AGENT_QUESTION");
  assert.equal(runnerCalls.length, 0);
});

test("6. valid member can invoke the agent", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  const response = await requestAgent(workspace._id, owner.token);

  assert.equal(response.status, 200);
  assert.equal(response.body.answer, safeAgentResult.answer);
  assert.equal(runnerCalls.length, 1);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("7. controller passes the current server-derived workspace role", async () => {
  const owner = await makeUser("owner");
  const member = await makeUser("member", { role: "admin" });
  const workspace = await makeWorkspace(
    [owner.user, member.user],
    owner.user
  );

  const response = await requestAgent(workspace._id, member.token, {
    question: "  What is our deployment decision?  ",
  });

  assert.equal(response.status, 200);
  assert.deepEqual(runnerCalls, [
    {
      workspaceId: workspace._id.toString(),
      userId: member.user._id.toString(),
      role: "admin",
      question: "What is our deployment decision?",
    },
  ]);
});

test("8. client-supplied role and userId are rejected", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  const response = await requestAgent(workspace._id, owner.token, {
    question: "What did we decide?",
    role: "owner",
    userId: new mongoose.Types.ObjectId().toString(),
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_AGENT_REQUEST");
  assert.equal(runnerCalls.length, 0);
});

test("9. a Workspace A member cannot query Workspace B", async () => {
  const workspaceAOwner = await makeUser("workspace-a-owner");
  const workspaceBOwner = await makeUser("workspace-b-owner");
  await makeWorkspace([workspaceAOwner.user]);
  const workspaceB = await makeWorkspace([workspaceBOwner.user]);

  const response = await requestAgent(
    workspaceB._id,
    workspaceAOwner.token
  );

  assert.equal(response.status, 403);
  assert.equal(response.body.code, "WORKSPACE_ACCESS_DENIED");
  assert.equal(runnerCalls.length, 0);
});

test("10. shared MongoDB AI rate limiting is enforced", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  for (let request = 1; request <= 3; request += 1) {
    const response = await requestAgent(workspace._id, owner.token);
    assert.equal(response.status, 200);
  }

  const limitedResponse = await requestAgent(
    workspace._id,
    owner.token
  );
  const usage = await AiUsageRateLimit.findById(
    `user_${owner.user._id.toString()}`
  ).lean();

  assert.equal(limitedResponse.status, 429);
  assert.equal(limitedResponse.body.code, "RATE_LIMIT_EXCEEDED");
  assert.ok(Number(limitedResponse.headers.get("retry-after")) > 0);
  assert.equal(usage.requestCount, 3);
  assert.equal(runnerCalls.length, 3);
});

test("11. provider error maps to a safe HTTP response", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);
  setWorkspaceAgentControllerOverrides({
    runner: async () => {
      throw new AiProviderError(
        503,
        "AI_PROVIDER_QUOTA_EXCEEDED",
        "The AI service is temporarily unavailable."
      );
    },
  });

  const response = await requestAgent(workspace._id, owner.token);

  assert.equal(response.status, 503);
  assert.deepEqual(response.body, {
    message: "The AI service is temporarily unavailable.",
    code: "AI_PROVIDER_QUOTA_EXCEEDED",
  });
});

test("12. response contains answer and safe trace only", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  const response = await requestAgent(workspace._id, owner.token);

  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body).sort(), [
    "answer",
    "steps",
    "toolsUsed",
  ]);
  assert.deepEqual(response.body.steps, safeAgentResult.steps);
  assert.deepEqual(response.body.toolsUsed, safeAgentResult.toolsUsed);
});

test("13. response excludes observations, prompts, and hidden reasoning", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  const response = await requestAgent(workspace._id, owner.token);
  const serializedResponse = JSON.stringify(response.body);

  assert.equal(response.status, 200);
  assert.equal(serializedResponse.includes("private workspace dump"), false);
  assert.equal(serializedResponse.includes("hidden system prompt"), false);
  assert.equal(serializedResponse.includes("hidden reasoning"), false);
  assert.equal("rawObservations" in response.body, false);
  assert.equal("systemPrompt" in response.body, false);
  assert.equal("reasoning" in response.body, false);
});

test("14. invalid and missing workspaces map to 400 and 404", async () => {
  const owner = await makeUser("owner");

  const invalidResponse = await requestAgent("invalid", owner.token);
  const missingResponse = await requestAgent(
    new mongoose.Types.ObjectId(),
    owner.token
  );

  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidResponse.body.code, "INVALID_WORKSPACE_ID");
  assert.equal(missingResponse.status, 404);
  assert.equal(missingResponse.body.code, "WORKSPACE_NOT_FOUND");
});

test("15. missing, non-string, and malformed bodies are rejected safely", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);

  const missingFetchResponse = await fetch(
    `${baseUrl}/api/workspaces/${workspace._id}/ai/agent`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${owner.token}` },
      signal: AbortSignal.timeout(15000),
    }
  );
  const missingResponse = {
    status: missingFetchResponse.status,
    body: await missingFetchResponse.json(),
  };
  const nonStringResponse = await requestAgent(
    workspace._id,
    owner.token,
    { question: 42 }
  );
  const malformedResponse = await fetch(
    `${baseUrl}/api/workspaces/${workspace._id}/ai/agent`,
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
  const malformedBody = await malformedResponse.json();

  assert.equal(missingResponse.status, 400);
  assert.equal(nonStringResponse.status, 400);
  assert.equal(malformedResponse.status, 400);
  assert.equal(malformedBody.code, "INVALID_AI_REQUEST_BODY");
  assert.equal(runnerCalls.length, 0);
});

test("16. unexpected failures do not expose internal details", async () => {
  const owner = await makeUser("owner");
  const workspace = await makeWorkspace([owner.user]);
  setWorkspaceAgentControllerOverrides({
    runner: async () => {
      throw new Error("mongodb://user:password@private-host/internal");
    },
  });

  const response = await requestAgent(workspace._id, owner.token);
  const serializedResponse = JSON.stringify(response.body);

  assert.equal(response.status, 500);
  assert.equal(response.body.code, "WORKSPACE_AGENT_FAILED");
  assert.equal(serializedResponse.includes("password"), false);
  assert.equal(serializedResponse.includes("private-host"), false);
});
