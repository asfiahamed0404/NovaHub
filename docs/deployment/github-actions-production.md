# NovaHub production CI/CD

The production workflow is `.github/workflows/production-deploy.yml`. It
validates path-selected application changes and deploys the backend to Cloud
Run when backend application code reaches `main`. The frontend is deployed
independently by Vercel's Git integration when `main` changes.

## Production targets

| Component | Target |
|---|---|
| Backend | Cloud Run service `novahub-backend` in `novahub-asfi-0404`, region `asia-south1` |
| Backend image | `asia-south1-docker.pkg.dev/novahub-asfi-0404/novahub/novahub-backend:<git-sha>` |
| Backend health | `https://novahub-backend-183612833653.asia-south1.run.app/health` |
| Frontend | Vercel production project at `https://nova-hub-sage.vercel.app` |

Railway is not part of the production deployment path.

## Triggers

| Event | Ref | Behavior |
|---|---|---|
| `pull_request` | Targeting `main` | Detect and validate changed components; never deploy |
| `push` | `main` only | Detect and validate changed components; GitHub Actions deploys only changed backend code |
| `workflow_dispatch` | Any selectable ref | Validate the selected component; GitHub Actions deploys the backend only when selected on `main` |

Manual dispatch accepts `both`, `backend`, or `frontend`. Selecting a non-main
ref is intentionally validation-only. Selecting `frontend` is validation-only
even on `main`; selecting `both` on `main` can deploy the backend after
validation. Manual dispatch does not trigger a Vercel deployment.

## Path-aware behavior

Change detection compares the entire event range, not only `HEAD~1`:

- Pull requests use the PR base SHA through head SHA.
- Pushes use `github.event.before` through `github.sha`.
- A zero `before` SHA safely treats both applications and the workflow as
  changed.
- `backend/**` changes, excluding Markdown and `backend/docs/**`, select the
  backend.
- `frontend/**` changes, excluding Markdown and `frontend/docs/**`, select the
  frontend.
- A change only to the production workflow validates both components but does
  not deploy either application.
- Documentation-only changes do not validate or deploy an application.

| Changed paths | GitHub Actions validation | GitHub Actions deployment |
|---|---|---|
| Backend only | Backend | Cloud Run, then backend health check |
| Frontend only | Frontend | None |
| Backend and frontend | Both | Cloud Run, then backend health check |
| Documentation only | Neither | None |
| Workflow only | Both | None |

For a push to `main`, Vercel's connected Git integration handles frontend
production deployment separately. GitHub Actions path detection does not
control Vercel's Git-triggered builds. Whether a docs-only or workflow-only
push creates a Vercel deployment depends on the Vercel project's settings.

All production-capable GitHub Actions runs use the `novahub-production`
concurrency group with cancellation disabled. A newer run queues instead of
interrupting an in-progress backend deployment. This does not sequence or
gate Vercel deployments.

## Validation before deployment

Backend validation uses Node 24 and runs:

1. `npm ci`
2. Syntax checks for `server.js` and `app.js`
3. `npm audit`
4. ReadState integration tests
5. AI Summary integration tests
6. Invitation database and Socket.IO integration tests
7. Workspace Memory integration tests
8. Workspace MCP integration tests
9. Workspace Agent integration tests
10. Workspace Agent route integration tests
11. Approved Memory route integration tests
12. Role / Plan / Entitlements integration tests
13. Platform Admin integration tests

The integration suites use disposable Docker Compose MongoDB replica sets and
do not use the production database.

Frontend validation uses Node 24 and runs `npm ci`, `npm test`, `npm run lint`,
`npm run build`, and `npm audit`.

When both applications change, the CI gate waits for both validation jobs.
Cloud Run deployment starts only after that gate succeeds. Frontend production
deployment is independent: `GitHub main` → Vercel Git integration → automatic
Vercel production deployment. It does not wait for the GitHub Actions CI gate
or Cloud Run health check.

The backend path is `GitHub main` → GitHub Actions → validation → Docker
build → Artifact Registry → Cloud Run → health check. Pull requests run
validation but do not cause a production deployment from GitHub Actions.

## Backend image deployment

The backend deployment job:

1. Exchanges the GitHub OIDC token for short-lived Google credentials.
2. Configures the Google Cloud CLI and Artifact Registry Docker credential
   helper.
3. Builds `backend/Dockerfile` with build context `backend/`.
4. Tags and pushes the image with the full Git commit SHA. A rerun reuses an
   existing image for that commit instead of moving the tag.
5. Runs `gcloud run deploy novahub-backend --image <exact-sha-image>`.
6. Polls `/health` until it returns HTTP 200 with
   `{"status":"ok","service":"novahub-backend"}`.

The deploy command changes only the container image. It deliberately does not
use `--set-env-vars`, `--clear-env-vars`, `--set-secrets`, or
`--clear-secrets`. Existing Cloud Run configuration therefore carries into the
new revision, including:

