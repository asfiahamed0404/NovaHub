#!/usr/bin/env bash
# .github/scripts/test-change-detection.sh
#
# Verifies the path-classification logic used in
# .github/workflows/production-deploy.yml
#
# Simulates git diff --name-only output for a variety of push scenarios,
# including multi-commit pushes, and asserts the correct backend_changed /
# frontend_changed / deployment_changed values.
#
# Usage (run from repository root):
#   bash .github/scripts/test-change-detection.sh
#
# Exit code: 0 = all assertions pass, 1 = one or more failed.

set -euo pipefail

PASS=0
FAIL=0

# ─── Detection function ───────────────────────────────────────────────────────
# Mirrors the shell logic in the detect-changes job exactly.
# Input : newline-separated list of changed file paths (as from git diff)
# Output: "BACKEND|FRONTEND|DEPLOYMENT"  (true/false each)
detect() {
  local files="$1"

  # Backend: files under backend/ excluding *.md and backend/docs/
  local backend_app
  backend_app=$(printf '%s\n' "$files" \
    | grep -E '^backend/' \
    | grep -vE '(\.md$|^backend/docs/)' \
    || true)

  # Frontend: files under frontend/ excluding *.md and frontend/docs/
  local frontend_app
  frontend_app=$(printf '%s\n' "$files" \
    | grep -E '^frontend/' \
    | grep -vE '(\.md$|^frontend/docs/)' \
    || true)

  # Deployment workflow file (exact match)
  local deploy_file
  deploy_file=$(printf '%s\n' "$files" \
    | grep -xF '.github/workflows/production-deploy.yml' \
    || true)

  local b=false f=false d=false
  [ -n "$backend_app"  ] && b=true
  [ -n "$frontend_app" ] && f=true
  [ -n "$deploy_file"  ] && d=true

  echo "${b}|${f}|${d}"
}

