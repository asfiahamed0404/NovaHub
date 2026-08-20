# Secure Workspace Invitations Manual Acceptance Plan

> Status: **Not yet executed.** Every checkbox is intentionally unchecked. Record results only after running each applicable procedure against the build and environment named below.

The automated suites in [`backend/tests/integration`](../../backend/tests/integration/README.md) passed 17/17 database/concurrency scenarios and 7/7 real-client Socket.IO scenarios against a disposable local MongoDB 8 replica set on 2026-08-20. Those results do not mark this browser/manual plan as passed.

## Scope

This is the consolidated acceptance plan for the secure, expiring, single-use invitation V1. It covers creation, management, authentication returns, acceptance, lifecycle failures, authorization, abuse controls, database consistency, realtime delivery, reconnect recovery, and legacy compatibility.

Browser identities used below:

- **Browser A / User A** — an existing member of Workspace W; keep this browser in W for realtime checks.
- **Browser B / User B** — an existing authenticated account that is not initially a member of W; also use a signed-out session for redirect checks.
- **Browser C / User C** — another non-member used for login, reuse, authorization, and competing-acceptance checks.
- **User R** — a new disposable account created during the registration-return scenario.

Use a fresh invitation whenever a procedure says "fresh." Do not reuse a token from another scenario unless the procedure explicitly requires it.

## Safety and evidence rules

- Use disposable accounts, workspaces, and invitations.
- Run direct database mutation, forced expiry, workspace deletion, rollback injection, and reduced-limit configuration only against local or isolated staging data. Never perform these operations against production data.
- Never commit or paste JWTs, raw invitation tokens, complete invitation URLs, MongoDB URIs, passwords, or `.env` contents into evidence.
- Redact the token portion of URLs in screenshots, browser recordings, Postman collections, tickets, and logs.
- Safe evidence includes sanitized response shapes, status/code pairs, lifecycle status, timestamps, event names, test document IDs, and token hashes from disposable data.
- Invitation API responses should include `Cache-Control: no-store` in both success and failure cases.
- Platform access logs may contain request paths. Application code must not deliberately log raw invitation tokens.

## Test record

- [ ] Build/commit: `____________________`
- [ ] Tester and date: `____________________`
- [ ] Environment: `local / staging / production / other: __________`
- [ ] Frontend origin: `____________________`
- [ ] Backend origin: `____________________`
- [ ] Disposable database name, if used: `____________________`
- [ ] Browser A/profile: `____________________`
- [ ] Browser B/profile: `____________________`
- [ ] Browser C/profile: `____________________`
- [ ] Browser/Postman versions: `____________________`
- [ ] `INVITE_EXPIRY_HOURS`: `____________________`
- [ ] Creation rate maximum/window: `____________________`
- [ ] Active member/workspace caps: `____________________`
- [ ] Backend/frontend legacy join flags: `____________________`

## Prerequisites

1. Start the finished frontend and backend with `CLIENT_URL` matching the frontend origin and a transaction-capable replica-set or sharded MongoDB deployment.
2. Keep secure invitation admission canonical: both legacy join flags should initially be missing or false.
3. Prepare Workspace W with User A as a current member and Users B/C as non-members.
4. Open A, B, and C in separate browser profiles so JWT and Socket.IO sessions cannot overlap.
5. Open Network and Console panels with Preserve log enabled. Filter REST traffic by `invitations`; inspect websocket frames for `join_workspace`, `joined_workspace`, and `workspace_updated`.
6. Confirm A can open W, load message history, and receive live messages before invitation testing.
7. Run the automated baseline from `backend` and retain only its sanitized summary:

```powershell
npm.cmd run test:integration:invitations:all:docker
```

Expected baseline: `24` tests, `24` passed, `0` failed, followed by removal of the disposable container and volume.

## Current API contract

