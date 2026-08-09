<div align="center">

# 🚀 NovaHub

### Real-Time Workspace Collaboration Platform

A production-deployed MERN collaboration platform with secure authentication, workspace management, real-time messaging, live member updates, responsive themes, and automatic recovery after network interruptions.

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

| 🏢 Workspace Management | 🔄 Connection Recovery |
|---|---|
| Create workspaces | Detect connection loss |
| Join existing workspaces | Show reconnecting status |
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
- MongoDB Atlas account or MongoDB instance
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
```

Secrets are never committed to Git.

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
POST   /api/workspaces/:id/join
DELETE /api/workspaces/:id/leave
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
```

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

---

## 🗺️ Future Improvements

NovaHub can continue evolving with:

- 🔗 Secure workspace invitations
- ⏳ Invitation expiry and revocation
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