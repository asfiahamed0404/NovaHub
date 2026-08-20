import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  after,
  afterEach,
  before,
  beforeEach,
  test,
} from "node:test";

import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { io as createSocketClient } from "socket.io-client";

const TEST_DATABASE_PATTERN =
  /(?:^|[-_])test(?:$|[-_])/i;
const testMongoUri = process.env.TEST_MONGO_URI;

if (!testMongoUri) {
  throw new Error(
    "TEST_MONGO_URI is required for invitation socket integration tests."
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
    "Refusing invitation socket tests: use a dedicated database name containing 'test' and set CONFIRM_INVITATION_TEST_DATABASE to that exact name. TEST_MONGO_URI must not equal MONGO_URI."
  );
}

process.env.JWT_SECRET =
  "novahub-invitation-socket-integration-secret";
process.env.CLIENT_URL = "http://127.0.0.1:5173";

const { default: app } = await import("../../app.js");
const { default: Invitation } = await import(
  "../../models/Invitation.js"
);
const { default: User } = await import(
  "../../models/User.js"
);
const { default: Workspace } = await import(
  "../../models/Workspace.js"
);
const { default: setupSocket } = await import(
  "../../sockets/socketHandler.js"
);
const {
  generateInvitationToken,
  hashInvitationToken,
} = await import("../../utils/invitationToken.js");

let baseUrl;
let httpServer;
let ioServer;
let identityCounter = 0;
const clientSockets = new Set();

const waitForEvent = (
  socket,
  event,
  timeoutMilliseconds = 5000
) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, handleEvent);
      reject(
        new Error(`Timed out waiting for ${event}.`)
      );
    }, timeoutMilliseconds);

    const handleEvent = (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    };

    socket.once(event, handleEvent);
  });

const makeSocketClient = (token, overrides = {}) => {
  const auth = token === undefined ? {} : { token };
  const socket = createSocketClient(baseUrl, {
    auth,
    autoConnect: false,
    forceNew: true,
    reconnection: false,
    transports: ["websocket"],
    ...overrides,
  });
  clientSockets.add(socket);
  return socket;
};

const connectSocket = async (token, overrides) => {
  const socket = makeSocketClient(token, overrides);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out connecting socket."));
    }, 5000);
    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
    };
    const handleConnect = () => {
      cleanup();
      resolve();
    };
    const handleConnectError = (error) => {
      cleanup();
      reject(error);
    };

    socket.once("connect", handleConnect);
    socket.once("connect_error", handleConnectError);
    socket.connect();
  });

  return socket;
};

const joinWorkspaceRoom = async (socket, workspaceId) => {
  const joined = waitForEvent(socket, "joined_workspace");
  socket.emit("join_workspace", workspaceId.toString());
  return joined;
};

const makeUser = async (label) => {
  identityCounter += 1;
  const user = await User.create({
    name: `${label} ${identityCounter}`,
    email:
      `${label}-${identityCounter}@socket.integration.test`.toLowerCase(),
    password: "socket-integration-test-password-hash",
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
    name: `Socket workspace ${identityCounter}`,
    description: "Disposable Socket.IO invitation test",
    createdBy: members[0]._id,
    members: members.map((member) => member._id),
  });

const seedInvitation = async (workspace, creator) => {
  const rawToken = generateInvitationToken();
  const invitation = await Invitation.create({
    workspace: workspace._id,
    tokenHash: hashInvitationToken(rawToken),
    createdBy: creator._id,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  return { invitation, rawToken };
};

const acceptInvitation = async (rawToken, token) => {
  const response = await fetch(
    `${baseUrl}/api/invitations/${rawToken}/accept`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(15000),
    }
  );
  const body = await response.json();

  return { body, status: response.status };
};

before(async () => {
  await mongoose.connect(testMongoUri, {
    serverSelectionTimeoutMS: 10000,
  });
  assert.equal(mongoose.connection.name, testDatabaseName);

  const hello = await mongoose.connection.db.command({
    hello: 1,
  });
  assert.equal(
    typeof hello.setName,
    "string",
    "Invitation socket tests require a replica set"
  );

  await mongoose.connection.dropDatabase();
  await Promise.all([
    User.init(),
    Workspace.init(),
    Invitation.init(),
  ]);

  httpServer = createServer(app);
  ioServer = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ["GET", "POST"],
    },
  });
  app.set("io", ioServer);
  setupSocket(ioServer);

  await new Promise((resolve) => {
    httpServer.listen(0, "127.0.0.1", resolve);
  });
  const address = httpServer.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  await Promise.all([
    Invitation.deleteMany({}),
    Workspace.deleteMany({}),
    User.deleteMany({}),
  ]);
});