| Operation | Success | Important expected failures |
|---|---|---|
| Create `POST /api/workspaces/:workspaceId/invitations` | `201` | `400 INVALID_WORKSPACE_ID`, `401`, `403 WORKSPACE_INVITATION_FORBIDDEN`, `404 WORKSPACE_NOT_FOUND`, active-cap `409`, rate-limit `429` |
| List `GET /api/workspaces/:workspaceId/invitations` | `200` | invalid workspace/limit `400`, `401`, membership `403`, workspace `404` |
| Revoke `PATCH /api/workspaces/:workspaceId/invitations/:invitationId/revoke` | `200` | invalid IDs `400`, `401`, membership `403`, invitation/workspace `404`, non-active state `409` |
| Preview `GET /api/invitations/:token` | `200` | malformed `400`, unknown `404`, expired/used/revoked/deleted workspace `410` |
| Accept `POST /api/invitations/:token/accept` | `200` | malformed `400`, `401`, already member `409`, unknown `404`, expired/used/revoked/deleted workspace `410` |

Unexpected invitation failures should return generic `500 INVITATION_REQUEST_FAILED` without stack traces, internal paths, database details, or reflected token-bearing URLs.

---

## Core manual scenarios

### 1. Create and copy a fresh invitation

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. As A, open W and open the Invite dialog.
2. Click the create action once and observe its loading state.
3. Inspect the sanitized create response, displayed URL, expiry, and Copy control.
4. Copy the URL into a temporary unsaved field, compare it with the displayed value, then clear it.

Expected:

- One `201` response returns safe invitation `id`, `expiresAt`, and one 43-character raw token; it never returns `tokenHash`.
- The displayed URL uses the current frontend origin and exact `/invite/<token>` path.
- Copy success is announced. Denied clipboard permission produces readable feedback without creating another invitation.
- The raw link exists only for this newly created invitation and remains in component memory, not local/session storage.

Evidence: `____________________________________________`

### 2. List and manage safe invitation metadata

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. Keep the dialog open, then close/reopen it and reload the page.
2. Observe `GET /api/workspaces/:workspaceId/invitations` and the newest row.
3. Inspect the response and displayed creator, creation time, expiry, and status.
4. Optionally request valid limits `1`, `50`, and `100`, then invalid `0`, `101`, decimal, and text values.

Expected:

- The fresh row is `active`; loading, empty, error/retry, count, and expiry presentation remain usable.
- Reloaded/older rows never expose or reconstruct their raw URLs.
- The response contains only allowlisted actor/lifecycle metadata and never `token`, `tokenHash`, workspace member lists, or JWTs.
- Invalid limits return `400 INVALID_INVITATION_LIMIT`; list size is bounded and newest-first.

Evidence: `____________________________________________`

### 3. Public preview while signed out

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. Create a fresh invite as A.
2. Sign out Browser B or use a clean private profile and open the URL directly.
3. Inspect the preview request before choosing authentication.

Expected:

- `/invite/:token` loads and public preview returns `200` without a JWT.
- Only the correct workspace name and expiry are shown; workspace ID, members, creator details, token hash, and raw token response fields are absent.
- Opening the link does not create membership, consume the invitation, or emit `workspace_updated`.

Evidence: `____________________________________________`

### 4. Registration preserves the invitation without auto-accepting

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. From a fresh signed-out invitation in Browser B, choose registration.
2. Create disposable User R.
3. Observe the post-registration route before clicking Accept.

Expected:

- Login/register navigation carries only the validated internal `/invite/<token>` return path.
- Registration returns User R to the same invitation preview.
- Authentication alone does not call the acceptance endpoint, consume the invite, or add membership.
- An explicit Accept action remains required.

Evidence: `____________________________________________`

### 5. Login preserves the invitation without auto-accepting

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. Create another fresh invitation.
2. Open it while signed out in Browser C and choose login.
3. Sign in as existing non-member C.
4. Observe the returned route before clicking Accept.

Expected:

- C returns to the exact validated invitation path, not an external URL or arbitrary internal route.
- Login alone does not accept or consume the invitation.
- Switching between login and registration preserves the same safe return state.

Evidence: `____________________________________________`

### 6. Successful acceptance and navigation

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. Create a fresh invite for B and keep A connected inside W.
2. Open the link as authenticated non-member B.
3. Click Accept once and observe the HTTP response, route change, and workspace load.
4. Inspect W and the invitation in the disposable database if available.

