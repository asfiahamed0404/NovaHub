# NovaHub Testing Documentation

This folder contains NovaHub's backend, frontend, real-time, deployment, and feature-specific manual testing documentation.

Testing documented here uses tools such as:

- Postman for REST API checks
- Browser sessions and developer tools for frontend and Socket.IO checks
- MongoDB Atlas or a local MongoDB instance for persistence checks

Unless a document explicitly records a passed result, treat its items as procedures still to be run in the target environment.

---

## Testing documents

| Milestone | Area | Document | Recorded status |
|---|---|---|---|
| Week 1 | Authentication backend | [`week-1-auth-testing.md`](./week-1-auth-testing.md) | Completed |
| Week 2 | Workspace backend | [`week-2-workspace-testing.md`](./week-2-workspace-testing.md) | Completed |
| Week 3 | Messaging and Socket.IO backend | [`week-3-socket-testing.md`](./week-3-socket-testing.md) | REST checks passed; browser Socket.IO verification remains noted as pending |
| Week 4 | Frontend authentication | [`week-4-frontend-auth-testing.md`](./week-4-frontend-auth-testing.md) | Passed |
| Week 5 | Workspace frontend | [`week-5-workspace-frontend-testing.md`](./week-5-workspace-frontend-testing.md) | Passed |
| Week 6 | Chat frontend | [`week-6-chat-frontend-testing.md`](./week-6-chat-frontend-testing.md) | Passed |
| Week 7 | UI/UX and live membership | [`week-7-ui-ux-testing.md`](./week-7-ui-ux-testing.md) | Manually verified |
| Week 8 | Production and reconnect recovery | [`week-8-production-testing.md`](./week-8-production-testing.md) | Passed |
| MVP feature | Secure workspace invitations | [`secure-workspace-invitations-testing.md`](./secure-workspace-invitations-testing.md) and [`secure-workspace-invitation-socket-e2e.md`](./secure-workspace-invitation-socket-e2e.md) | Automated database suite passed 17/17 and Socket.IO suite passed 7/7 locally; manual checklists pending |

---

## Important security note

Do not commit or paste into test evidence:

```text
.env files
JWT tokens
Raw workspace invitation tokens or complete invitation URLs
MongoDB URIs or passwords
Real user passwords
Temporary local test files that contain credentials
```

Safe to commit:

```text
Source code
Sanitized request/response examples
Testing checklists
Documentation
README files
```

When recording invitation tests, redact the raw token. A raw invitation token is a temporary bearer credential even though the database stores only its hash.

---

## Branch workflow

NovaHub uses this Git workflow:

```text
dev  -> daily development branch
main -> stable milestone branch
```

Daily work is committed and pushed to `dev`.

After a week or milestone is tested, `dev` is merged into `main` using a GitHub Pull Request.

---

## Current testing status

The historical week documents retain their recorded outcomes. The invitation feature now has guarded Node integration suites documented in [`backend/tests/integration/README.md`](../../backend/tests/integration/README.md). They passed all 17 database/concurrency scenarios and all seven real-client Socket.IO scenarios against a disposable local MongoDB 8 replica set on 2026-08-20. The separate browser/manual checklists remain unchecked and must not be reported as passed until each relevant item has been run and evidence has been recorded for the environment under test.
