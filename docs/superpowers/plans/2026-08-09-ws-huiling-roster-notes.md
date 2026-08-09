# WS Huiling Roster and Student Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the supplied 83-student list into WS Huiling, authorize two Google accounts, and add detention plus visible special notes to student profiles.

**Architecture:** Keep the existing `WS HUILING` group and extend its CSV and idempotent database migrations. Extend the shared profile JSON contract across React, Express, and the Sites Worker, then map selected notes into independent roster labels. Update the hosted Google allowlist by merging the requested emails into the current value.

**Tech Stack:** React, Express, PostgreSQL JSONB, Cloudflare Worker/D1 JSON, Vitest, Node test runner, Playwright, Sites

## Global Constraints

- Do not add a `WS NG` teacher group.
- WS Huiling must contain 89 active students after a duplicate-safe merge.
- Preserve both `颜凯峯 · Y2` and `颜凯峯 · Y3`.
- Do not remove existing authorized Google emails.
- Special notes must display beneath the student name and wrap on mobile.

---

### Task 1: WS Huiling roster and migrations

**Files:**
- Create: `tests/fixtures/wsHuilingRequestedRoster.js`
- Modify: `tests/server/import-rosters.test.js`
- Modify: `tests/sites-worker.test.mjs`
- Modify: `tests/e2e/daycare.spec.js`
- Modify: `data/rosters/ws-huiling.csv`
- Create: `server/db/migrations/006_ws_huiling_additions.sql`
- Create: `drizzle/0005_ws_huiling_additions.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `scripts/import-rosters.mjs`

**Interfaces:**
- Consumes: 83 literal `[name, grade]` pairs from the user.
- Produces: `WS HUILING` with 89 active stable records in PostgreSQL, D1, and local imports.

- [x] **Step 1: Write failing exact-roster and browser tests**

Add literal expectations for the 89-student merged WS Huiling roster and both `颜凯峯` grade records.

- [x] **Step 2: Verify roster RED**

Run the focused import and Sites tests. Require failures showing 46 instead of 89.

- [x] **Step 3: Add CSV and idempotent migrations**

Update the four matching corrected source records and append `ws-huiling-047` through `ws-huiling-089` to the CSV. Apply the same updates/inserts from PostgreSQL and D1 migrations with stable conflict-safe identities.

- [x] **Step 4: Verify roster GREEN**

Repeat the focused import and Sites commands and require exact fixture equality.

### Task 2: Detention and special-note profile contract

**Files:**
- Modify: `tests/client/profile-options.test.jsx`
- Modify: `tests/client/student-lifecycle.test.jsx`
- Modify: `tests/server/students.test.js`
- Modify: `tests/sites-worker.test.mjs`
- Modify: `src/domain/profile.js`
- Modify: `server/domain/profile.js`
- Modify: `worker/index.js`
- Modify: `src/features/students/StudentProfileFields.jsx`

**Interfaces:**
- Consumes: five profile strings named in the design.
- Produces: one detention select, three independent note checkboxes, and one custom-note text input persisted through full and partial profile requests.

- [x] **Step 1: Write failing form and persistence tests**

Assert the exact detention options, checkbox selections, custom text, enrol request profile, Express update, and Worker update.

- [x] **Step 2: Verify profile RED**

Run focused client, Express, and Worker tests. Require missing-control or invalid-profile failures.

- [x] **Step 3: Extend the profile contract and form**

Add the five strings to all allowlists and render accessible controls in `StudentProfileFields`.

- [x] **Step 4: Verify profile GREEN**

Repeat focused tests and require all profile values to round-trip unchanged.

### Task 3: Visible special notes and hosted access

**Files:**
- Modify: `tests/client/roster.test.jsx`
- Modify: `tests/e2e/daycare.spec.js`
- Modify: `src/features/roster/studentProfileLabels.js`
- Modify: `src/features/roster/StudentCard.jsx`
- Modify: `src/styles/app.css`
- Update: hosted `GOOGLE_ALLOWED_EMAILS`

**Interfaces:**
- Consumes: selected preset-note fields and trimmed `specialNoteOther`.
- Produces: one `备注` label per nonempty note below the student name and merged hosted Google access.

- [x] **Step 1: Write failing label and mobile-flow tests**

Expect exact note labels and verify that saving/reopening the profile preserves them on desktop and mobile.

- [x] **Step 2: Verify label RED**

Run the roster test and require a failure because note labels are missing.

- [x] **Step 3: Implement note labels and responsive styling**

Map each active note to a stable purple label and use a unique key based on kind plus text.

- [x] **Step 4: Merge the two hosted Google emails**

Read the current allowlist, add only missing normalized emails, and update the runtime value without deleting existing accounts.

- [ ] **Step 5: Run complete verification and save one version**

Run all unit tests, Sites Worker tests, the production build, desktop Chromium, mobile Chromium, and `git diff --check`; then commit, push, package, and save one Sites version without public deployment until confirmation.
