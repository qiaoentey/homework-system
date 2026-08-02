# STP Yuan Ning Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `YUAN NING` STP option, transfer 38 matched PS students without losing their records, and add five new students so the final Yuan Ning roster contains exactly 43 active students.

**Architecture:** Keep the fixed catalog as the authorization boundary in both Express and the Sites Worker. Represent the approved final roster in CSV files, and use parallel PostgreSQL and D1 migrations to create the group, move students by stable `source_ref`, correct six display names, and insert five new records. Existing child records remain in place so linked profiles, attendance, messages, and activity history remain intact.

**Tech Stack:** React 19, Express 5, PostgreSQL migrations, Cloudflare D1/SQLite migrations, Node test runner, Vitest, Playwright, Sites hosting.

## Global Constraints

- The new group code is exactly `YUAN NING STP`, belongs to `STP`, and has visible label `YUAN NING`.
- The final counts are `PS STP = 83`, `YUAN NING STP = 43`, and system-wide active students `= 555`.
- The 38 transferred students preserve their existing UUIDs and every linked record.
- The six spelling corrections and five new-student grades must match the design spec exactly.
- No student outside the 38 exact PS `source_ref` values may be moved.
- Existing Google authentication, branch-first navigation, and all other groups remain unchanged.

---

### Task 1: Lock the catalog and roster contracts with failing tests

**Files:**
- Modify: `tests/server/catalog.test.js`
- Modify: `tests/server/schema.test.js`
- Modify: `tests/server/import-rosters.test.js`
- Modify: `tests/sites-worker.test.mjs`
- Modify: `tests/client/branch-flow.test.jsx`
- Modify: `tests/e2e/daycare.spec.js`

**Interfaces:**
- Consumes: existing `/api/catalog`, `ROSTER_FILES`, and D1 migration test helpers.
- Produces: executable expectations for `YUAN NING STP`, the final counts, the exact 43-student roster, and preservation of transferred IDs.

- [ ] **Step 1: Add the new catalog expectations**

Change STP expectations to:

```js
[
  { code: "巧恩 STP", label: "巧恩" },
  { code: "PS STP", label: "PS" },
  { code: "SY STP", label: "SY" },
  { code: "YUAN NING STP", label: "YUAN NING" },
]
```

Update the schema expectation from nine to ten teacher groups and the end-to-end wording from “exactly three teacher groups” to branch-specific catalog options.

- [ ] **Step 2: Add the final roster expectations**

Set the approved counts to:

```js
{
  "MK HAPPY": 82,
  "MK QIAO EN": 40,
  "MK WEN XUAN": 18,
  "巧恩 STP": 90,
  "PS STP": 83,
  "SY STP": 50,
  "YUAN NING STP": 43,
  "WS HUILING": 46,
  "WS JIA WEN": 61,
  "WS MIXIN": 42,
}
```

Add a D1 assertion that the 43 Yuan Ning names and grades equal the literal roster in the design spec. Query these transferred source references and assert all 38 rows remain on their original `dc05` IDs:

```js
[
  "stp-ps-001", "stp-ps-003", "stp-ps-004", "stp-ps-005",
  "stp-ps-006", "stp-ps-007", "stp-ps-008", "stp-ps-010",
  "stp-ps-011", "stp-ps-012", "stp-ps-013", "stp-ps-014",
  "stp-ps-016", "stp-ps-017", "stp-ps-018", "stp-ps-020",
  "stp-ps-021", "stp-ps-022", "stp-ps-023", "stp-ps-026",
  "stp-ps-027", "stp-ps-028", "stp-ps-030", "stp-ps-031",
  "stp-ps-032", "stp-ps-033", "stp-ps-035", "stp-ps-036",
  "stp-ps-038", "stp-ps-039", "stp-ps-040", "stp-ps-042",
  "stp-ps-043", "stp-ps-044", "stp-ps-045", "stp-ps-115",
  "stp-ps-117", "stp-ps-119",
]
```

