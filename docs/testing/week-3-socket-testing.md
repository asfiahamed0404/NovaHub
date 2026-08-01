# Week 3 Messaging and Socket.io Testing

## Feature tested

NovaHub workspace messaging backend and secured Socket.io workspace rooms.

---

## Purpose

The purpose of this test is to confirm that workspace members can:

```text
Send messages
Read workspace message history
Receive real-time message events
Join Socket.io workspace rooms securely
```

Only authenticated workspace members should be able to send/read workspace messages and join the workspace socket room.

---

## Backend features involved

```text
Message model
Send message API
Get workspace messages API
Socket.io server setup
Real-time new_message emit
JWT authentication for socket connections
Workspace membership check before joining socket rooms
```

---

## REST APIs tested

| Method | API | Purpose |
|---|---|---|
| POST | `/api/workspaces/:workspaceId/messages` | Send message |
| GET | `/api/workspaces/:workspaceId/messages` | Get workspace messages |

---

## Socket events tested

| Event | Purpose |
|---|---|
| `join_workspace` | Request to join workspace socket room |
| `joined_workspace` | Success response after joining room |
| `new_message` | Receive real-time message |
| `socket_error` | Receive socket-level error |
| `connect_error` | Socket authentication failure |

---

## Important security rule

Joining a workspace in MongoDB and joining a Socket.io room are different things.

```text
MongoDB workspace membership = official access permission
Socket.io room = live real-time message channel
```

The backend should not trust the frontend blindly.

Before joining a socket room, backend must check:

```text
Is the socket user logged in?
Does the workspace exist?
Is the socket user a member of that workspace?
```

---

## Expected final behavior

```text
Logged-in workspace member
→ can connect socket
→ can join workspace room
→ can send messages
→ can receive live messages

Logged-in non-member
→ can connect socket
→ cannot join that workspace room
→ cannot receive messages from that room

No token or invalid token
→ cannot connect socket
```

---

## Test users

```text
User 1:
Workspace creator/member

User 2:
Second member or non-member depending on test
```

Do not write real JWT tokens, passwords, or MongoDB credentials in this file.

---

## Temporary local socket test file

A temporary local file can be used for socket testing:

```text
socket-test.html
```

This file should not be committed because it may contain JWT tokens.

---

# REST API message testing

## Test 1: Send message as workspace member

### Request

```http
POST http://localhost:5000/api/workspaces/:workspaceId/messages
```

Replace `:workspaceId` with a real workspace ID.

### Authorization

Use a workspace member token.

### Body

```json
{
  "content": "Hello team, this is our first workspace message!"
}
```

### Expected result

```text
201 Created
Message sent successfully
Message saved in MongoDB
Sender details populated
readBy includes sender
```

### Status

```text
Passed
```

---

## Test 2: Send empty message

### Request

```http
POST http://localhost:5000/api/workspaces/:workspaceId/messages
```

### Authorization

Use a workspace member token.

### Body

```json
{
  "content": ""
}
```

### Expected result

```text
400 Bad Request
Message content is required.
```

### Status

```text
Passed
```

---

## Test 3: Send message with invalid workspace ID

### Request

```http
POST http://localhost:5000/api/workspaces/abc/messages
```

### Authorization

Use a valid token.

### Body

```json
{
  "content": "Testing invalid workspace ID"
}
```

### Expected result

```text
400 Bad Request
Invalid workspace ID.
```

### Status

```text
Passed
```

---

## Test 4: Non-member cannot send message

### Request

```http
POST http://localhost:5000/api/workspaces/:workspaceId/messages
```

### Authorization

Use a token from a user who is not a workspace member.

### Body

```json
{
  "content": "Trying to send message as non-member"
}
```

### Expected result

```text
403 Forbidden
Only workspace members can send messages.
```

### Status

```text
Passed
```

---

## Test 5: Get workspace messages as member

### Request

```http
GET http://localhost:5000/api/workspaces/:workspaceId/messages
```

### Authorization

Use a workspace member token.

### Expected result

```text
200 OK
Messages returned
Messages sorted oldest to newest
Sender details populated
```

### Status

```text
Passed
```

---