Expected:

- Acceptance returns `200`, sets `usedAt`/`usedBy`, and adds B exactly once with `$addToSet` semantics.
- B navigates with client routing to `/workspaces/:workspaceId`; protected workspace details and messages load normally.
- The invite is committed as used only together with membership; no partial state exists.

Evidence: `____________________________________________`

### 7. Existing members receive the committed realtime update

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. Repeat scenario 6 with a fresh non-member/invite while A is already joined to W's room.
2. Observe A's websocket frames and member UI during acceptance.
3. Check the disposable database as soon as A receives the event.

Expected:

- Exactly one `workspace_updated` reaches A.
- Membership and invitation consumption are already committed when the event arrives.
- A's member list/count updates without refresh.
- No invitation-specific socket room or alternate membership mechanism is introduced.

Evidence: `____________________________________________`

### 8. Accepted user joins through the normal Socket.IO flow

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. Continue with accepted B on the workspace page.
2. Observe B's Socket.IO frames.
3. Exchange one message A-to-B and one B-to-A.

Expected:

- B emits the existing `join_workspace` and receives `joined_workspace` after the database membership check.
- Each live message appears once and persists in MongoDB.
- Invitation acceptance creates no duplicate room membership or message handler.

Evidence: `____________________________________________`

### 9. Duplicate click and same-user retry are idempotent

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. With a fresh invite/non-member, double-click or rapidly activate Accept and inspect the disabled/loading behavior.
2. In an API client, release two authenticated accept requests for the same user/token nearly simultaneously.
3. Retry the accept endpoint after completion and watch A's websocket frames.

Expected:

- The UI prevents ordinary duplicate submission.
- The server grants membership once; concurrent same-user calls may both resolve `200` through the safe retry path.
- The user occurs once in `Workspace.members`, the invitation has one consumption record, and only one `workspace_updated` is emitted.

Evidence: `____________________________________________`

### 10. Already-member handling does not consume a fresh invite

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. After B is a member, create a different fresh invitation for W.
2. Preview and attempt acceptance as B.
3. Inspect the invitation and member array.

Expected:

- Preview remains safe and valid because it intentionally does not identify the visitor.
- Acceptance returns `409 ALREADY_WORKSPACE_MEMBER` with safe workspace `_id`/`name`.
- The UI shows Already Member with Open Workspace.
- B remains present once and the fresh invitation remains unused.

Evidence: `____________________________________________`

### 11. A used invite cannot be reused by another user

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. Reopen B's successfully consumed token as non-member C.
2. Attempt preview and direct authenticated acceptance.

Expected:

- Both operations return `410 INVITATION_ALREADY_USED`.
- C is not added and no additional `workspace_updated` occurs.
- The retained record remains distinguishable as `used` without storing the raw token.

Evidence: `____________________________________________`

### 12. Revoke an active invitation

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. Create a fresh invitation as A and keep its newly displayed URL temporarily available.
2. In the management row, start revocation, cancel once, then confirm it.
3. Observe the row, current-link area, preview, and direct acceptance as C.
4. Attempt to revoke the same invitation again.

Expected:

- Cancel leaves the invitation active; confirmation records `revokedAt`/`revokedBy` and changes status to `revoked`.
- If the revoked row is the newly created link, the raw-link area is cleared immediately.
- Preview and acceptance return `410 INVITATION_REVOKED` and grant no membership.
- A repeated revoke returns `409 INVITATION_ALREADY_REVOKED`; used or expired rows likewise cannot be revoked.

Evidence: `____________________________________________`

### 13. Expired invitation is rejected and remains distinguishable

- [ ] Pass  - [ ] Fail  - [ ] Blocked  - [ ] Not applicable outside isolated data

1. In a disposable database, create an invite and set only its `expiresAt` to a past server time, or wait for a deliberately short supported test expiry.
2. Refresh the management list and attempt preview/acceptance as a non-member.

Expected:

- The row derives `expired`; it is not confused with used or revoked.
- Preview and acceptance return `410 INVITATION_EXPIRED`.
- No member or socket update is produced, and the lifecycle record is retained.