afterEach(() => {
  for (const socket of clientSockets) {
    socket.removeAllListeners();
    socket.disconnect();
  }
  clientSockets.clear();
});

after(async () => {
  for (const socket of clientSockets) {
    socket.disconnect();
  }

  if (ioServer) {
    await new Promise((resolve) => {
      ioServer.close(resolve);
    });
  }

  if (httpServer?.listening) {
    await new Promise((resolve) => {
      httpServer.close(resolve);
    });
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test("1. Socket.IO handshake requires a valid JWT", async () => {
  for (const token of [undefined, "invalid.jwt.token"]) {
    const socket = makeSocketClient(token);
    const errorPromise = waitForEvent(
      socket,
      "connect_error"
    );
    socket.connect();
    const error = await errorPromise;
    assert.match(
      error.message,
      /token is required|authentication failed/i
    );
    assert.equal(socket.connected, false);
  }
});

test("2. a member joins once through the existing room flow", async () => {
  const member = await makeUser("member");
  const workspace = await makeWorkspace([member.user]);
  const socket = await connectSocket(member.token);

  const firstJoin = await joinWorkspaceRoom(
    socket,
    workspace._id
  );
  const secondJoin = await joinWorkspaceRoom(
    socket,
    workspace._id
  );

  assert.equal(
    firstJoin.workspaceId,
    workspace._id.toString()
  );
  assert.equal(
    secondJoin.workspaceId,
    workspace._id.toString()
  );
  assert.equal(
    ioServer.sockets.adapter.rooms.get(
      workspace._id.toString()
    )?.size,
    1
  );
});

test("3. room joining never grants database membership", async () => {
  const member = await makeUser("member");
  const outsider = await makeUser("outsider");
  const workspace = await makeWorkspace([member.user]);
  const socket = await connectSocket(outsider.token);
  const errorPromise = waitForEvent(socket, "socket_error");

  socket.emit("join_workspace", workspace._id.toString());
  const error = await errorPromise;

  assert.match(error.message, /not allowed/i);
  assert.equal(
    ioServer.sockets.adapter.rooms
      .get(workspace._id.toString())
      ?.has(socket.id) || false,
    false
  );
  const storedWorkspace = await Workspace.findById(
    workspace._id
  );
  assert.equal(
    storedWorkspace.members.some((id) =>
      id.equals(outsider.user._id)
    ),
    false
  );
});

test("4. connected members receive workspace_updated after commit", async () => {
  const creator = await makeUser("creator");
  const invitee = await makeUser("invitee");
  const workspace = await makeWorkspace([creator.user]);
  const { invitation, rawToken } = await seedInvitation(
    workspace,
    creator.user
  );
  const creatorSocket = await connectSocket(creator.token);
  await joinWorkspaceRoom(creatorSocket, workspace._id);

  const committedEvent = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error("Timed out waiting for workspace_updated.")
      );
    }, 5000);

    creatorSocket.once(
      "workspace_updated",
      async (payload) => {
        try {
          const [storedWorkspace, storedInvitation] =
            await Promise.all([
              Workspace.findById(workspace._id),
              Invitation.findById(invitation._id),
            ]);
          clearTimeout(timeout);
          resolve({
            payload,
            storedInvitation,
            storedWorkspace,
          });
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      }
    );
  });

  const response = await acceptInvitation(
    rawToken,
    invitee.token
  );
  const event = await committedEvent;

  assert.equal(response.status, 200);
  assert.equal(
    event.storedWorkspace.members.some((id) =>
      id.equals(invitee.user._id)
    ),
    true
  );
  assert.ok(event.storedInvitation.usedAt instanceof Date);
  assert.equal(
    event.storedInvitation.usedBy.toString(),
    invitee.user._id.toString()
  );
  assert.equal(
    event.payload.members.some(
      (memberPayload) =>
        memberPayload._id === invitee.user._id.toString()
    ),
    true
  );
});

