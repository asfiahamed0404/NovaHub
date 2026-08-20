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

const TEST_DATABASE_PATTERN =
  /(?:^|[-_])test(?:$|[-_])/i;
const testMongoUri = process.env.TEST_MONGO_URI;

if (!testMongoUri) {
  throw new Error(
    "TEST_MONGO_URI is required for invitation integration tests."
  );
}

const parsedTestMongoUri = new URL(testMongoUri);
const testDatabaseName = decodeURIComponent(
  parsedTestMongoUri.pathname.replace(/^\//, "")
);

if (
  !testDatabaseName ||
  !TEST_DATABASE_PATTERN.test(testDatabaseName) ||
  process.env.CONFIRM_INVITATION_TEST_DATABASE !==
    testDatabaseName ||
  (process.env.MONGO_URI &&
    process.env.MONGO_URI === testMongoUri)
) {
  throw new Error(
    "Refusing invitation integration tests: use a dedicated database name containing 'test' and set CONFIRM_INVITATION_TEST_DATABASE to that exact name. TEST_MONGO_URI must not equal MONGO_URI."
  );
}

process.env.JWT_SECRET =
  "novahub-invitation-integration-test-secret";
process.env.CLIENT_URL = "http://127.0.0.1:5173";
process.env.INVITE_EXPIRY_HOURS = "24";
process.env.INVITE_CREATION_RATE_LIMIT_MAX = "100";
process.env.INVITE_CREATION_RATE_LIMIT_WINDOW_MINUTES =
  "15";
process.env.INVITE_MAX_ACTIVE_PER_MEMBER = "100";
process.env.INVITE_MAX_ACTIVE_PER_WORKSPACE = "100";

const { default: app } = await import("../../app.js");
const { default: Invitation } = await import(
  "../../models/Invitation.js"
);
const { default: InvitationCreationLock } = await import(
  "../../models/InvitationCreationLock.js"
);
const { default: User } = await import(
  "../../models/User.js"
);
const { default: Workspace } = await import(
  "../../models/Workspace.js"
);
const {
  generateInvitationToken,
  hashInvitationToken,
} = await import("../../utils/invitationToken.js");

let baseUrl;
let httpServer;
let identityCounter = 0;
let emittedEvents = [];

const resetAbuseConfig = () => {
  process.env.INVITE_CREATION_RATE_LIMIT_MAX = "100";
  process.env.INVITE_CREATION_RATE_LIMIT_WINDOW_MINUTES =
    "15";
  process.env.INVITE_MAX_ACTIVE_PER_MEMBER = "100";
  process.env.INVITE_MAX_ACTIVE_PER_WORKSPACE = "100";
};

const makeUser = async (label) => {
  identityCounter += 1;
  const user = await User.create({
    name: `${label} ${identityCounter}`,
    email:
      `${label}-${identityCounter}@integration.test`.toLowerCase(),
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
    name: `Integration workspace ${identityCounter}`,
    description: "Disposable invitation integration test",
    createdBy: members[0]._id,
    members: members.map((member) => member._id),
  });

const seedInvitation = async ({
  workspace,
  createdBy,
  expiresAt = new Date(Date.now() + 60 * 60 * 1000),
  revokedAt = null,
  revokedBy = null,
}) => {
  const rawToken = generateInvitationToken();
  const invitation = await Invitation.create({
    workspace: workspace._id,
    tokenHash: hashInvitationToken(rawToken),
    createdBy: createdBy._id,
    expiresAt,
    revokedAt,
    revokedBy,
  });

  return { invitation, rawToken };
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

  const response = await fetch(`${baseUrl}${path}`, options);
  const responseText = await response.text();
  let responseBody = null;

  if (responseText) {
    responseBody = JSON.parse(responseText);
  }

  return {
    body: responseBody,
    headers: response.headers,
    status: response.status,
    text: responseText,
  };
};

const createInvitationOverHttp = (
  workspaceId,
  memberToken
) =>
  request(`/api/workspaces/${workspaceId}/invitations`, {
    method: "POST",
    token: memberToken,
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

  const hello = await mongoose.connection.db.command({
    hello: 1,
  });
  assert.equal(
    typeof hello.setName,
    "string",
    "Invitation integration tests require a replica set"
  );

  await mongoose.connection.dropDatabase();
  await Promise.all([
    User.init(),
    Workspace.init(),
    Invitation.init(),
    InvitationCreationLock.init(),
  ]);

  app.set("io", {
    to(room) {
      return {
        emit(event, payload) {
          emittedEvents.push({ event, payload, room });
        },
      };
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
  resetAbuseConfig();
  emittedEvents = [];
  await Promise.all([
    Invitation.deleteMany({}),
    InvitationCreationLock.deleteMany({}),
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

test("1. creation stores only a hash of the raw token", async () => {
  const member = await makeUser("creator");
  const workspace = await makeWorkspace([member.user]);
  const response = await createInvitationOverHttp(
    workspace._id,
    member.token
  );

  assert.equal(response.status, 201);
  const rawToken = response.body.invitation.token;
  assert.match(rawToken, /^[A-Za-z0-9_-]{43}$/);

  const storedInvitation = await Invitation.findById(
    response.body.invitation.id
  ).select("+tokenHash");
  assert.equal(
    storedInvitation.tokenHash,
    hashInvitationToken(rawToken)
  );
  assert.notEqual(storedInvitation.tokenHash, rawToken);
  assert.equal(
    Object.hasOwn(storedInvitation.toObject(), "token"),
    false
  );

  const tokenIndex = (
    await Invitation.collection.indexes()
  ).find((index) => index.key.tokenHash === 1);
  assert.equal(tokenIndex?.unique, true);
});

test("2. a non-member cannot create an invitation", async () => {
  const member = await makeUser("member");
  const outsider = await makeUser("outsider");
  const workspace = await makeWorkspace([member.user]);
  const response = await createInvitationOverHttp(
    workspace._id,
    outsider.token
  );

  assert.equal(response.status, 403);
  assert.equal(
    response.body.code,
    "WORKSPACE_INVITATION_FORBIDDEN"
  );
  assert.equal(await Invitation.countDocuments(), 0);
  assert.equal(
    await InvitationCreationLock.countDocuments(),
    0
  );
});

test("3. unauthenticated create and accept requests fail", async () => {
  const member = await makeUser("member");
  const workspace = await makeWorkspace([member.user]);
  const { invitation, rawToken } = await seedInvitation({
    workspace,
    createdBy: member.user,
  });

  const createResponse = await request(
    `/api/workspaces/${workspace._id}/invitations`,
    { method: "POST" }
  );
  const acceptResponse = await request(
    `/api/invitations/${rawToken}/accept`,
    { method: "POST" }
  );

  assert.equal(createResponse.status, 401);
  assert.equal(acceptResponse.status, 401);
  const storedInvitation = await Invitation.findById(
    invitation._id
  );
  assert.equal(storedInvitation.usedAt, null);
});

test("4. malformed tokens fail safely", async () => {
  const user = await makeUser("user");
  const preview = await request("/api/invitations/not-a-token");
  const accept = await request(
    "/api/invitations/not-a-token/accept",
    { method: "POST", token: user.token }
  );

  for (const response of [preview, accept]) {
    assert.equal(response.status, 400);
    assert.equal(
      response.body.code,
      "INVALID_INVITATION_TOKEN"
    );
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.text.includes("tokenHash"), false);
  }
});

test("5. an expired invitation cannot be accepted", async () => {
  const creator = await makeUser("creator");
  const invitee = await makeUser("invitee");
  const workspace = await makeWorkspace([creator.user]);
  const { invitation, rawToken } = await seedInvitation({
    workspace,
    createdBy: creator.user,
    expiresAt: new Date(Date.now() - 1000),
  });
  const response = await request(
    `/api/invitations/${rawToken}/accept`,
    { method: "POST", token: invitee.token }
  );

  assert.equal(response.status, 410);
  assert.equal(response.body.code, "INVITATION_EXPIRED");
  const [storedInvitation, storedWorkspace] =
    await Promise.all([
      Invitation.findById(invitation._id),
      Workspace.findById(workspace._id),
    ]);
  assert.equal(storedInvitation.usedAt, null);
  assert.equal(
    storedWorkspace.members.some((id) =>
      id.equals(invitee.user._id)
    ),
    false
  );
});

test("6. a revoked invitation cannot be accepted", async () => {
  const creator = await makeUser("creator");
  const invitee = await makeUser("invitee");
  const workspace = await makeWorkspace([creator.user]);
  const { invitation, rawToken } = await seedInvitation({
    workspace,
    createdBy: creator.user,
    revokedAt: new Date(),
    revokedBy: creator.user._id,
  });
  const response = await request(
    `/api/invitations/${rawToken}/accept`,
    { method: "POST", token: invitee.token }
  );

  assert.equal(response.status, 410);
  assert.equal(response.body.code, "INVITATION_REVOKED");
  const storedInvitation = await Invitation.findById(
    invitation._id
  );
  assert.equal(storedInvitation.usedAt, null);
});

test("7. valid acceptance adds exactly one membership", async () => {
  const creator = await makeUser("creator");
  const invitee = await makeUser("invitee");
  const workspace = await makeWorkspace([creator.user]);
  const { rawToken } = await seedInvitation({
    workspace,
    createdBy: creator.user,
  });
  const response = await request(
    `/api/invitations/${rawToken}/accept`,
    { method: "POST", token: invitee.token }
  );

  assert.equal(response.status, 200);
  const storedWorkspace = await Workspace.findById(
    workspace._id
  );
  assert.equal(
    storedWorkspace.members.filter((id) =>
      id.equals(invitee.user._id)
    ).length,
    1
  );
});

test("8. successful acceptance consumes the invitation", async () => {
  const creator = await makeUser("creator");
  const invitee = await makeUser("invitee");
  const workspace = await makeWorkspace([creator.user]);
  const { invitation, rawToken } = await seedInvitation({
    workspace,
    createdBy: creator.user,
  });

  const response = await request(
    `/api/invitations/${rawToken}/accept`,
    { method: "POST", token: invitee.token }
  );
  assert.equal(response.status, 200);

  const storedInvitation = await Invitation.findById(
    invitation._id
  );
  assert.ok(storedInvitation.usedAt instanceof Date);
  assert.equal(
    storedInvitation.usedBy.toString(),
    invitee.user._id.toString()
  );
});

test("9. a same-user acceptance retry is idempotent", async () => {
  const creator = await makeUser("creator");
  const invitee = await makeUser("invitee");
  const workspace = await makeWorkspace([creator.user]);
  const { rawToken } = await seedInvitation({
    workspace,
    createdBy: creator.user,
  });

  const first = await request(
    `/api/invitations/${rawToken}/accept`,
    { method: "POST", token: invitee.token }
  );
  const second = await request(
    `/api/invitations/${rawToken}/accept`,
    { method: "POST", token: invitee.token }
  );

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(
    second.body.message,
    "Invitation was already accepted by this user"
  );
  const storedWorkspace = await Workspace.findById(
    workspace._id
  );
  assert.equal(
    storedWorkspace.members.filter((id) =>
      id.equals(invitee.user._id)
    ).length,
    1
  );
  assert.equal(emittedEvents.length, 1);
});

test("10. a second user cannot consume a used invitation", async () => {
  const creator = await makeUser("creator");
  const firstInvitee = await makeUser("first");
  const secondInvitee = await makeUser("second");
  const workspace = await makeWorkspace([creator.user]);
  const { rawToken } = await seedInvitation({
    workspace,
    createdBy: creator.user,
  });

  const first = await request(
    `/api/invitations/${rawToken}/accept`,
    { method: "POST", token: firstInvitee.token }
  );
  const second = await request(
    `/api/invitations/${rawToken}/accept`,
    { method: "POST", token: secondInvitee.token }
  );

  assert.equal(first.status, 200);
  assert.equal(second.status, 410);
  assert.equal(second.body.code, "INVITATION_ALREADY_USED");
  const storedWorkspace = await Workspace.findById(
    workspace._id
  );
  assert.equal(
    storedWorkspace.members.some((id) =>
      id.equals(secondInvitee.user._id)
    ),
    false
  );
});

test("11. already-member handling leaves the invite unused", async () => {
  const creator = await makeUser("creator");
  const existingMember = await makeUser("existing");
  const workspace = await makeWorkspace([
    creator.user,
    existingMember.user,
  ]);
  const { invitation, rawToken } = await seedInvitation({
    workspace,
    createdBy: creator.user,
  });
  const response = await request(
    `/api/invitations/${rawToken}/accept`,
    { method: "POST", token: existingMember.token }
  );

  assert.equal(response.status, 409);
  assert.equal(response.body.code, "ALREADY_WORKSPACE_MEMBER");
  const storedInvitation = await Invitation.findById(
    invitation._id
  );
  assert.equal(storedInvitation.usedAt, null);
  assert.equal(storedInvitation.usedBy, null);
});

test("12. a deleted workspace cannot be previewed or accepted", async () => {
  const creator = await makeUser("creator");
  const invitee = await makeUser("invitee");
  const workspace = await makeWorkspace([creator.user]);
  const { invitation, rawToken } = await seedInvitation({
    workspace,
    createdBy: creator.user,
  });
  await Workspace.deleteOne({ _id: workspace._id });

  const preview = await request(
    `/api/invitations/${rawToken}`
  );
  const accept = await request(
    `/api/invitations/${rawToken}/accept`,
    { method: "POST", token: invitee.token }
  );

  assert.equal(preview.status, 410);
  assert.equal(accept.status, 410);
  assert.equal(
    preview.body.code,
    "INVITATION_WORKSPACE_NOT_FOUND"
  );
  assert.equal(
    accept.body.code,
    "INVITATION_WORKSPACE_NOT_FOUND"
  );
  const storedInvitation = await Invitation.findById(
    invitation._id
  );
  assert.equal(storedInvitation.usedAt, null);
});

test("13. two users racing for one token grant one membership", async () => {
  const creator = await makeUser("creator");
  const firstInvitee = await makeUser("first");
  const secondInvitee = await makeUser("second");
  const workspace = await makeWorkspace([creator.user]);
  const { invitation, rawToken } = await seedInvitation({
    workspace,
    createdBy: creator.user,
  });

  const results = await Promise.all([
    request(`/api/invitations/${rawToken}/accept`, {
      method: "POST",
      token: firstInvitee.token,
    }),
    request(`/api/invitations/${rawToken}/accept`, {
      method: "POST",
      token: secondInvitee.token,
    }),
  ]);

  assert.deepEqual(
    results.map((result) => result.status).sort(),
    [200, 410]
  );
  const [storedWorkspace, storedInvitation] =
    await Promise.all([
      Workspace.findById(workspace._id),
      Invitation.findById(invitation._id),
    ]);
  const competingIds = new Set([
    firstInvitee.user._id.toString(),
    secondInvitee.user._id.toString(),
  ]);
  const grantedMembers = storedWorkspace.members.filter(
    (id) => competingIds.has(id.toString())
  );
  assert.equal(grantedMembers.length, 1);
  assert.equal(
    grantedMembers[0].toString(),
    storedInvitation.usedBy.toString()
  );
  assert.equal(emittedEvents.length, 1);
});

test("14. transaction rollback leaves no partial state", async () => {
  const creator = await makeUser("creator");
  const invitee = await makeUser("invitee");
  const workspace = await makeWorkspace([creator.user]);
  const { invitation, rawToken } = await seedInvitation({
    workspace,
    createdBy: creator.user,
  });
  const originalUpdateOne = Workspace.updateOne;
  Workspace.updateOne = async () => {
    throw new Error("Injected membership failure");
  };

  let response;
  try {
    response = await request(
      `/api/invitations/${rawToken}/accept`,
      { method: "POST", token: invitee.token }
    );
  } finally {
    Workspace.updateOne = originalUpdateOne;
  }

  assert.equal(response.status, 500);
  assert.equal(response.body.code, "INVITATION_REQUEST_FAILED");
  const [storedInvitation, storedWorkspace] =
    await Promise.all([
      Invitation.findById(invitation._id),
      Workspace.findById(workspace._id),
    ]);
  assert.equal(storedInvitation.usedAt, null);
  assert.equal(storedInvitation.usedBy, null);
  assert.equal(
    storedWorkspace.members.some((id) =>
      id.equals(invitee.user._id)
    ),
    false
  );
  assert.equal(emittedEvents.length, 0);
});

test("15. invitation listing never returns token material", async () => {
  const member = await makeUser("member");
  const workspace = await makeWorkspace([member.user]);
  const created = await createInvitationOverHttp(
    workspace._id,
    member.token
  );
  assert.equal(created.status, 201);

  const listed = await request(
    `/api/workspaces/${workspace._id}/invitations`,
    { token: member.token }
  );

  assert.equal(listed.status, 200);
  assert.equal(listed.body.invitations.length, 1);
  assert.equal(listed.text.includes("tokenHash"), false);
  assert.equal(
    listed.text.includes(created.body.invitation.token),
    false
  );
  assert.equal(
    Object.hasOwn(listed.body.invitations[0], "token"),
    false
  );
});

test("16. revocation prevents future acceptance", async () => {
  const member = await makeUser("member");
  const invitee = await makeUser("invitee");
  const workspace = await makeWorkspace([member.user]);
  const created = await createInvitationOverHttp(
    workspace._id,
    member.token
  );
  assert.equal(created.status, 201);

  const revoked = await request(
    `/api/workspaces/${workspace._id}/invitations/${created.body.invitation.id}/revoke`,
    { method: "PATCH", token: member.token }
  );
  const accepted = await request(
    `/api/invitations/${created.body.invitation.token}/accept`,
    { method: "POST", token: invitee.token }
  );

  assert.equal(revoked.status, 200);
  assert.equal(revoked.body.invitation.status, "revoked");
  assert.equal(accepted.status, 410);
  assert.equal(accepted.body.code, "INVITATION_REVOKED");
  const storedWorkspace = await Workspace.findById(
    workspace._id
  );
  assert.equal(
    storedWorkspace.members.some((id) =>
      id.equals(invitee.user._id)
    ),
    false
  );
});

test("17. rate limits and active invitation caps hold", async () => {
  process.env.INVITE_CREATION_RATE_LIMIT_MAX = "2";
  const rateMember = await makeUser("rate");
  const rateWorkspace = await makeWorkspace([
    rateMember.user,
  ]);
  const rateResults = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    rateResults.push(
      await createInvitationOverHttp(
        rateWorkspace._id,
        rateMember.token
      )
    );
  }
  assert.deepEqual(
    rateResults.map((result) => result.status),
    [201, 201, 429]
  );
  assert.equal(
    rateResults[2].body.code,
    "INVITATION_CREATION_RATE_LIMITED"
  );
  assert.ok(Number(rateResults[2].headers.get("retry-after")) >= 1);

  process.env.INVITE_CREATION_RATE_LIMIT_MAX = "100";
  process.env.INVITE_MAX_ACTIVE_PER_MEMBER = "1";
  const capMember = await makeUser("member-cap");
  const capWorkspace = await makeWorkspace([capMember.user]);
  const firstMemberInvite = await createInvitationOverHttp(
    capWorkspace._id,
    capMember.token
  );
  const secondMemberInvite = await createInvitationOverHttp(
    capWorkspace._id,
    capMember.token
  );
  assert.equal(firstMemberInvite.status, 201);
  assert.equal(secondMemberInvite.status, 409);
  assert.equal(
    secondMemberInvite.body.code,
    "INVITATION_MEMBER_ACTIVE_LIMIT_REACHED"
  );

  process.env.INVITE_MAX_ACTIVE_PER_MEMBER = "10";
  process.env.INVITE_MAX_ACTIVE_PER_WORKSPACE = "1";
  const firstWorkspaceMember = await makeUser("workspace-a");
  const secondWorkspaceMember = await makeUser("workspace-b");
  const workspaceCapWorkspace = await makeWorkspace([
    firstWorkspaceMember.user,
    secondWorkspaceMember.user,
  ]);
  const firstWorkspaceInvite =
    await createInvitationOverHttp(
      workspaceCapWorkspace._id,
      firstWorkspaceMember.token
    );
  const secondWorkspaceInvite =
    await createInvitationOverHttp(
      workspaceCapWorkspace._id,
      secondWorkspaceMember.token
    );
  assert.equal(firstWorkspaceInvite.status, 201);
  assert.equal(secondWorkspaceInvite.status, 409);
  assert.equal(
    secondWorkspaceInvite.body.code,
    "INVITATION_WORKSPACE_ACTIVE_LIMIT_REACHED"
  );

  process.env.INVITE_MAX_ACTIVE_PER_MEMBER = "1";
  process.env.INVITE_MAX_ACTIVE_PER_WORKSPACE = "10";
  const concurrentMember = await makeUser("concurrent-cap");
  const concurrentWorkspace = await makeWorkspace([
    concurrentMember.user,
  ]);
  const concurrentResults = await Promise.all([
    createInvitationOverHttp(
      concurrentWorkspace._id,
      concurrentMember.token
    ),
    createInvitationOverHttp(
      concurrentWorkspace._id,
      concurrentMember.token
    ),
  ]);
  assert.deepEqual(
    concurrentResults
      .map((result) => result.status)
      .sort(),
    [201, 409]
  );
  assert.equal(
    await Invitation.countDocuments({
      workspace: concurrentWorkspace._id,
      usedAt: null,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }),
    1
  );
});