Evidence: `____________________________________________`

### 14. Deleted workspace fails safely

- [ ] Pass  - [ ] Fail  - [ ] Blocked  - [ ] Not applicable outside isolated data

1. Create a disposable workspace and invitation in an isolated database.
2. Delete only that disposable workspace document while retaining the invitation.
3. Attempt preview and authenticated acceptance.

Expected:

- Both operations return `410 INVITATION_WORKSPACE_NOT_FOUND`.
- The invite is not consumed, membership cannot be granted, and no socket update occurs.
- No other workspace, user, invitation, or production data is touched.

Evidence: `____________________________________________`

### 15. Malformed and unknown tokens fail safely

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. Open `/invite/not-a-real-token` and test empty, short, long, disallowed-character, and malformed-percent forms where routing permits.
2. Test a canonical-looking 43-character random token that is not stored.
3. Test an unsupported invitation sub-route containing a disposable fake token.

Expected:

- Malformed tokens return `400 INVALID_INVITATION_TOKEN`; an unknown canonical token returns `404 INVITATION_NOT_FOUND`.
- An unsupported endpoint returns generic `404 INVITATION_ROUTE_NOT_FOUND` without echoing the token-bearing URL.
- Responses are JSON, safe, non-cacheable, and contain no stack, query, hash, or internal path.

Evidence: `____________________________________________`

### 16. Unauthorized creation, listing, and revocation fail

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. As non-member C, call create and list for W and attempt revocation using a disposable invitation ID.
2. Repeat each request without a JWT.
3. Confirm A can still manage invitations under the documented current-member rule.

Expected:

- Missing/invalid JWT requests return `401`.
- C receives `403 WORKSPACE_INVITATION_FORBIDDEN` and cannot create, enumerate, or revoke W's invitations.
- Rejected creation consumes no rate allowance and creates no invitation/lock record for C.
- NovaHub does not imply owner/admin roles that do not exist; any current member remains authorized in V1.

Evidence: `____________________________________________`

### 17. Creation rate limit and active caps work

- [ ] Pass  - [ ] Fail  - [ ] Blocked  - [ ] Isolated environment only

1. In local/isolated staging, configure deliberately low rate/member/workspace limits and restart the backend.
2. As A, create until the member cap is reached; confirm one attempt beyond it.
3. Use another current member to reach the workspace-wide cap.
4. In a fresh disposable workspace/window, exceed the configured creation-attempt rate.
5. Revoke an active invite or let it expire, then create again where the active cap—not rate window—was the blocker.

Expected:

- Member and workspace active caps return their documented `409` codes without exceeding committed counts, including concurrent attempts.
- Rate overflow returns `429 INVITATION_CREATION_RATE_LIMITED` with matching `Retry-After` and `retryAfterSeconds`.
- Only unused, unrevoked, unexpired invitations count as active.
- Restore normal configuration after testing.

Evidence: `____________________________________________`

### 18. Two different users race for one invitation

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. Use a fresh workspace where B and C are both non-members.
2. Create one fresh invitation and prepare authenticated accept requests for B and C.
3. Release both requests as simultaneously as the test tool permits.
4. Inspect membership, invitation state, HTTP results, and A's websocket frames.

Expected:

- Exactly one request succeeds; the other resolves `410 INVITATION_ALREADY_USED` after transaction retry/state recheck.
- Only the winner is added, exactly once, and `usedBy` identifies that winner.
- Exactly one committed `workspace_updated` is emitted; no partial loser state exists.

Evidence: `____________________________________________`

### 19. Acceptance succeeds while an existing member is offline

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. Put Browser A offline after it has joined W.
2. Have a fresh non-member accept a fresh invitation while A remains offline.
3. Confirm acceptance and database state before restoring A.

Expected:

- Acceptance succeeds without depending on socket delivery.
- MongoDB contains the committed membership and consumed invite even though A missed the event.
- No client-side socket state is treated as persistent membership.

Evidence: `____________________________________________`

