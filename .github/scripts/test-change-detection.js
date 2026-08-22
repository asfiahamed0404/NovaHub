/**
 * test-change-detection.js
 *
 * Node.js port of .github/scripts/test-change-detection.sh
 * Verifies the path-classification logic used in
 * .github/workflows/production-deploy.yml
 *
 * Run from repository root:
 *   node .github/scripts/test-change-detection.js
 */

// ── Detection function (mirrors workflow shell logic exactly) ────────────────
function detect(filesString) {
  const lines = filesString.split('\n').map(l => l.trim()).filter(Boolean);

  // Backend: under backend/, excluding *.md and backend/docs/
  const backendApp = lines.filter(f =>
    /^backend\//.test(f) &&
    !/\.md$/.test(f) &&
    !/^backend\/docs\//.test(f)
  );

  // Frontend: under frontend/, excluding *.md and frontend/docs/
  const frontendApp = lines.filter(f =>
    /^frontend\//.test(f) &&
    !/\.md$/.test(f) &&
    !/^frontend\/docs\//.test(f)
  );

  // Deployment workflow file (exact match)
  const deployFile = lines.filter(f =>
    f === '.github/workflows/production-deploy.yml'
  );

  return {
    backend:    backendApp.length > 0,
    frontend:   frontendApp.length > 0,
    deployment: deployFile.length > 0,
  };
}

// ── Assertion helper ─────────────────────────────────────────────────────────
let pass = 0;
let fail = 0;

function assert(label, files, wantB, wantF, wantD) {
  const { backend, frontend, deployment } = detect(files);
  if (backend === wantB && frontend === wantF && deployment === wantD) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.error(`  FAIL  ${label}`);
    console.error(`        want  backend=${wantB}  frontend=${wantF}  deployment=${wantD}`);
    console.error(`        got   backend=${backend}  frontend=${frontend}  deployment=${deployment}`);
    fail++;
  }
}

console.log('');
console.log('══════════════════════════════════════════════════════════════════');
console.log('  NovaHub — Change Detection Logic — Verification');
console.log('══════════════════════════════════════════════════════════════════');

// ── Group 1: Multi-commit push ───────────────────────────────────────────────
console.log('\n── Group 1: Multi-commit push (the key correctness scenario) ────');

// commit A (backend) + commit B (frontend) + commit C (workflow)
// git diff --name-only BEFORE AFTER shows ALL three files together.
assert('multi-commit: backend + frontend + workflow (all three)',
`backend/controllers/aiController.js
frontend/src/components/AiSummaryDialog.jsx
.github/workflows/production-deploy.yml`,
true, true, true);

assert('multi-commit: backend JS + backend README + frontend src',
`backend/controllers/invitationController.js
backend/README.md
frontend/src/App.jsx`,
true, true, false);

assert('multi-commit: all documentation across root and app dirs (docs-only)',
`README.md
docs/deployment/github-actions-production.md
backend/README.md
frontend/README.md`,
false, false, false);

// ── Group 2: Backend only ────────────────────────────────────────────────────
console.log('\n── Group 2: Backend only ─────────────────────────────────────────');

assert('backend JS source file',          'backend/models/User.js',          true,  false, false);
assert('backend package.json',            'backend/package.json',            true,  false, false);
assert('backend package-lock.json',       'backend/package-lock.json',       true,  false, false);
assert('backend docker-compose.yml',      'backend/tests/integration/docker-compose.yml', true, false, false);
assert('multiple backend source files',
`backend/services/ai/aiService.js
backend/routes/authRoutes.js
backend/middleware/validateAuth.js`,
true, false, false);

// ── Group 3: Frontend only ───────────────────────────────────────────────────
console.log('\n── Group 3: Frontend only ────────────────────────────────────────');

assert('frontend src file',       'frontend/src/App.jsx',        false, true, false);
assert('frontend vite.config.js', 'frontend/vite.config.js',     false, true, false);
assert('frontend package.json',   'frontend/package.json',       false, true, false);
assert('frontend vercel.json',    'frontend/vercel.json',        false, true, false);
assert('frontend index.html',     'frontend/index.html',         false, true, false);

// ── Group 4: Deployment workflow only ───────────────────────────────────────
console.log('\n── Group 4: Deployment workflow file only ────────────────────────');

assert('production-deploy.yml changed',
  '.github/workflows/production-deploy.yml',
  false, false, true);

// ── Group 5: Documentation only (no deployment) ─────────────────────────────
console.log('\n── Group 5: Documentation only (must NOT trigger deployment) ────');

assert('root README.md',                     'README.md',                      false, false, false);
assert('docs/ at root',                      'docs/deployment/some.md',        false, false, false);
assert('backend/README.md',                  'backend/README.md',              false, false, false);
assert('frontend/README.md',                 'frontend/README.md',             false, false, false);
assert('backend/docs/ subdirectory file',    'backend/docs/api.md',            false, false, false);
assert('frontend/docs/ subdirectory file',   'frontend/docs/components.md',    false, false, false);
assert('backend/tests/integration/README.md','backend/tests/integration/README.md', false, false, false);
assert('multiple .md files across all dirs',
`README.md
docs/screenshots/screenshot.png
backend/README.md
backend/docs/api.md
frontend/README.md
frontend/docs/components.md`,
false, false, false);

// ── Group 6: Mixed docs + real app changes ───────────────────────────────────
console.log('\n── Group 6: Mixed documentation + application changes ───────────');

assert('backend README + backend JS',
`backend/README.md
backend/controllers/invitationController.js`,
true, false, false);

assert('frontend README + frontend source',
`frontend/README.md
frontend/src/hooks/useLiveReadTracker.js`,
false, true, false);

assert('root README + backend + frontend + workflow',
`README.md
docs/testing/integration.md
backend/services/ai/aiService.js
frontend/src/components/AiSummaryDialog.jsx
.github/workflows/production-deploy.yml`,
true, true, true);

// ── Group 7: Backend + frontend without workflow ─────────────────────────────
console.log('\n── Group 7: Backend + frontend (no workflow change) ─────────────');

assert('backend model + frontend component',
`backend/models/Message.js
frontend/src/App.jsx`,
true, true, false);

assert('backend scripts + frontend tests',
`backend/scripts/runReadStateIntegrationTests.js
frontend/src/components/__tests__/AiSummaryDialog.test.jsx`,
true, true, false);

// ── Results ──────────────────────────────────────────────────────────────────
console.log('');
console.log('══════════════════════════════════════════════════════════════════');
console.log(`  Results: ${pass} passed, ${fail} failed`);
console.log('══════════════════════════════════════════════════════════════════');
console.log('');

if (fail > 0) process.exit(1);
