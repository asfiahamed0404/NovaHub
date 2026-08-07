# Week 5 — Workspace Frontend Testing

## Environment

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MongoDB Atlas
- Authentication: JWT
- Browser: Chrome
- Frontend URL: http://localhost:5173
- Backend URL: http://localhost:5000

---

## 1. Load User Workspaces

### Steps

1. Login with a valid user.
2. Open `/dashboard`.
3. Allow the workspace request to complete.

### Expected Result

- `GET /api/workspaces` is called.
- JWT is attached automatically through the Axios interceptor.
- User workspaces are displayed.
- Workspace count matches the returned workspace list.

### Status

Passed

---

## 2. Empty Workspace State

### Steps

1. Login with a user who does not belong to any workspace.
2. Open `/dashboard`.

### Expected Result

- Workspace count is `0`.
- The message `You don't have any workspaces yet.` is displayed.

### Status

Passed

---

## 3. Create Workspace

### Steps

1. Enter a workspace name in the Create Workspace form.
2. Click `Create`.

### Expected Result

- `POST /api/workspaces` is called.
- Workspace is created successfully.
- Creator becomes a member automatically.
- New workspace appears immediately without refreshing.
- Workspace count increases.
- Form input clears after success.

### Status

Passed

---

## 4. Open Workspace

### Steps

1. Open `/dashboard`.
2. Click a workspace card.

### Expected Result

- URL changes to `/workspaces/:workspaceId`.
- Workspace page loads successfully.
- Correct workspace data is displayed.

### Status

Passed

---

## 5. Load Workspace Details

### Steps

1. Open an existing workspace.
2. Wait for the workspace details request.

### Expected Result

- `GET /api/workspaces/:workspaceId` is called.
- Workspace name and description are displayed.
- Creator information is displayed.
- Member count is displayed.
- Populated member information is displayed.

### Status

Passed

---

## 6. Display Workspace Members

### Expected Result

Each member displays:

- Name
- Email
- Status

Member data is returned through the workspace details request without requiring a separate request for each member.

### Status

Passed

---

## 7. Join Workspace

### Steps

1. Login using a second user account.
2. Enter an existing workspace ID.
3. Click `Join`.

### Expected Result

- `POST /api/workspaces/:workspaceId/join` is called.
- Second user is added to the workspace.
- Joined workspace appears immediately in My Workspaces.
- Member count increases.

### Status

Passed

---

## 8. Duplicate Workspace Join

### Steps

1. Login as a user who already belongs to the workspace.
2. Attempt to join the same workspace again.

### Expected Result

- Backend rejects the duplicate join request.
- Error message is displayed.
- Workspace is not duplicated in the workspace list.

### Status

Passed

---

## 9. Leave Workspace as Normal Member

### Steps

1. Login as the second user.
2. Open a workspace created by another user.
3. Click `Leave Workspace`.

### Expected Result

- Leave button is visible to the normal member.
- `DELETE /api/workspaces/:workspaceId/leave` is called.
- User is removed from the workspace.
- User is redirected to `/dashboard`.
- Workspace no longer appears in My Workspaces.

### Status

Passed

---

## 10. Creator Cannot Leave Workspace

### Steps

1. Login as the workspace creator.
2. Open the workspace.

### Expected Result

- Leave Workspace button is not displayed.
- Creator remains a member of the workspace.

### Status

Passed

---

## 11. Former Member Cannot Access Workspace

### Steps

1. Leave the workspace using a normal member account.
2. Manually open the previous workspace URL.

### Expected Result

- Backend rejects workspace access.
- Workspace details are not displayed.
- Frontend displays an error.

### Status

Passed

---

## 12. Workspace Loading State

### Expected Result

While workspace data is being fetched:

- `Loading workspaces...` is displayed on the dashboard.

While an individual workspace is being fetched:

- `Loading workspace...` is displayed.

### Status

Passed

---

## 13. Workspace Error Handling

### Expected Result

If a workspace request fails:

- The application does not crash.
- A readable error message is displayed.

### Status

Passed

---

## 14. Back to Dashboard Navigation

### Steps

1. Open a workspace.
2. Click `Back to Dashboard`.

### Expected Result

- URL changes to `/dashboard`.
- Dashboard appears without a full browser page reload.

### Status

Passed

---

# Week 5 Result

Workspace frontend functionality successfully tested.

**Week 5 — Workspace Frontend: Passed**

---

## Deferred Improvement

The current MVP uses a raw workspace ID for joining a workspace.

Before production deployment, this should be replaced or restricted using a secure invitation system such as:

- User-specific invitations
- Secure invite tokens
- Expiration
- Revocation
- Invite permissions
- Optional accept/decline workflow