### 20. Reconnect/rejoin recovers workspace state and missed messages

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. Restore Browser A from scenario 19 without refreshing.
2. Confirm reconnect, reauthentication, `join_workspace`, and `joined_workspace`.
3. Separately put accepted B offline, send a message from A, then restore B without refreshing.
4. Send another live message in each direction.

Expected:

- Reconnecting/syncing states appear and sending is disabled while disconnected.
- After successful room rejoin, current workspace state and message history are fetched from protected REST endpoints.
- A recovers the membership event missed while offline; B receives the missed message once, merged by message ID.
- Normal live messaging resumes without duplicate room membership or handlers.

Evidence: `____________________________________________`

### 21. Invitation management and chat regressions remain clean

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. Build management history containing at least one active, used, expired, and revoked invitation.
2. Reopen the dialog, retry a simulated failed list request, and inspect statuses/actor metadata.
3. Keep A and B in W, send messages both directions, refresh one browser, and reopen message history.

Expected:

- All four invitation states remain distinguishable; only active rows offer revoke.
- No historical raw link can be reconstructed or copied.
- List failure/retry does not erase a newly created raw link unless its own row is revoked.
- Chat delivery, persistence, duplicate prevention, room authorization, and member UI remain functional.

Evidence: `____________________________________________`

### 22. Legacy compatibility remains disabled by default

- [ ] Pass  - [ ] Fail  - [ ] Blocked

1. With backend/frontend legacy flags missing or false, call `POST /api/workspaces/:id/join` and inspect the dashboard.
2. Confirm secure links are the normal admission guidance and the workspace-ID form is hidden.
3. Only in an isolated compatibility check, enable both flags, restart/rebuild, and verify legacy join plus normal leave/creator protection.
4. Restore both flags to false.

Expected:

- Default legacy admission returns `410 LEGACY_WORKSPACE_JOIN_DISABLED` and creates no membership.
- Explicit compatibility retains atomic duplicate prevention; normal members can leave and creators remain protected.
- The Socket.IO `join_workspace` event stays enabled because it checks existing membership and never grants admission.

Evidence: `____________________________________________`

---

## Security and storage sign-off

- [ ] Raw tokens are generated as canonical 43-character base64url values from 32 cryptographically random bytes.
- [ ] Invitation documents store only unique, immutable, normally unselected 64-character SHA-256 `tokenHash` values; no raw token or URL is persisted.
- [ ] Physical indexes include unique `tokenHash` plus regular workspace and expiry indexes; expiry is not a TTL deletion index.
- [ ] Used, expired, and revoked records remain retained and distinguishable; lifecycle precedence is used, revoked, expired, then active.
- [ ] Preview, list, revoke, accept, and error responses never expose `tokenHash` or an unintended raw token.
- [ ] Browser local/session storage, frontend analytics, server application logs, and error bodies contain no deliberately persisted raw invitation token.
- [ ] JWT verification and current database membership protect all management operations and acceptance.
- [ ] Acceptance conditionally claims the invite and applies `$addToSet` in one MongoDB transaction.
- [ ] Forced rollback testing confirms no consumed invite or partial membership remains after membership persistence fails.
- [ ] `workspace_updated` occurs only after commit and is not treated as a persistence guarantee.
- [ ] Internal auth return paths accept only exact `/invite/<valid-shape-token>` values; no open redirect or auto-accept exists.
- [ ] Invitation responses include `Cache-Control: no-store`, production uses HTTPS, and cross-origin framing is denied.
- [ ] Production Socket.IO CORS uses the configured frontend origin and npm audit reports no known dependency vulnerabilities for the tested lockfile.

## Final sign-off

- [ ] Automated baseline passed `24/24` on this build.
- [ ] Core manual scenarios passed `22/22`, or each blocked/not-applicable item has a documented reason.
- [ ] Security and storage sign-off completed.
- [ ] Frontend lint and production build passed for this build.
- [ ] Backend syntax/import checks passed for this build.
- [ ] No disposable test container, database, or volume remains after testing.
- [ ] Failures and environment-specific deviations are recorded rather than silently marked passed.

Notes/evidence summary (sanitized):

```text

```

Overall result: - [ ] Pass  - [ ] Fail  - [ ] Blocked  - [ ] Not run