# ─── Assertion helper ─────────────────────────────────────────────────────────
assert() {
  local label="$1"
  local files="$2"
  local want_b="$3"
  local want_f="$4"
  local want_d="$5"

  local result
  result=$(detect "$files")
  local got_b got_f got_d
  IFS='|' read -r got_b got_f got_d <<< "$result"

  if [ "$got_b" = "$want_b" ] && \
     [ "$got_f" = "$want_f" ] && \
     [ "$got_d" = "$want_d" ]; then
    printf '  PASS  %s\n' "$label"
    PASS=$((PASS + 1))
  else
    printf '  FAIL  %s\n' "$label"
    printf '        want  backend=%-5s  frontend=%-5s  deployment=%s\n' \
      "$want_b" "$want_f" "$want_d"
    printf '        got   backend=%-5s  frontend=%-5s  deployment=%s\n' \
      "$got_b"  "$got_f"  "$got_d"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "  NovaHub — Change Detection Logic — Verification"
echo "══════════════════════════════════════════════════════════════════"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# GROUP 1: Multi-commit push scenarios
# Simulates a push where each "commit" changes a different component.
# The git diff range covers ALL commits, so all three should be detected.
# ─────────────────────────────────────────────────────────────────────────────
echo "── Group 1: Multi-commit push ────────────────────────────────────"

# commit A: backend change
# commit B: frontend change
# commit C: workflow change
# → all three outputs must be true
assert "multi-commit: backend + frontend + workflow" \
"backend/controllers/aiController.js
frontend/src/components/AiSummaryDialog.jsx
.github/workflows/production-deploy.yml" \
true true true

# commit A: backend
# commit B: backend README (documentation, must not count)
# commit C: frontend
# → backend=true, frontend=true, deployment=false
assert "multi-commit: backend JS + backend README + frontend src" \
"backend/controllers/invitationController.js
backend/README.md
frontend/src/App.jsx" \
true true false

# commit A: root docs
# commit B: backend README
# commit C: frontend README
# → all false (docs-only push)
assert "multi-commit: all documentation across root and app dirs" \
"README.md
docs/deployment/github-actions-production.md
backend/README.md
frontend/README.md" \
false false false

# ─────────────────────────────────────────────────────────────────────────────
# GROUP 2: Backend-only changes
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "── Group 2: Backend only ─────────────────────────────────────────"

assert "backend JS source file" \
  "backend/models/User.js" \
  true false false

assert "backend package.json" \
  "backend/package.json" \
  true false false

assert "backend package-lock.json" \
  "backend/package-lock.json" \
  true false false

assert "backend services + routes (multiple files)" \
"backend/services/ai/aiService.js
backend/routes/authRoutes.js
backend/middleware/validateAuth.js" \
true false false

assert "backend integration test file (docker-compose)" \
  "backend/tests/integration/docker-compose.yml" \
  true false false

# ─────────────────────────────────────────────────────────────────────────────
# GROUP 3: Frontend-only changes
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "── Group 3: Frontend only ────────────────────────────────────────"

assert "frontend src file" \
  "frontend/src/App.jsx" \
  false true false

assert "frontend vite.config.js" \
  "frontend/vite.config.js" \
  false true false

assert "frontend package.json" \
  "frontend/package.json" \
  false true false

assert "frontend vercel.json" \
  "frontend/vercel.json" \
  false true false

assert "frontend public asset" \
  "frontend/public/favicon.svg" \
  false true false

assert "frontend index.html" \
  "frontend/index.html" \
  false true false

# ─────────────────────────────────────────────────────────────────────────────
# GROUP 4: Deployment workflow file only
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "── Group 4: Deployment workflow only ────────────────────────────"

assert "production-deploy.yml changed" \
  ".github/workflows/production-deploy.yml" \
  false false true

# ─────────────────────────────────────────────────────────────────────────────
# GROUP 5: Documentation-only — must NOT trigger any deployment
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "── Group 5: Documentation only (no deployment expected) ─────────"

assert "root README.md" \
  "README.md" \
  false false false

assert "docs/ directory file at root" \
  "docs/deployment/github-actions-production.md" \
  false false false

assert "backend/README.md (docs inside backend/)" \
  "backend/README.md" \
  false false false

assert "frontend/README.md (docs inside frontend/)" \
  "frontend/README.md" \
  false false false

assert "backend/docs/ subdirectory file" \
  "backend/docs/api.md" \
  false false false

assert "frontend/docs/ subdirectory file" \
  "frontend/docs/components.md" \
  false false false

assert "backend/tests/integration/README.md" \
  "backend/tests/integration/README.md" \
  false false false

assert "multiple .md files across root and app directories" \
"README.md
docs/screenshots/screenshot.png
backend/README.md
backend/docs/api.md
frontend/README.md
frontend/docs/components.md" \
false false false

# ─────────────────────────────────────────────────────────────────────────────
# GROUP 6: Mixed docs + real app changes
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "── Group 6: Mixed documentation + application changes ───────────"

assert "backend README + backend JS (should trigger backend)" \
"backend/README.md
backend/controllers/invitationController.js" \
true false false

assert "frontend README + frontend source (should trigger frontend)" \
"frontend/README.md
frontend/src/hooks/useLiveReadTracker.js" \
false true false

assert "root README + backend + frontend + workflow (full multi-commit)" \
"README.md
docs/testing/integration.md
backend/services/ai/aiService.js
frontend/src/components/AiSummaryDialog.jsx
.github/workflows/production-deploy.yml" \
true true true

# ─────────────────────────────────────────────────────────────────────────────
# GROUP 7: Backend + frontend without workflow
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "── Group 7: Backend + frontend (no workflow change) ─────────────"

assert "backend model + frontend component" \
"backend/models/Message.js
frontend/src/App.jsx" \
true true false

assert "backend scripts + frontend tests" \
"backend/scripts/runReadStateIntegrationTests.js
frontend/src/components/__tests__/AiSummaryDialog.test.jsx" \
true true false

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════════"
printf '  Results: %d passed, %d failed\n' "$PASS" "$FAIL"
echo "══════════════════════════════════════════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