- `CLIENT_URL`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_AI_MODEL`
- the `MONGO_URI` Secret Manager mapping
- the `JWT_SECRET` Secret Manager mapping
- the `CLOUDFLARE_API_TOKEN` Secret Manager mapping

## GitHub configuration

Create these repository Actions variables:

| Variable | Value |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full provider resource name: `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/<POOL_ID>/providers/<PROVIDER_ID>` |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | Email of the dedicated GitHub deployment service account |

No GitHub Actions Vercel CLI secrets are required for this workflow. There is
no Google service-account JSON secret. Runtime values such as
`MONGO_URI`, `JWT_SECRET`, and `CLOUDFLARE_API_TOKEN` remain in Cloud Run and
Secret Manager and are not copied into GitHub.

## One-time Google Cloud setup

The repository does not prove that Workload Identity Federation resources
already exist. Inspect Google Cloud first, then create only what is missing.
Run the following in Google Cloud Shell as an administrator. Replace the three
angle-bracket placeholders with identifiers you have inspected or chosen; do
not copy placeholder text into Google Cloud.

```bash
PROJECT_ID="novahub-asfi-0404"
REGION="asia-south1"
ARTIFACT_REPOSITORY="novahub"
GITHUB_REPOSITORY="asfiahamed0404/NovaHub"
POOL_ID="<POOL_ID>"
PROVIDER_ID="<PROVIDER_ID>"
DEPLOY_SERVICE_ACCOUNT_NAME="<DEPLOY_SERVICE_ACCOUNT_NAME>"
DEPLOY_SERVICE_ACCOUNT_EMAIL="${DEPLOY_SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project "$PROJECT_ID"

gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

gcloud iam workload-identity-pools list \
  --project="$PROJECT_ID" \
  --location=global

gcloud iam service-accounts describe "$DEPLOY_SERVICE_ACCOUNT_EMAIL" \
  --project="$PROJECT_ID" \
  || gcloud iam service-accounts create "$DEPLOY_SERVICE_ACCOUNT_NAME" \
    --project="$PROJECT_ID" \
    --display-name="NovaHub GitHub production deployer"

gcloud iam workload-identity-pools describe "$POOL_ID" \
  --project="$PROJECT_ID" \
  --location=global \
  || gcloud iam workload-identity-pools create "$POOL_ID" \
    --project="$PROJECT_ID" \
    --location=global \
    --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location=global \
  --workload-identity-pool="$POOL_ID" \
  || gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --project="$PROJECT_ID" \
    --location=global \
    --workload-identity-pool="$POOL_ID" \
    --display-name="NovaHub GitHub Actions" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository == '${GITHUB_REPOSITORY}' && assertion.ref == 'refs/heads/main'"

WORKLOAD_IDENTITY_POOL_NAME="$(gcloud iam workload-identity-pools describe "$POOL_ID" \
  --project="$PROJECT_ID" \
  --location=global \
  --format='value(name)')"

gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SERVICE_ACCOUNT_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_NAME}/attribute.repository/${GITHUB_REPOSITORY}"

gcloud artifacts repositories add-iam-policy-binding "$ARTIFACT_REPOSITORY" \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --role="roles/artifactregistry.writer" \
  --member="serviceAccount:${DEPLOY_SERVICE_ACCOUNT_EMAIL}"

# Enforce that a Git-SHA tag cannot later be moved to a different image.
gcloud artifacts repositories update "$ARTIFACT_REPOSITORY" \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --immutable-tags

gcloud run services add-iam-policy-binding novahub-backend \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --role="roles/run.developer" \
  --member="serviceAccount:${DEPLOY_SERVICE_ACCOUNT_EMAIL}"

RUNTIME_SERVICE_ACCOUNT="$(gcloud run services describe novahub-backend \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format='value(spec.template.spec.serviceAccountName)')"

if [ -z "$RUNTIME_SERVICE_ACCOUNT" ]; then
  RUNTIME_SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
fi

gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SERVICE_ACCOUNT" \
  --project="$PROJECT_ID" \
  --role="roles/iam.serviceAccountUser" \
  --member="serviceAccount:${DEPLOY_SERVICE_ACCOUNT_EMAIL}"

gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location=global \
  --workload-identity-pool="$POOL_ID" \
  --format='value(name)'
```

Put the final command's output in `GCP_WORKLOAD_IDENTITY_PROVIDER`, and put
`$DEPLOY_SERVICE_ACCOUNT_EMAIL` in `GCP_DEPLOY_SERVICE_ACCOUNT`.

The deployment service account needs only:

- Workload Identity User on itself, granted to the repository principal set.
- Artifact Registry Writer on the `novahub` repository. Writer also supplies
  the image-read permission needed during deployment.
- Cloud Run Developer on the existing `novahub-backend` service.
- Service Account User on the Cloud Run runtime service account.

The Cloud Run runtime service account—not the GitHub deployer—must retain
Secret Manager Secret Accessor access to the runtime secrets it consumes.

## Platform settings before enabling deployment

1. Add the two GitHub variables above.
2. Confirm the Artifact Registry repository already exists at
   `asia-south1-docker.pkg.dev/novahub-asfi-0404/novahub` and has immutable
   tags enabled.
3. Confirm `novahub-backend` still has all expected variables and secret
   mappings.
4. Disable any remaining Railway GitHub auto-deploy integration.
5. Keep the Vercel Git integration enabled for this repository, with `main` as
   its production branch and the frontend project settings configured.
6. Run `workflow_dispatch` on `main` for a backend deployment after setup, if
   needed. A frontend selection runs validation only.

Do not treat a backend manual dispatch as a dry run: on `main`, it performs a
real Cloud Run production deployment.

## Failure behavior

- A backend validation or CI-gate failure prevents GitHub Actions from
  deploying the backend.
- An Artifact Registry push or Cloud Run deploy failure marks the workflow
  failed.
- A backend health-check failure marks the workflow failed, but does not gate
  Vercel's independent Git deployment.
- A frontend validation failure marks the GitHub Actions workflow failed, but
  does not itself prevent Vercel's independent Git deployment. Frontend
  deployment failures are reported by Vercel, not this workflow.
- Runtime configuration is not rolled back or rewritten by this workflow.
