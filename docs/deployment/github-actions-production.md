# GitHub Actions Production Deployment — NovaHub

GitHub Actions is the **sole production deployment authority** for NovaHub.
This document describes the change-aware CI/CD pipeline, required credentials,
platform settings, failure behavior, and human setup steps.

---

## Workflow file

`.github/workflows/production-deploy.yml`

---

## Triggers

| Event | Branches | Deploys? |
|---|---|---|
| `push` | `main` only | Yes — if relevant paths changed |
| `workflow_dispatch` | any | Yes — for selected component |
| `push` | `dev` or any other | **Never** |
| `pull_request` | any | **Never** |

---

## Change-Detection Strategy

The `detect-changes` job runs `git diff --name-only HEAD~1 HEAD` and emits
three boolean outputs consumed by all downstream jobs.

| Output | True when… |
|---|---|
| `backend_changed` | Any file under `backend/**` changed |
| `frontend_changed` | Any file under `frontend/**` changed |
| `deployment_changed` | `.github/workflows/production-deploy.yml` changed |

Documentation-only files (`README.md`, `docs/**`, `*.md`, `socket-test.html`)
do **not** set any of the three outputs, so the pipeline exits successfully
without deploying anything.

---

## Execution Matrix

### Case A — Backend only changed

```
detect-changes
    ↓
validate-backend
    ↓
deploy-backend  (Railway deploy + health check)
```

Vercel is **not** touched.

### Case B — Frontend only changed

```
detect-changes
    ↓
validate-frontend
    ↓
deploy-frontend  (Vercel deploy + health check)
```

Railway is **not** touched.

### Case C — Both changed

```
detect-changes
    ↓  (parallel)
validate-backend          validate-frontend
    ↓
deploy-backend  (Railway deploy + health check)
    ↓
deploy-frontend  (Vercel deploy + health check)
```

Frontend deployment waits for successful backend deployment **and** its health
check. If the backend health check fails, the frontend deployment job does not
start.

### Case D — Documentation-only change

```
detect-changes
    → backend_changed=false, frontend_changed=false, deployment_changed=false
    → pipeline exits successfully ("nothing to deploy")
```

No validation. No Railway. No Vercel.

### Case E — Deployment workflow file changed only

```
detect-changes
    ↓  (deployment_changed=true triggers validation)
validate-backend  +  validate-frontend  (both run as correctness check)
```

No Railway deployment. No Vercel deployment. The currently-running production
services are built from unchanged application code; redeploying them would be
unnecessary and risky. Running the full validation suite confirms the updated
workflow logic is sound against the real test suite.

---

## Manual Dispatch (`workflow_dispatch`)

The `component` input lets an operator override path detection entirely:

| Input | Effect |
|---|---|
| `both` (default) | validate + deploy backend and frontend |
| `backend` | validate + deploy backend only |
| `frontend` | validate + deploy frontend only |

Use cases:
- Railway environment variable changed → dispatch `backend`
- Vercel environment variable changed → dispatch `frontend`
- Major release requiring full redeploy → dispatch `both`

---

## Job Dependency Graph

```
detect-changes ──────────────────────────────────────────┐
    │                                                     │
    ├─→ validate-backend ──→ deploy-backend               │
    │                              │                      │
    └─→ validate-frontend          └──→ deploy-frontend ←─┘
                  └─────────────────────→ deploy-frontend
```

`deploy-frontend` depends on both `validate-frontend` AND `deploy-backend`
(when backend also changed).

---

## Concurrency

```yaml
concurrency:
  group: novahub-production
  cancel-in-progress: false
```

Only one production deployment may run at a time. A second push to `main`
while a deployment is running queues behind it rather than cancelling it,
ensuring Railway and Vercel versions remain consistent.

---

## Required GitHub Secrets

Navigate to **Repository Settings → Secrets and variables → Actions → Secrets**:

| Secret | Description | Source |
|---|---|---|
| `RAILWAY_TOKEN` | Railway Project Token for production | Railway → Project Settings → Tokens |
| `VERCEL_TOKEN` | Vercel Personal Access Token | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel organization/user ID | `vercel whoami` or Vercel Team Settings |
| `VERCEL_PROJECT_ID` | Vercel project ID for the NovaHub frontend | Vercel → Project Settings → General |

> [!IMPORTANT]
> Do **not** add `MONGO_URI`, `JWT_SECRET`, or the Cloudflare Workers AI API
> token to GitHub Secrets. These are runtime secrets that live in Railway and
> Vercel respectively and must never pass through GitHub Actions.

---

## Recommended GitHub Variables

Navigate to **Repository Settings → Secrets and variables → Actions → Variables**:

| Variable | Default | Description |
|---|---|---|
| `RAILWAY_SERVICE` | `backend` | Railway service name |
| `RAILWAY_ENVIRONMENT` | `production` | Railway environment name |
| `BACKEND_HEALTH_URL` | `https://novahub-production.up.railway.app/` | Backend health check URL |
| `FRONTEND_HEALTH_URL` | `https://nova-hub-sage.vercel.app/` | Frontend smoke-check URL |

These are not secrets. Defaults are baked into the workflow; variables only
need to be set if they differ from the defaults.

---

## Validation Commands

### Backend validation (`validate-backend`)
Node 24, run from `backend/`:

1. `npm ci`
2. `node --check server.js` — syntax check entry point
3. `node --check app.js` — syntax check Express app
4. `npm audit`
5. `npm run test:integration:readstate:docker` — ReadState tests (disposable MongoDB replica set)
6. `npm run test:integration:aisummary:docker` — AI Summary tests (disposable MongoDB, Cloudflare mocked via `setAiProviderOverride`)
7. `npm run test:integration:invitations:all:docker` — Invitations DB + Socket.IO tests (disposable MongoDB)
8. Inline Docker Compose + `node --test` for `rolePlanEntitlements.integration.test.js` (disposable MongoDB)

All integration test databases are disposable. The Compose project names are unique per
suite (`novahub-readstate-tests`, `novahub-aisummary-tests`, `novahub-invitation-tests`,
`novahub-entitlement-tests`). MongoDB 8 single-node replica set on port 27019.
Production `MONGO_URI` is never used.

### Frontend validation (`validate-frontend`)
Node 24, run from `frontend/`:

1. `npm ci`
2. `npm test` → `vitest run`
3. `npm run lint` → `eslint .`
4. `npm run build` → `vite build`
5. `npm audit`

---

## Deployment Commands

### Backend (Railway)

```bash
npm install -g @railway/cli

railway up \
  --service "$RAILWAY_SERVICE" \
  --environment "$RAILWAY_ENVIRONMENT" \
  --ci
```

Authenticated via `RAILWAY_TOKEN` environment variable. Executed from the
repository root; Railway's existing Root Directory setting (`backend`) handles
path selection. No application secrets are passed.

**Health check** — polls `BACKEND_HEALTH_URL` up to 30 times with 10 s delay,
15 s curl timeout. Validates HTTP 200 **and** response body containing
`"NovaHub API is running"`.

### Frontend (Vercel)

```bash
npm install -g vercel

# Run from frontend/
vercel pull --yes --environment=production --token="$VERCEL_TOKEN"
vercel build --prod --token="$VERCEL_TOKEN"
vercel deploy --prebuilt --prod --token="$VERCEL_TOKEN"
```

`VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` are exposed as job environment
variables from GitHub Secrets. Production environment variables (`VITE_API_URL`,
`VITE_SOCKET_URL`, `VITE_ENABLE_LEGACY_WORKSPACE_JOIN`) are managed inside
Vercel and pulled by `vercel pull`.

**Health check** — polls `FRONTEND_HEALTH_URL` up to 15 times with 5 s delay,
15 s curl timeout. Validates HTTP 200 **and** response body containing
`"NovaHub"`.

---

## Failure Matrix

| Scenario | Result |
|---|---|
| Documentation-only push to main | Pipeline exits successfully — nothing deployed |
| `detect-changes` job fails | All downstream jobs skipped (no deployment) |
| `validate-backend` fails | `deploy-backend` blocked — nothing deployed |
| `validate-frontend` fails | `deploy-frontend` blocked — nothing deployed |
| `deploy-backend` step fails | `deploy-frontend` blocked (when backend+frontend both changed) |
| Backend health check fails | `deploy-frontend` blocked (when backend+frontend both changed) |
| `deploy-frontend` step fails | Backend already deployed and healthy; frontend fails visibly |
| Frontend health check fails | Workflow marked failed — frontend may or may not be serving |

---

## One-Time Platform Settings

> [!IMPORTANT]
> These settings must be changed **before** merging the workflow to `main`.
> Failure to do so may cause Railway or Vercel to deploy outside of GitHub
> Actions control.

### Railway
- Dashboard → Project → backend Service → Settings → **GitHub Deployments**
- Set **Automatic Deployments → OFF** permanently.

### Vercel
- Dashboard → NovaHub Project → Settings → Git → **Production Branch auto-deploy**
- Disable / set to **Ignored** permanently.

GitHub Actions remains the only entity that pushes deployments to Railway and
Vercel. The Vercel CLI `--prebuilt --prod` flow continues to work even when
Vercel's own Git-triggered builds are disabled.

---

## Security

```yaml
permissions:
  contents: read
```

- Workflow-level permission is `contents: read` — the minimum needed.
- No secrets are echoed or interpolated into log output.
- `RAILWAY_TOKEN` is consumed only as an environment variable by the Railway
  CLI; it is never printed.
- Vercel secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`) are
  set as environment variables on the deploy step only; they are not available
  to the Vite build and cannot appear in the browser bundle.
- Railway runtime secrets (`MONGO_URI`, `JWT_SECRET`, Cloudflare AI token)
  are stored in Railway environment only and are never referenced in this
  workflow.

---

## Human Setup Checklist (Before Merging main)

- [ ] Add `RAILWAY_TOKEN` to GitHub Secrets
- [ ] Add `VERCEL_TOKEN` to GitHub Secrets
- [ ] Add `VERCEL_ORG_ID` to GitHub Secrets
- [ ] Add `VERCEL_PROJECT_ID` to GitHub Secrets
- [ ] (Optional) Set GitHub Variables: `RAILWAY_SERVICE`, `RAILWAY_ENVIRONMENT`, `BACKEND_HEALTH_URL`, `FRONTEND_HEALTH_URL`
- [ ] Turn **OFF** Railway GitHub Auto Deploy for the `backend` service
- [ ] Disable Vercel Git automatic production builds for the NovaHub project
- [ ] Run `workflow_dispatch` with `component=both` as a dry-run smoke test before the first real `main` merge