## Test 6: Get messages with invalid workspace ID

### Request

```http
GET http://localhost:5000/api/workspaces/abc/messages
```

### Authorization

Use a valid token.

### Expected result

```text
400 Bad Request
Invalid workspace ID.
```

### Status

```text
Passed
```

---

## Test 7: Non-member cannot view messages

### Request

```http
GET http://localhost:5000/api/workspaces/:workspaceId/messages
```

### Authorization

Use a token from a user who is not a workspace member.

### Expected result

```text
403 Forbidden
Only workspace members can view messages.
```

### Status

```text
Passed
```

---

# Socket.io testing

## Test 8: Server starts after Socket.io setup

### Command

```bash
cd backend
npm run dev
```

### Expected result

```text
MongoDB connected successfully
Server running on port 5000
No Socket.io crash
REST APIs still work
```

### Status

```text
Passed
```

---

## Test 9: Valid token socket connection

### Steps

1. Login using Postman.
2. Copy JWT token.
3. Paste token into local `socket-test.html`.
4. Open the file in browser.
5. Check browser console and backend terminal.

### Expected result

```text
Socket connects successfully
Browser console shows socket connected
Backend logs socket connected with user email
```

### Example browser console

```text
Socket connected: socketId
```

### Example backend terminal

```text
Socket connected: socketId | User: user@example.com
```

### Status

```text
Pending / Passed after manual browser test
```

---

## Test 10: Workspace member joins socket room

### Steps

1. Use a token from a workspace member.
2. Use that workspace ID in `socket-test.html`.
3. Refresh browser.
4. Check browser console and backend terminal.

### Expected result

```text
Socket joins workspace room successfully
Browser console receives joined_workspace event
Backend logs socket joined workspace room
```

### Example browser console

```text
Joined workspace room successfully
```

### Status

```text
Pending / Passed after manual browser test
```

---

## Test 11: Receive real-time message

### Steps

1. Keep `socket-test.html` open.
2. Make sure socket has joined the workspace room.
3. Send a message from Postman:

```http
POST /api/workspaces/:workspaceId/messages
```

### Body

```json
{
  "content": "Testing live Socket.io receive"
}
```

### Expected result

```text
Postman returns 201 Created
Message is saved in MongoDB
Browser console receives new_message event
```

### Example browser console

```text
New message received
```

### Status

```text
Pending / Passed after manual browser test
```

---

## Test 12: Non-member cannot join workspace socket room

### Steps

1. Login as a user who is not a member of the workspace.
2. Copy that user's JWT token.
3. Paste token into local `socket-test.html`.
4. Use the same workspace ID.
5. Refresh browser.

### Expected result

```text
Socket connection may succeed because token is valid
join_workspace is rejected
Browser console receives socket_error
User does not join workspace room
User does not receive workspace messages
```

### Expected error

```text
You are not allowed to join this workspace room.
```

### Status

```text
Pending / Passed after manual browser test
```

---

## Test 13: Invalid token socket connection

### Steps

1. Put an invalid token in `socket-test.html`.
2. Refresh browser.
3. Check browser console.

### Expected result

```text
Socket connection is rejected
Browser console shows connect_error
```

### Expected error

```text
Socket authentication failed.
```

### Status

```text
Pending / Passed after manual browser test
```

---

## Test 14: No token socket connection

### Steps

1. Remove the token from `socket-test.html`.
2. Refresh browser.
3. Check browser console.

### Expected result

```text
Socket connection is rejected
Browser console shows connect_error
```

### Expected error

```text
Authentication token is required.
```

### Status

```text
Pending / Passed after manual browser test
```

---

# Security checks

```text
Only workspace members can send messages
Only workspace members can view messages
Socket connection requires JWT token
Socket user is verified using JWT
Socket room join checks workspace membership
Non-members cannot join workspace rooms
Invalid workspace IDs are rejected
Temporary socket-test.html is not committed
JWT tokens are not committed
.env is not committed
```

---

# Week 3 current result

```text
Messaging backend and secured Socket.io rooms are implemented.

REST message APIs are tested.

Socket.io browser tests should be marked as Passed only after testing with socket-test.html or frontend.
```