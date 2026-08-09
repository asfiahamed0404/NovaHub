# NovaHub

NovaHub is a full-stack real-time collaboration platform built with the MERN stack.

It allows users to create and join workspaces, communicate through real-time messaging, manage workspace membership, and automatically recover messages after temporary network disconnections.

This project started as a way to learn the MERN stack and evolved into a production-deployed collaboration application.

## Live Demo

**Frontend:**  
https://nova-hub-sage.vercel.app

**Backend API:**  
https://novahub-production.up.railway.app

## Features

### Authentication

- User registration
- User login
- JWT authentication
- Password hashing with bcrypt
- Protected frontend routes
- Persistent login sessions
- Logout support

### Workspaces

- Create workspaces
- View joined workspaces
- View workspace details
- Join workspaces
- Leave workspaces
- Prevent duplicate membership
- Prevent workspace creators from leaving their own workspace
- Workspace membership authorization

### Real-Time Collaboration

- Real-time workspace messaging with Socket.IO
- JWT-authenticated socket connections
- Workspace-specific Socket.IO rooms
- Real-time member join/leave updates
- Duplicate message prevention
- Message history stored in MongoDB

### Connection Recovery

NovaHub handles temporary network interruptions without requiring the user to manually refresh the page.

When the connection is lost:

- A reconnecting status is displayed
- The message composer is temporarily disabled
- Socket.IO automatically reconnects
- The user automatically rejoins the workspace room
- Missed messages are fetched from the API
- Existing and missed messages are merged without duplicates
- Real-time messaging continues normally after reconnection

### UI / UX

- Responsive interface
- Mobile-friendly layouts
- Light theme
- Dark theme
- System theme
- Persistent theme preference
- Accessible focus states
- Reduced-motion support
- Loading, empty, and error states

## Tech Stack

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

### Deployment

- **Frontend:** Vercel
- **Backend:** Railway
- **Database:** MongoDB Atlas

## Architecture

```text
┌──────────────────────────────┐
│        React + Vite          │
│           Vercel             │
└──────────────┬───────────────┘
               │
          HTTPS / Socket.IO
               │
┌──────────────▼───────────────┐
│      Node.js + Express       │
│          Socket.IO           │
│           Railway            │
└──────────────┬───────────────┘
               │
          MongoDB TLS
               │
┌──────────────▼───────────────┐
│       MongoDB Atlas          │
└──────────────────────────────┘
```

## Real-Time Messaging Flow

```text
User A
  │
  │ POST message
  ▼
Express API
  │
  ├── Save message to MongoDB
  │
  └── Emit "new_message"
          │
          ▼
   Workspace Socket.IO Room
          │
          ▼
       User B
```

Messages are persisted in MongoDB, while Socket.IO provides immediate real-time delivery to connected workspace members.

## Connection Recovery Flow

```text
Connection lost
      │
      ▼
Show reconnecting status
      │
      ▼
Socket.IO reconnects
      │
      ▼
Rejoin workspace room
      │
      ▼
Fetch latest messages
      │
      ▼
Merge messages by ID
      │
      ▼
Continue real-time messaging
```

## Project Structure

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
│   └── server.js
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   └── socket/
│   └── vercel.json
│
├── docs/
│   └── testing/
│
└── README.md
```

## Running NovaHub Locally

### 1. Clone the repository

```bash
git clone https://github.com/asfiahamed0404/NovaHub.git
cd NovaHub
```

### 2. Backend setup

```bash
cd backend
npm install
```

Create a `.env` file based on `.env.example`.

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

The API will run locally at:

```text
http://localhost:5000
```

### 3. Frontend setup

Open another terminal:

```bash
cd frontend
npm install
```

Create a `.env` file based on `.env.example`.

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

Start the frontend:

```bash
npm run dev
```

## Testing

NovaHub was tested throughout development in separate milestones.

Testing documentation is available in:

```text
docs/testing/
```

Testing includes:

- Authentication
- Workspace APIs
- Socket.IO authentication
- Workspace authorization
- Frontend authentication
- Workspace frontend functionality
- Real-time messaging
- Real-time membership updates
- Responsive UI
- Light / Dark / System themes
- Production deployment
- Network disconnection and reconnect recovery

Frontend quality checks:

```bash
npm run lint
npm run build
```

## Security

NovaHub includes several security practices:

- Passwords are hashed before storage
- JWTs protect authenticated API routes
- Socket.IO connections require JWT authentication
- Workspace membership is verified before joining socket rooms
- Environment secrets are excluded from Git
- Production CORS only allows the configured frontend origin
- MongoDB credentials and JWT secrets are stored as environment variables

## Future Improvements

Potential future features include:

- Secure workspace invitation system
- Invitation expiry and revocation
- File sharing
- User mentions
- Read receipts
- Presence and online status
- Message editing and deletion
- Workspace roles and permissions
- Notifications
- AI-generated workspace summaries

## What I Learned

Building NovaHub helped me practice and understand:

- Full-stack MERN architecture
- REST API design
- Authentication and authorization
- MongoDB data modeling
- React state and context
- Protected routing
- Real-time communication with Socket.IO
- Socket rooms and authentication
- Handling network disconnections
- Production environment variables
- CORS configuration
- Deployment with Vercel, Railway, and MongoDB Atlas
- Git branching, pull requests, testing, and milestone-based development