Also assert none of those source references remains in `PS STP`.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
node --test --test-name-pattern="catalog|migration" tests/sites-worker.test.mjs
npm test -- tests/server/catalog.test.js tests/server/schema.test.js tests/server/import-rosters.test.js tests/client/branch-flow.test.jsx
```

Expected: failures show that `YUAN NING STP` is missing, PS still has 121 students, and the new roster file/migration does not exist.

- [ ] **Step 4: Commit the failing contract tests**

```bash
git add tests/server/catalog.test.js tests/server/schema.test.js tests/server/import-rosters.test.js tests/sites-worker.test.mjs tests/client/branch-flow.test.jsx tests/e2e/daycare.spec.js
git commit -m "test: define STP Yuan Ning roster"
```

---

### Task 2: Add the approved roster sources and safe data migrations

**Files:**
- Modify: `data/rosters/stp-ps.csv`
- Create: `data/rosters/stp-yuan-ning.csv`
- Modify: `scripts/import-rosters.mjs`
- Create: `server/db/migrations/004_stp_yuan_ning.sql`
- Create: `drizzle/0003_stp_yuan_ning.sql`
- Modify: `drizzle/meta/_journal.json`

**Interfaces:**
- Consumes: the 38 PS `source_ref` values and five new names from the design spec.
- Produces: `ROSTER_FILES` entries for PS 83 and Yuan Ning 43, plus matching PostgreSQL and D1 data states.

- [ ] **Step 1: Create the final Yuan Ning CSV**

Add `data/rosters/stp-yuan-ning.csv` with header `source_ref,name,grade`. Preserve each transferred `stp-ps-NNN` source reference, use the corrected display name, and add:

```csv
stp-yuan-ning-001,Macy,Y1
stp-yuan-ning-002,杨景立,Y1
stp-yuan-ning-003,Julian,Y1
stp-yuan-ning-004,Owen,Y5
stp-yuan-ning-005,陈梓煒,K1+K2
```

Remove the 38 transferred source-reference rows from `stp-ps.csv`; do not renumber the remaining PS rows.

- [ ] **Step 2: Register the roster source**

Update `APPROVED_COUNTS` and `ROSTER_FILES`:

```js
"PS STP": 83,
"YUAN NING STP": 43,
// ...
rosterFile("stp-yuan-ning.csv", "YUAN NING STP"),
```

- [ ] **Step 3: Add the PostgreSQL migration**

Create the group first, update the 38 `PS STP` rows by `source_ref`, and correct the six names with a `CASE source_ref` expression. Insert the five new rows with stable UUIDs `dc100001-...-0001` through `dc100005-...-0005`, source references `stp-yuan-ning-001` through `005`, empty profiles, and active status.

- [ ] **Step 4: Add the D1 migration and journal entry**

Add the same group, transfer, corrections, and inserts in `drizzle/0003_stp_yuan_ning.sql`, separating statements with `--> statement-breakpoint`. Append journal entry index 3, tag `0003_stp_yuan_ning`, version 6, with breakpoints enabled.

- [ ] **Step 5: Run the roster and migration tests**

Run:

```bash
node --test --test-name-pattern="migration|roster" tests/sites-worker.test.mjs
npm test -- tests/server/schema.test.js tests/server/import-rosters.test.js
```

Expected: focused data-state tests pass; catalog tests remain intentionally excluded until Task 3.

- [ ] **Step 6: Commit the roster and migrations**

```bash
git add data/rosters/stp-ps.csv data/rosters/stp-yuan-ning.csv scripts/import-rosters.mjs server/db/migrations/004_stp_yuan_ning.sql drizzle/0003_stp_yuan_ning.sql drizzle/meta/_journal.json
git commit -m "feat: migrate STP Yuan Ning roster"
```

---

### Task 3: Expose and authorize the Yuan Ning group

**Files:**
- Modify: `server/domain/catalog.js`
- Modify: `worker/index.js`

**Interfaces:**
- Consumes: group code `YUAN NING STP` created by Task 2.
- Produces: catalog responses and read/write validation that recognize Yuan Ning only under STP.

- [ ] **Step 1: Add the group to both fixed catalogs**

Add immediately after `SY STP`:

```js
{ code: "YUAN NING STP", branch: "STP", label: "YUAN NING" },
```

- [ ] **Step 2: Run focused contract tests**

Run:

```bash
npm run test:sites
npm test -- tests/server/catalog.test.js tests/client/branch-flow.test.jsx
```

Expected: all focused catalog and roster tests pass.

- [ ] **Step 3: Commit the runtime catalog**

```bash
git add server/domain/catalog.js worker/index.js
git commit -m "feat: expose STP Yuan Ning group"
```

---

### Task 4: Verify and publish the exact migrated state

**Files:**
- Verify only: all source, tests, `dist/`, and Sites packaging output.

**Interfaces:**
- Consumes: the complete source state from Tasks 1–3.
- Produces: a saved and deployed Sites version using the new migration.

- [ ] **Step 1: Run complete automated verification**

Run:

```bash
npm run test:sites
npm test -- --maxWorkers=1
npm run test:e2e
npm run build
git diff --check
```

Expected: 0 failed tests; build emits `dist/client/index.html`, `dist/server/index.js`, `dist/.openai/hosting.json`, and packaged migrations including `0003_stp_yuan_ning.sql`.

- [ ] **Step 2: Review the final diff and repository state**

Run:

```bash
git status --short --branch
git log -5 --oneline
```

Expected: only intended commits are present and the working tree is clean.

- [ ] **Step 3: Publish the existing Sites project**

Push the validated HEAD to the existing Sites source repository, package that exact commit, save one new site version, and deploy it using the existing public access approved by the user.

- [ ] **Step 4: Verify production**

Wait for deployment status `succeeded`. Confirm the live catalog shows `YUAN NING` under STP, its roster reports 43 active students, and PS reports 83.
