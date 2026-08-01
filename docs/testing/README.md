# NovaHub Backend Testing Documentation

This folder contains manual backend testing documentation for NovaHub.

Testing was mainly done using:

- Postman for REST API testing
- Browser console with a temporary local Socket.io test file
- MongoDB Atlas to verify saved data

---

## Testing documents

| Week | Area | Document |
|---|---|---|
| Week 1 | Authentication | `week-1-auth-testing.md` |
| Week 2 | Workspaces | `week-2-workspace-testing.md` |
| Week 3 | Messaging + Socket.io | `week-3-messaging-socket-testing.md` |

---

## Important security note

Do not commit sensitive values such as:

```text
.env
JWT tokens
MongoDB URI
MongoDB password
Real user passwords
Temporary local test files that contain tokens
```

Safe to commit:

```text
Source code
Testing checklists
Documentation
README files
```

---

## Branch workflow

NovaHub uses this Git workflow:

```text
dev  → daily development branch
main → stable milestone branch
```

Daily work is committed and pushed to `dev`.

After a week or milestone is tested, `dev` is merged into `main` using a GitHub Pull Request.

---

## Current testing status

```text
Week 1 Authentication testing → completed
Week 2 Workspace testing      → completed
Week 3 Messaging/Socket.io    → in progress / update after final testing
```

Update the status when a new week is fully tested.