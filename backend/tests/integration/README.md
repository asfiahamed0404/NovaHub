# Invitation integration tests

These tests exercise the real Express invitation routes, JWT middleware, Mongoose models, MongoDB transactions, concurrency behavior, and Socket.IO server. They use Node's built-in test runner; `socket.io-client` is a development-only dependency for real websocket clients.

## Recommended local command

Docker Desktop must be running:

```bash
npm run test:integration:invitations:docker
```

Run only the Socket.IO end-to-end suite or both suites with:

```bash
npm run test:integration:invitations:socket:docker
npm run test:integration:invitations:all:docker
```

The command starts MongoDB 8 as a one-node replica set on `127.0.0.1:27019`, uses the dedicated `novahub_invitation_test` database, executes the suite, and removes the Compose container, network, and data volume in a `finally` block. The downloaded MongoDB image remains in Docker's image cache.

The Compose project is fixed to `novahub-invitation-tests`, so cleanup is limited to resources owned by this test harness.

## Safety guards

The test file refuses to run unless all of these conditions hold:

- `TEST_MONGO_URI` is explicitly supplied.
- The selected database name contains a standalone `test` segment.
- `CONFIRM_INVITATION_TEST_DATABASE` exactly matches that database name.
- `TEST_MONGO_URI` is not identical to `MONGO_URI` when `MONGO_URI` is present.
- MongoDB reports replica-set support before any test begins.

The selected test database is dropped before and after the suite. Never point these variables at production or at a database containing data that must be retained.

## Running against another disposable replica set

Set both safety variables, then run:

```bash
npm run test:integration:invitations
npm run test:integration:invitations:socket
```

For example, the database portion of the URI could be `novahub_invitation_test`; the confirmation value must then be exactly `novahub_invitation_test`. Do not save credentials or database URIs in committed files or test output.

## Covered scenarios

The 17 database tests verify hash-only token storage and the physical unique index, member and JWT authorization, malformed/expired/revoked handling, one-time acceptance, consumption, same-user idempotency, different-user reuse denial, existing-member behavior, deleted workspaces, a simultaneous two-user race, transaction rollback after injected membership failure, safe listing, revocation, rate limiting, member/workspace active caps, and concurrent cap enforcement.

The seven real-client Socket.IO tests verify JWT handshake rejection, idempotent member room joining, non-member denial without database mutation, committed database state before `workspace_updated` delivery, the accepted user's normal authenticated room join, no duplicate event on an idempotent retry, and transport reconnection followed by reauthentication and room rejoin.
