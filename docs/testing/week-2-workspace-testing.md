# Week 2 Workspace Testing

## Feature tested

NovaHub workspace management backend.

---

## Purpose

The purpose of this test is to confirm that authenticated users can:

```text
Create workspaces
View their own workspaces
View one workspace by ID
Join workspaces
Leave workspaces
```

The backend must also make sure that only workspace members can access private workspace data.

---

## Backend features involved

```text
Workspace model
Create workspace API
Get my workspaces API
Get single workspace API
Join workspace API
Leave workspace API
JWT protected workspace routes
Workspace membership authorization
Invalid ObjectId handling
```

---

## APIs tested

| Method | API | Purpose |
|---|---|---|
| POST | `/api/workspaces` | Create workspace |
| GET | `/api/workspaces` | Get my workspaces |
| GET | `/api/workspaces/:id` | Get one workspace |
| POST | `/api/workspaces/:id/join` | Join workspace |
| DELETE | `/api/workspaces/:id/leave` | Leave workspace |

---

## Test users

```text
User 1:
Workspace creator

User 2:
Join/leave test user
```

Example test accounts:

```text
User 1:
weektwo.user@gmail.com

User 2:
join.user@gmail.com
```

Do not write real passwords or JWT tokens in this file.

---

# Test 1: Create workspace

## Request

```http
POST http://localhost:5000/api/workspaces
```

## Authorization

```text
Bearer Token
```

Use User 1 token.

## Body

```json
{
  "name": "Week 2 Final Workspace",
  "description": "Testing all workspace APIs"
}
```

## Expected result

```text
201 Created
Workspace created successfully
createdBy is User 1
members array contains User 1
```

## Status

```text
Passed
```

---

# Test 2: Create workspace without token

## Request

```http
POST http://localhost:5000/api/workspaces
```

## Authorization

No token.

## Body

```json
{
  "name": "Private Workspace",
  "description": "Testing protected route"
}
```

## Expected result

```text
401 Unauthorized
Not authorized. Token is required.
```

## Status

```text
Passed
```

---

# Test 3: Create workspace with invalid name

## Request

```http
POST http://localhost:5000/api/workspaces
```

## Authorization

Use User 1 token.

## Body

```json
{
  "name": "A",
  "description": "Invalid workspace name test"
}
```

## Expected result

```text
400 Bad Request
Workspace name must contain at least 2 characters.
```

## Status

```text
Passed
```

---

# Test 4: Get my workspaces

## Request

```http
GET http://localhost:5000/api/workspaces
```

## Authorization

Use User 1 token.

## Expected result

```text
200 OK
Only workspaces where User 1 is a member are returned
Workspace creator is populated
Workspace members are populated
```

## Status

```text
Passed
```

---

# Test 5: Get one workspace by ID

## Request

```http
GET http://localhost:5000/api/workspaces/:id
```

Replace `:id` with a real workspace ID.

## Authorization

Use User 1 token.

## Expected result

```text
200 OK
Workspace details returned
createdBy populated
members populated
```

## Status

```text
Passed
```

---

# Test 6: Get workspace with invalid ID

## Request

```http
GET http://localhost:5000/api/workspaces/abc
```

## Authorization

Use a valid token.

## Expected result

```text
400 Bad Request
Invalid workspace ID.
```

## Status

```text
Passed
```

---

# Test 7: Non-member cannot access workspace

## Request

```http
GET http://localhost:5000/api/workspaces/:id
```

## Authorization

Use a token from a user who is not a member of the workspace.

## Expected result

```text
403 Forbidden
You are not allowed to access this workspace.
```

## Status

```text
Passed
```

---

# Test 8: Join workspace as second user

## Request

```http
POST http://localhost:5000/api/workspaces/:id/join
```

Replace `:id` with User 1 workspace ID.

## Authorization

Use User 2 token.

## Body

No body needed.

## Expected result

```text
200 OK
Joined workspace successfully
members array contains User 1 and User 2
```

## Status

```text
Passed
```

---

# Test 9: Prevent duplicate join

## Request

Send the same join request again with User 2 token:

```http
POST http://localhost:5000/api/workspaces/:id/join
```

## Expected result

```text
400 Bad Request
You are already a member of this workspace.
```

## Status

```text
Passed
```

---

# Test 10: User 2 can access workspace after joining

## Request

```http
GET http://localhost:5000/api/workspaces/:id
```

## Authorization

Use User 2 token.

## Expected result

```text
200 OK
Workspace details returned
User 2 is now allowed because User 2 is a member
```

## Status

```text
Passed
```

---

# Test 11: Leave workspace as second user

## Request

```http
DELETE http://localhost:5000/api/workspaces/:id/leave
```

## Authorization

Use User 2 token.

## Expected result

```text
200 OK
Left workspace successfully
User 2 removed from members array
```

## Status

```text
Passed
```

---

# Test 12: User 2 cannot leave again

## Request

```http
DELETE http://localhost:5000/api/workspaces/:id/leave
```

## Authorization

Use User 2 token again.

## Expected result

```text
403 Forbidden
You are not a member of this workspace.
```

## Status

```text
Passed
```

---

# Test 13: User 2 cannot access workspace after leaving

## Request

```http
GET http://localhost:5000/api/workspaces/:id
```

## Authorization

Use User 2 token.

## Expected result

```text
403 Forbidden
You are not allowed to access this workspace.
```

## Status

```text
Passed
```

---

# Test 14: Creator cannot leave workspace

## Request

```http
DELETE http://localhost:5000/api/workspaces/:id/leave
```

## Authorization

Use User 1 token.

## Expected result

```text
400 Bad Request
Workspace creator cannot leave the workspace.
```

## Status

```text
Passed
```

---

# Security checks

```text
Only authenticated users can create workspaces
Only workspace members can view workspace details
Only non-members can join a workspace
Duplicate join is blocked
Only workspace members can leave a workspace
Workspace creator cannot leave for now
Invalid ObjectId is handled safely
Workspace data is protected using JWT middleware
```

---

# Week 2 result

```text
Workspace management backend completed and tested successfully.
```