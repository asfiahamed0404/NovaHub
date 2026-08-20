<div align="center">

# 🚀 NovaHub

### Real-Time Workspace Collaboration Platform

A production-deployed MERN collaboration platform with secure authentication, expiring workspace invitations, real-time messaging, live member updates, responsive themes, and automatic recovery after network interruptions.

<br />

[![React](https://img.shields.io/badge/React-Frontend-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-API-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![Vite](https://img.shields.io/badge/Vite-Build-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-Styling-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

<br />

### 🌐 Live Application

**[Open NovaHub](https://nova-hub-sage.vercel.app)**

Frontend hosted on **Vercel** · Backend hosted on **Railway** · Database hosted on **MongoDB Atlas**

</div>

---

## ✨ Highlights

| 🔐 Authentication & Security | ⚡ Real-Time Collaboration |
|---|---|
| JWT-based authentication | Socket.IO workspace rooms |
| bcrypt password hashing | Instant workspace messaging |
| Protected API routes | Live member updates |
| Protected React routes | Duplicate message prevention |
| Authenticated socket connections | Persistent MongoDB message history |
| Workspace membership validation | Automatic socket reconnection |
| Hashed, expiring invite tokens | Membership updates after invite acceptance |

| 🏢 Workspace Management | 🔄 Connection Recovery |
|---|---|
| Create workspaces | Detect connection loss |
| Share single-use invitation links | Show reconnecting status |
| Join existing workspaces | Preserve invite flow through authentication |
| Leave workspaces | Disable messaging while disconnected |
| Creator protection | Automatically rejoin workspace rooms |
| Member authorization | Fetch messages missed while offline |
| Live member count updates | Merge recovered messages without duplicates |

---

## 📸 Screenshots

### Login

<div align="center">
  <img src="./docs/screenshots/login.png" alt="NovaHub Login Page" width="850" />
</div>

<br />

### Workspace Dashboard

<div align="center">
  <img src="./docs/screenshots/dashboard.png" alt="NovaHub Dashboard" width="850" />
</div>

<br />

### Real-Time Workspace Chat

<div align="center">
  <img src="./docs/screenshots/workspace-chat.png" alt="NovaHub Workspace Chat" width="850" />
</div>

<br />

### Connection Recovery

<div align="center">
  <img src="./docs/screenshots/reconnect.png" alt="NovaHub Reconnection Status" width="850" />
</div>

---

## 🎥 NovaHub in Action

<div align="center">

<img
  src="./docs/demo/novahub-realtime-demo.gif"
  alt="NovaHub real-time collaboration demo"
  width="900"
/>

<br />

**Two-user real-time messaging, connection recovery, and missed-message synchronization.**

<br />

[▶ Watch the Full Demo](./docs/demo/novahub-realtime-demo.mp4)

</div>

### Demo Highlights

- ⚡ Instant two-user real-time messaging
- 💬 Socket.IO workspace communication
- 📡 Connection-loss detection
- 🔄 Automatic reconnection
- 📨 Messages sent while a user is offline
- ♻️ Automatic missed-message recovery
- ✅ Recovery without manually refreshing

## 🎯 What is NovaHub?

NovaHub is a full-stack collaboration application built while learning and applying the MERN stack.

The project started as a simple chat application and gradually evolved into a production-ready workspace platform with authentication, authorization, persistent messaging, Socket.IO communication, deployment, responsive UI, and real-world connection recovery.

Users can create workspaces, collaborate with other members, exchange messages instantly, and continue working even after temporary network interruptions.

---

## 🧩 Architecture

```text
┌──────────────────────────────────────┐
│              Browser                 │
│                                      │
│        React + Vite + Tailwind       │
│              Vercel                  │
└──────────────────┬───────────────────┘
                   │
             HTTPS / Socket.IO
                   │
                   ▼
┌──────────────────────────────────────┐
│           Node.js + Express          │
│                                      │
│        REST API + Socket.IO          │
│              Railway                 │
└──────────────────┬───────────────────┘
                   │
                Mongoose
                   │
                   ▼
┌──────────────────────────────────────┐
│           MongoDB Atlas              │
│                                      │
│   Users · Workspaces · Messages      │
└──────────────────────────────────────┘
```

---

## ⚡ Real-Time Messaging Flow

When a workspace member sends a message:

```text
User A
  │
  │ POST /messages
  ▼
Express Controller
  │
  ├── Validate workspace membership
  │
  ├── Save message to MongoDB
  │
  └── Emit "new_message"
          │
          ▼
   Socket.IO Workspace Room
          │
          ├───────────────┐
          ▼               ▼
       User A          User B
```

Messages are permanently stored in MongoDB while Socket.IO provides immediate delivery to currently connected workspace members.

---

## 🔄 Network Recovery

Real-time systems must handle temporary connection failures.

NovaHub detects when a user's connection is lost and automatically restores the chat when connectivity returns.

```text
Connection lost
      │
      ▼
Show reconnecting status
      │
      ▼
Disable message composer
      │
      ▼
Socket.IO reconnects
      │
      ▼
Rejoin workspace room
      │
      ▼
Fetch latest message history
      │
      ▼
Merge messages using _id
      │
      ▼
Recover messages missed offline
      │
      ▼
Resume real-time messaging
```

The user does **not** need to manually refresh the page to recover missed messages.

---

## 🔐 Authentication Flow

```text
Register / Login
      │
      ▼
Express Authentication API
      │
      ├── bcrypt password verification
      │
      └── JWT generated
              │
              ▼
        React AuthContext
              │
              ▼
       Protected Routes
```

The same JWT is also supplied during the Socket.IO handshake so that real-time connections are authenticated.

---

## 🏢 Workspace Authorization

Joining a workspace in the database and joining a Socket.IO room are intentionally separate operations.

```text
MongoDB membership
      │
      │ persistent authorization
      ▼
User belongs to workspace
      │
      ▼
Socket authentication
      │
      ▼
Backend checks membership
      │
      ▼
socket.join(workspaceId)
```

A user cannot simply provide a room ID and gain access to workspace events.

---

## 🔗 Secure Workspace Invitations

NovaHub's MVP keeps its existing membership authorization model: any authenticated current member may create an invitation, while non-members cannot. It does not invent owner/admin/member roles.

### Invitation API contract

| Method and route | Authentication/authorization | Success contract |
|---|---|---|
| `POST /api/workspaces/:workspaceId/invitations` | Valid JWT and current workspace membership | `201`; returns safe `id`, `expiresAt`, and `invitation.token` once |
| `GET /api/workspaces/:workspaceId/invitations` | Valid JWT and current workspace membership | `200`; returns bounded safe invitation metadata with derived status |
| `PATCH /api/workspaces/:workspaceId/invitations/:invitationId/revoke` | Valid JWT and current workspace membership; invitation must be active | `200`; atomically records `revokedAt`/`revokedBy` |
| `GET /api/invitations/:token` | Public safe preview | `200`; returns only `invitation.workspace.name` and `expiresAt`, never the workspace ID, hash, or member list |
| `POST /api/invitations/:token/accept` | Valid JWT; user must not already be a member unless retrying their own completed acceptance | `200`; returns the populated workspace after acceptance or an idempotent same-user retry |

Invitation errors use a stable `{ message, code }` shape (except the existing JWT middleware's `401` response):

- `400` — `INVALID_WORKSPACE_ID` or `INVALID_INVITATION_TOKEN`
- `401` — missing, invalid, or expired JWT on creation/acceptance
- `403` — `WORKSPACE_INVITATION_FORBIDDEN` when a non-member tries to create an invite
- `404` — `WORKSPACE_NOT_FOUND` during creation, `INVITATION_NOT_FOUND` for an unknown token, or generic `INVITATION_ROUTE_NOT_FOUND` for an unsupported invitation endpoint
- `409` — `ALREADY_WORKSPACE_MEMBER`, invitation revocation conflicts, or `INVITATION_MEMBER_ACTIVE_LIMIT_REACHED` / `INVITATION_WORKSPACE_ACTIVE_LIMIT_REACHED`
- `410` — `INVITATION_EXPIRED`, `INVITATION_ALREADY_USED`, `INVITATION_REVOKED`, or `INVITATION_WORKSPACE_NOT_FOUND`
- `429` — `INVITATION_CREATION_RATE_LIMITED`, including `Retry-After` and `retryAfterSeconds`
- `500` — generic `INVITATION_REQUEST_FAILED` without internal error details

The frontend maps those invitation codes to malformed, missing, expired, used, deleted-workspace, and already-member states.

Workspace invitation management uses an optional `limit` query parameter from 1 through 100 (default 50) and returns newest records first with `count`, `limit`, and `hasMore`. Each invitation is serialized through an explicit allowlist containing only `id`, creator/consumer/revoker identity metadata, lifecycle timestamps, and derived `status`; neither `tokenHash` nor a raw token can appear. Revocation is an atomic conditional update restricted to active invitations. Attempts to revoke used, expired, or already-revoked records return `409` with a specific code and safe current status, while an invitation ID outside the authorized workspace is treated as not found.

### Invitation creation abuse protection

Invitation creation uses MongoDB-backed member-rate and workspace-serialization locks plus a transaction, so concurrent requests and multiple Railway instances evaluate the same committed state before a new record is inserted. The rolling rate limit atomically counts each member's authorized creation attempts within a workspace, including attempts rejected by an active cap; unauthorized callers are rejected before they can consume the allowance. Active caps count only unused, unrevoked, unexpired invitations. A per-member cap and a workspace-wide cap prevent one member or a group of members from creating an unbounded number of live bearer links.

| Environment variable | Default | Accepted range |
|---|---:|---:|
| `INVITE_CREATION_RATE_LIMIT_MAX` | `10` | 1–1000 |
| `INVITE_CREATION_RATE_LIMIT_WINDOW_MINUTES` | `15` | 1–1440 |
| `INVITE_MAX_ACTIVE_PER_MEMBER` | `10` | 1–1000 |
| `INVITE_MAX_ACTIVE_PER_WORKSPACE` | `100` | 1–10000 |

Missing, malformed, zero, negative, or out-of-range values fall back independently to the documented defaults. Creation already relies on the same transaction-capable MongoDB deployment required by invitation acceptance; there is no unsafe standalone-database fallback.

### Legacy join-by-ID compatibility

Secure invitation links are the canonical admission flow. `POST /api/workspaces/:id/join` returns `410 LEGACY_WORKSPACE_JOIN_DISABLED` unless the backend explicitly sets `ENABLE_LEGACY_WORKSPACE_JOIN=true`. The dashboard likewise hides the workspace-ID form unless the frontend is built with `VITE_ENABLE_LEGACY_WORKSPACE_JOIN=true`; both flags are required for the old browser flow. Missing, false, or unrecognized values keep compatibility disabled.

The Socket.IO `join_workspace` event is not an admission route and remains enabled. It only lets an authenticated user who is already present in `Workspace.members` enter the realtime room after normal page navigation or reconnection.

### Invitation data model

| Field | Purpose |
|---|---|
| `workspace` | Indexed reference to the target workspace |
| `tokenHash` | Unique, immutable SHA-256 digest; excluded from normal query selection |
| `createdBy` | Immutable reference to the member who created the invite |
| `expiresAt` | Indexed, immutable server-calculated expiry |
| `usedAt` / `usedBy` | Null until the one successful acceptance, then record when/by whom it was consumed |
| `revokedAt` / `revokedBy` | Null unless an active invitation is revoked, then record when/by whom it was revoked |
| `createdAt` / `updatedAt` | Mongoose timestamps |

Lifecycle status is derived from these timestamps rather than persisted as a mutable string. Precedence is `used`, then `revoked`, then `expired`, otherwise `active`, keeping terminal states distinguishable even after their original expiry time. The regular `expiresAt` index supports state lookups but is not a TTL index, so lifecycle records remain available.

### Security and acceptance flow

```text
Authenticated workspace member
      │ POST create + server-side membership check
      ▼
crypto.randomBytes(32) → 43-character base64url raw token
      │
      ├── raw token returned once to the frontend
      │     └── window.location.origin + /invite/<token>
      │
      └── SHA-256 → 64-character hexadecimal tokenHash
              └── only the hash is stored in MongoDB

Visitor opens link → backend hashes token → validates invite/workspace/state
      │
      ├── signed out: login/register with /invite/<token> return state
      │
      └── signed in: explicit Accept invitation action
              │
              ▼
MongoDB transaction
  ├── reject an existing member without consuming the invite
  ├── conditionally claim unused + unexpired invite (usedAt/usedBy)
  └── add membership with $addToSet
              │ commit first
              ▼
emit existing workspace_updated event → navigate to workspace
```

SHA-256 is appropriate here because the raw token already has 256 bits of cryptographic randomness; the stored digest prevents a database reader from directly using the invitation. The raw URL is still a bearer credential until it expires or is used.

The browser validates the exact 43-character `[A-Za-z0-9_-]` token shape before requesting a preview. A valid signed-out visitor is sent to login with only a strictly validated `/invite/<token>` React Router return path; login/register links preserve it, successful authentication returns to it, and acceptance is never automatic. The invitation dialog builds a newly created URL from `window.location.origin`, keeps that raw link only in component memory, shows expiry/copy feedback, and provides clipboard fallback behavior. The same dialog lists allowlisted active/recent metadata and can revoke active invitations, but it never tries to reconstruct an older URL from its hash. Acceptance navigates with React Router to the existing workspace page, whose normal fetch refreshes workspace state without a full reload.

The database transaction is the source of truth. A retry by the user who already consumed the token returns the committed workspace without adding another member or emitting another event; every other user is blocked from reuse. When compatibility is explicitly enabled, the legacy join mutation still uses atomic `$addToSet`; leave uses `$pull`, so neither overwrites or duplicates a membership change racing invite acceptance.

`workspace_updated` is emitted only after commit, so Socket.IO notifies connected room members but is never treated as persistent membership storage or a delivery guarantee. The invited user joins the room through the existing authenticated `join_workspace` membership check after opening the workspace. After a reconnect and successful room rejoin, the frontend refreshes both missed messages and protected workspace state from MongoDB-backed REST endpoints, recovering membership updates that arrived while offline. Invitation API responses use `Cache-Control: no-store`, including normalized malformed-body, malformed-URI, and unexpected middleware failures. Those failures return generic JSON without stack traces or internal error details. The Vercel configuration denies framing to protect the explicit Accept action from clickjacking.

---

## 🛠️ Tech Stack

### Frontend

- React
- Vite
- JavaScript
- Tailwind CSS
- React Router
- Axios
- Socket.IO Client

### Backend

- Node.js
- Express
- MongoDB
- Mongoose
- Socket.IO
- JSON Web Tokens
- bcryptjs
- dotenv
- CORS

### Deployment

| Layer | Platform |
|---|---|
| Frontend | Vercel |
| Backend | Railway |
| Database | MongoDB Atlas |
| Source Control | GitHub |

---

## 🎨 UI & Accessibility

NovaHub includes:

- Light theme
- Dark theme
- System theme
- Persistent theme preference
- Responsive desktop and mobile layouts
- Accessible focus states
- Reduced-motion support
- Loading states
- Empty states
- Error states
- Connection-status feedback

Theme preference supports:

```text
Light
Dark
System
```

When `System` is selected, NovaHub responds to changes in the operating system's color preference.

---

## 📁 Project Structure

```text
NovaHub/
│
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── sockets/
│   ├── app.js
│   ├── server.js
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   └── socket/
│   │
│   ├── .env.example
│   ├── vercel.json
│   └── package.json
│
├── docs/
│   ├── screenshots/
│   │   ├── login.png
│   │   ├── dashboard.png
│   │   ├── workspace-chat.png
│   │   └── reconnect.png
│   │
│   └── testing/
│
└── README.md
```

---

## ⚙️ Local Development

### Prerequisites

Make sure you have:

- Node.js
- npm
- MongoDB Atlas or another transaction-capable replica set/sharded MongoDB deployment
- Git

### 1. Clone NovaHub

```bash
git clone https://github.com/asfiahamed0404/NovaHub.git
cd NovaHub
```

### 2. Backend

```bash
cd backend
npm install
```

Create:

```text
backend/.env
```

using `.env.example`:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLIENT_URL=http://localhost:5173
INVITE_EXPIRY_HOURS=24
INVITE_CREATION_RATE_LIMIT_MAX=10
INVITE_CREATION_RATE_LIMIT_WINDOW_MINUTES=15
INVITE_MAX_ACTIVE_PER_MEMBER=10
INVITE_MAX_ACTIVE_PER_WORKSPACE=100
ENABLE_LEGACY_WORKSPACE_JOIN=false
```

Start the backend:

```bash
npm run dev
```

Backend:

```text
http://localhost:5000
```

### 3. Frontend

Open another terminal:

```bash
cd frontend
npm install
```

Create:

```text
frontend/.env
```

using `.env.example`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_ENABLE_LEGACY_WORKSPACE_JOIN=false
```

Start Vite:

```bash
npm run dev
```

---

## 🌐 Production Environment

### Frontend

Production URL:

```text
https://nova-hub-sage.vercel.app
```

Vercel environment variables:

```env
VITE_API_URL=https://novahub-production.up.railway.app/api
VITE_SOCKET_URL=https://novahub-production.up.railway.app
VITE_ENABLE_LEGACY_WORKSPACE_JOIN=false
```

### Backend

Production API:

```text
https://novahub-production.up.railway.app
```

Railway uses:

```env
MONGO_URI=<secret>
JWT_SECRET=<secret>
CLIENT_URL=https://nova-hub-sage.vercel.app
INVITE_EXPIRY_HOURS=24
INVITE_CREATION_RATE_LIMIT_MAX=10
INVITE_CREATION_RATE_LIMIT_WINDOW_MINUTES=15
INVITE_MAX_ACTIVE_PER_MEMBER=10
INVITE_MAX_ACTIVE_PER_WORKSPACE=100
ENABLE_LEGACY_WORKSPACE_JOIN=false
```

`CLIENT_URL` remains the backend's allowed CORS origin. The frontend builds invitation links from its current `window.location.origin`, so production links use the Vercel origin that served the page. `INVITE_EXPIRY_HOURS` accepts an integer from 1 through 168 and falls back to 24 when it is missing or invalid. Invitation abuse-protection values use the validated ranges and defaults documented above. Secrets must never be committed to Git.

---

## 🔌 Main API Routes

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### Workspaces

```text
POST   /api/workspaces
GET    /api/workspaces
GET    /api/workspaces/:id
POST   /api/workspaces/:id/join  # legacy; explicit feature flag required
DELETE /api/workspaces/:id/leave
POST   /api/workspaces/:workspaceId/invitations
GET    /api/workspaces/:workspaceId/invitations
PATCH  /api/workspaces/:workspaceId/invitations/:invitationId/revoke
```

### Invitations

```text
GET  /api/invitations/:token
POST /api/invitations/:token/accept
```

### Messages

```text
GET  /api/workspaces/:workspaceId/messages
POST /api/workspaces/:workspaceId/messages
```

---

## ⚡ Socket.IO Events

### Client → Server

```text
join_workspace
leave_workspace
```

### Server → Client

```text
joined_workspace
new_message
workspace_updated
socket_error
```

Socket connections are authenticated using JWT before workspace room access is allowed.

---

## 🧪 Testing

Development was tested milestone by milestone.

Detailed testing documentation is available under:

```text
docs/testing/
```

Including:

```text
Week 1 → Authentication
Week 2 → Workspace APIs
Week 3 → Socket.IO backend
Week 4 → Frontend authentication
Week 5 → Workspace frontend
Week 6 → Real-time chat frontend
Week 7 → UI / UX and real-time member updates
Week 8 → Production deployment and connection recovery
MVP feature → Secure workspace invitation manual checklist
```

The invitation checklist at [`docs/testing/secure-workspace-invitations-testing.md`](./docs/testing/secure-workspace-invitations-testing.md) and focused [`Socket.IO plan`](./docs/testing/secure-workspace-invitation-socket-e2e.md) cover browser, realtime, security, and regression checks. Guarded Node suites under [`backend/tests/integration`](./backend/tests/integration/README.md) cover 17 database/concurrency scenarios and seven real-client Socket.IO scenarios using a disposable transaction-capable MongoDB replica set. Run both with `npm run test:integration:invitations:all:docker` from `backend`; the manual checklists remain procedures, not pass claims.

### Frontend Quality Checks

```bash
npm run lint
npm run build
```

The production application was also tested with two authenticated users for:

- Real-time A → B messaging
- Real-time B → A messaging
- Duplicate prevention
- Workspace room authorization
- Live workspace member updates
- Network disconnection detection
- Automatic Socket.IO reconnection
- Missed-message recovery
- Reconnection without manual refresh
- Direct React Router route refresh
- Responsive layouts
- Light / Dark / System themes

---

## 🛡️ Security Practices

NovaHub currently includes:

- bcrypt password hashing
- JWT-authenticated API routes
- JWT-authenticated Socket.IO connections
- Workspace membership authorization
- Protected React routes
- MongoDB credentials stored in environment variables
- JWT secrets stored in environment variables
- `.env` files excluded from Git
- Safe `.env.example` files
- Production CORS restricted to the configured frontend origin
- Socket room membership verified server-side
- Cryptographically random invitation tokens with only SHA-256 hashes stored in MongoDB
- Expiring, single-use invitation acceptance with server-side membership checks

---

## MVP Limitations

- Any current workspace member can create an invitation because NovaHub does not yet have owner/admin/member roles.
- Invitation management follows the existing no-RBAC rule: any current workspace member can list, create, and revoke invitations.
- Raw invitation URLs are bearer credentials: anyone who obtains an unused link can preview it and, after authenticating, accept it before expiry. Share links privately and use HTTPS in production.
- The raw token necessarily appears in browser history and token-bearing request paths may appear in hosting access logs. NovaHub does not deliberately persist it in application storage or logs.
- JWTs remain in `localStorage` under the existing authentication architecture, so preventing cross-site scripting remains important; this invitation MVP does not redesign session storage.
- The legacy workspace-ID admission code remains for explicit compatibility only. Enabling both legacy flags restores the old browser flow and should be treated as a deliberate security/product exception.
- The MVP does not send invitation email, restrict an invite to a named recipient, or assign workspace roles.
- Invitation creation rate limits and active caps require a transaction-capable MongoDB deployment; there is no standalone-database fallback.
- Expired, used, and revoked invitation records are retained so their states remain distinguishable; there is no TTL cleanup in this MVP.

---

## 🗺️ Future Improvements

NovaHub can continue evolving with:

- ✉️ Recipient-scoped and emailed invitations
- 👥 Workspace roles and permissions
- 📎 File sharing
- @ User mentions
- ✅ Read receipts
- 🟢 Presence / online status
- ✏️ Message editing
- 🗑️ Message deletion
- 🔔 Notifications
- 🔍 Workspace search
- 🤖 AI-generated workspace summaries

---

## 📚 What I Learned

Building NovaHub gave me practical experience with:

- MERN application architecture
- REST API design
- MongoDB data modeling
- Authentication vs authorization
- Password hashing
- JWT lifecycle
- React Context
- Protected routing
- Axios interceptors
- Socket.IO authentication
- Socket.IO rooms
- Real-time event delivery
- Persistent vs temporary state
- Network failure recovery
- Avoiding duplicate realtime data
- Responsive UI development
- Theme systems
- Environment variables
- CORS
- MongoDB Atlas
- Railway deployment
- Vercel deployment
- Production debugging
- Git branches
- Pull requests
- Milestone testing
- Production deployment workflows

---

<div align="center">

## 🚀 Try NovaHub

### **[Launch Live Application](https://nova-hub-sage.vercel.app)**

Built with React, Node.js, Express, MongoDB and Socket.IO.

</div>