test("5. an accepted user joins through the normal authenticated flow", async () => {
  const creator = await makeUser("creator");
  const invitee = await makeUser("invitee");
  const workspace = await makeWorkspace([creator.user]);
  const { rawToken } = await seedInvitation(
    workspace,
    creator.user
  );
  const inviteeSocket = await connectSocket(invitee.token);

  const deniedPromise = waitForEvent(
    inviteeSocket,
    "socket_error"
  );
  inviteeSocket.emit(
    "join_workspace",
    workspace._id.toString()
  );
  const denied = await deniedPromise;
  assert.match(denied.message, /not allowed/i);

  const response = await acceptInvitation(
    rawToken,
    invitee.token
  );
  assert.equal(response.status, 200);

  const joined = await joinWorkspaceRoom(
    inviteeSocket,
    workspace._id
  );
  assert.equal(joined.workspaceId, workspace._id.toString());
  assert.equal(
    ioServer.sockets.adapter.rooms
      .get(workspace._id.toString())
      ?.has(inviteeSocket.id),
    true
  );
});

test("6. an idempotent acceptance retry emits no duplicate update", async () => {
  const creator = await makeUser("creator");
  const invitee = await makeUser("invitee");
  const workspace = await makeWorkspace([creator.user]);
  const { rawToken } = await seedInvitation(
    workspace,
    creator.user
  );
  const creatorSocket = await connectSocket(creator.token);
  await joinWorkspaceRoom(creatorSocket, workspace._id);

  const firstEvent = waitForEvent(
    creatorSocket,
    "workspace_updated"
  );
  const firstResponse = await acceptInvitation(
    rawToken,
    invitee.token
  );
  await firstEvent;
  assert.equal(firstResponse.status, 200);

  let duplicateEventReceived = false;
  const duplicateHandler = () => {
    duplicateEventReceived = true;
  };
  creatorSocket.on("workspace_updated", duplicateHandler);
  const retryResponse = await acceptInvitation(
    rawToken,
    invitee.token
  );
  await new Promise((resolve) => {
    setTimeout(resolve, 250);
  });
  creatorSocket.off("workspace_updated", duplicateHandler);

  assert.equal(retryResponse.status, 200);
  assert.equal(duplicateEventReceived, false);
});

test("7. reconnecting clients reauthenticate and rejoin the room", async () => {
  const member = await makeUser("member");
  const workspace = await makeWorkspace([member.user]);
  const socket = makeSocketClient(member.token, {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 25,
    reconnectionDelayMax: 50,
  });
  let connectionCount = 0;
  let joinedCount = 0;

  const rejoined = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Socket did not reconnect and rejoin."));
    }, 7000);

    socket.on("connect", () => {
      connectionCount += 1;
      socket.emit(
        "join_workspace",
        workspace._id.toString()
      );
    });
    socket.on("connect_error", (error) => {
      if (connectionCount === 0) {
        clearTimeout(timeout);
        reject(error);
      }
    });
    socket.on("joined_workspace", () => {
      joinedCount += 1;

      if (joinedCount === 1) {
        setTimeout(() => {
          socket.io.engine.close();
        }, 10);
        return;
      }

      clearTimeout(timeout);
      resolve();
    });
  });

  socket.connect();
  await rejoined;

  assert.equal(connectionCount, 2);
  assert.equal(joinedCount, 2);
  assert.equal(
    ioServer.sockets.adapter.rooms
      .get(workspace._id.toString())
      ?.has(socket.id),
    true
  );
});
