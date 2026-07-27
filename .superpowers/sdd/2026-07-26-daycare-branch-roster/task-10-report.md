# Task 10 report

## Scope

Implemented local acceptance coverage, an isolated pg-mem/Vite browser harness, deployment configuration, environment-name examples, and the production operations runbook. No external repository, GitHub, Render service, production database, or production URL was mutated.

## RED evidence

- Initial bare `npm test` (2026-07-27): failed because Vitest collected `tests/sites-worker.test.mjs`, which belongs to Node's test runner. The managed sandbox also rejected Supertest transient listeners with `listen EPERM`; this is an execution-permission constraint, not an application assertion.
- Initial `npm run test:e2e`: 18/18 could not launch because Playwright Chromium build 1194 was absent.
- First runnable full E2E: 15/18 passed. Desktop and mobile lifecycle cases remained stuck at `保存中…`; the mobile retry assertion also assumed an initially inactive event.
- Focused lifecycle/retry rerun before the application fix: lifecycle failed in both projects, while the corrected relative-state retry cases passed. Root cause: Strict Mode's development effect replay ran lifecycle cleanup once and left `activeRef.current` false.

## GREEN evidence

- Added `activeRef.current = true` during effect setup in Enrol, stop, and restore dialogs.
- Focused `npm run test:e2e -- --grep "enrol, stop|failed attendance"`: 4/4 passed across desktop Chromium 1440×900 and mobile Chromium 390×844.
- Final full verification results are recorded below after fresh commands.

## Acceptance coverage

- first-screen mobile bounds and exact `MK`, `STP`, `WS` order;
- exact three teacher groups per branch and cross-branch absence;
- MK isolation, `MK QIAO EN` exact 40, and no 基础班;
- Enrol → stop → restore with the same UUID;
- failed attendance rollback and retry;
- nonexistent search clears the profile and save/message actions;
- logout invalidates the session;
- API branch/group mismatch returns `GROUP_BRANCH_MISMATCH`;
- `PS STP` total 121 with fewer than 30 mounted cards;
- every case runs in both configured viewports against an isolated imported pg-mem database.

## Verification results

- `npm test`: PASS — 14 test files, 95 tests.
- `npm run build`: PASS — 52 modules transformed; emitted `dist/client/index.html`, client assets, `dist/server/index.js`, and `dist/.openai/hosting.json`.
- `npm run test:sites`: PASS — 4 Node tests.
- `npm run test:e2e`: PASS — 18 tests, comprising nine acceptance cases in desktop Chromium 1440×900 and mobile Chromium 390×844.
- `git diff --check`: PASS.
- Playwright Chromium build 1194 was installed locally as a test-runtime prerequisite; it is not a repository artifact.

## Deployment blockers and prerequisites

- `git remote -v` and `git config --get remote.origin.url` return no configured remote.
- `.openai/hosting.json` contains `{ "d1": null, "r2": null }`; it identifies no active hosting resources or Render service.
- No Render connector, service ID, production URL, or authorization to create/mutate Render resources was supplied.
- No production `DATABASE_URL`, backup location, environment secrets, Google OAuth production origin, or approved production smoke-test account was supplied.
- Deployment therefore requires an identified Git repository/branch, Render account/service access, a decision to create a new optimized service or replace a named existing one, pre-migration backup access, all environment variables from `docs/operations.md`, and authorization for production smoke checks.
- Production `/api/health`, first-screen, roster, lifecycle, and smoke checks were not run and must not be reported as passing until deployment access exists.
