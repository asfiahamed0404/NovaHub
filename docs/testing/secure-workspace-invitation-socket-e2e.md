# Secure invitation Socket.IO end-to-end plan

> Automated status: **Passed 7/7 locally on 2026-08-20** against a disposable MongoDB 8 replica set and real Socket.IO clients. Browser scenarios below remain unchecked until executed against the named build/environment.

## Test record

- [ ] Build/commit: `____________________`
- [ ] Environment: `____________________`
- [ ] Tester and date: `____________________`
- [ ] Browser A profile: existing member
- [ ] Browser B profile: invited non-member

Keep both browser Network panels open and filter websocket frames for `join_workspace`, `joined_workspace`, and `workspace_updated`. Redact invitation URLs, raw tokens, and JWTs from evidence.

## 1. Committed membership reaches connected members

1. Open Workspace W as Browser A and confirm `joined_workspace` was received.
2. Create a fresh invitation and open it as Browser B.
3. Accept in Browser B while Browser A remains connected.
4. Inspect Workspace W in the disposable test database immediately when Browser A receives `workspace_updated`.

Expected:

- Browser B is already present exactly once in `Workspace.members` when the event arrives.
- The invitation already has `usedAt` and `usedBy`.
- Browser A's member list/count updates without refresh.
- Exactly one `workspace_updated` is observed for the acceptance.

## 2. Accepted user follows the normal room path

1. Observe Browser B's post-accept URL and workspace REST request.
2. Observe its Socket.IO frames after the workspace renders.
3. Exchange one message in each direction between A and B.

Expected:

- Browser B navigates to `/workspaces/:workspaceId` without a full reload.
- The normal protected workspace request succeeds from committed membership.
- Browser B emits the existing `join_workspace` event and receives `joined_workspace`.
- Messages flow through the existing room; there is no invitation-specific room or duplicate join mechanism.

## 3. Retry produces no duplicate realtime update

1. Reopen or retry Browser B's already-consumed invitation.
2. Keep Browser A's websocket frames visible.

Expected:

- The same-user retry resolves safely and does not duplicate membership.
- Browser A receives no additional `workspace_updated` event.

## 4. Existing member misses the event while offline

1. Put Browser A offline after it has joined Workspace W.
2. Have Browser B accept a fresh invitation while A is offline.
3. Restore Browser A's network without refreshing the page.

Expected:

- Acceptance succeeds because MongoDB, not Socket.IO delivery, is the source of truth.
- Browser A reconnects, reauthenticates, emits `join_workspace`, and receives `joined_workspace`.
- After room rejoin, the frontend refreshes both message history and current workspace state.
- Browser B appears in Browser A's member list even though the original event was missed.

## 5. Reconnect and missed-message recovery remain intact

1. Put accepted Browser B offline.
2. Send a message from Browser A.
3. Restore Browser B's network without refreshing.
4. Send another live message in each direction.

Expected:

- Reconnecting/syncing status is visible and sending is disabled while disconnected.
- Browser B reauthenticates and rejoins the room.
- Missed messages are fetched and merged by message ID without duplication.
- Workspace membership is refreshed from the protected REST endpoint.
- Normal live delivery resumes after synchronization.

## 6. Socket room joining is not admission

Using a disposable test client authenticated as a non-member, emit `join_workspace` for Workspace W before accepting an invitation.

Expected:

- The server emits `socket_error` and does not add the socket to the workspace room.
- `Workspace.members` remains unchanged.
- After a real invitation acceptance commits, the same authenticated user may join normally.
