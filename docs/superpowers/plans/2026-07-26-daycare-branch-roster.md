# Daycare Branch Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy an optimized daycare check-in website whose first screen selects MK, STP, or WS, then shows only that branch's teachers and active students, with Enrol, stop-supplement, restore, profile, attendance, message, and dashboard workflows.

**Architecture:** Start from the Product Design `prototype` template so the selected blue-and-white mock remains the visual source of truth and the build stays Sites-ready. Add an Express API in the same repository and store operational data in PostgreSQL; the React client communicates only through authenticated JSON APIs that validate the branch/group relationship on every request. Render can run the client and API as one service, while the unchanged Sites worker remains available for a frontend-only handoff.

**Tech Stack:** Node.js 20, React 19, Vite 6, Express 5, PostgreSQL 16, `pg`, Zod, signed cookie sessions, Vitest, Testing Library, Supertest, `pg-mem`, TanStack Virtual, Playwright, Render.

## Global Constraints

- Do not unify, restructure, or write to Lark Base in this project.
- The first authenticated screen shows only `MK`, `STP`, and `WS`.
- The selected branch limits both the visible teacher groups and every server query.
- MK groups are `MK HAPPY`, `MK QIAO EN`, and `MK WEN XUAN`.
- WS groups are `WS HUILING`, `WS JIA WEN`, and `WS MIXIN`.
- STP groups remain `巧恩 STP`, `PS STP`, and `SY STP`.
- `MK QIAO EN` imports only the 40-student main roster; its 基础班 is excluded.
- `MK WEN XUAN` imports 18 students from the Wen Xuan worksheet in the WS workbook but belongs to MK.
- Enrol requires name, grade, teacher group, and the existing personal-profile fields.
- Stop-supplement requires name, grade, and teacher group; it hides the student without deleting profile or history.
- A restored student returns to the original teacher's active roster.
- The application must use a stable internal student UUID instead of name as its record key.
- The existing blue-and-white visual language and the approved vertical branch-button entrance are the visual source of truth.
- Desktop and mobile must render one responsive component tree, not duplicate full rosters.
- The existing point actions remain `接`, `到`, `冲`, `餐`, `功`, `补`, `复`, `回`, `缺席`, `KOKO`, and `清空`.
- Correct the visible label `接生` to `接送`.

## File Map

- `package.json`: application scripts and pinned dependencies.
- `vite.config.mjs`, `index.html`, `src/main.jsx`: Product Design prototype entry and build.
- `worker/index.js`, `scripts/prepare-sites-build.mjs`, `tests/sites-worker.test.mjs`: preserved Sites-ready packaging.
- `server/app.js`, `server/index.js`: Express composition and process entry.
- `server/config.js`: validated environment configuration.
- `server/auth/session.js`, `server/routes/session.js`: Google/emergency login and signed session cookie.
- `server/db/pool.js`, `server/db/migrate.js`, `server/db/migrations/001_initial.sql`: PostgreSQL connection and schema.
- `server/domain/catalog.js`, `server/domain/profile.js`, `server/domain/attendance.js`: branch/group, profile, and event constants.
- `server/repositories/students.js`, `server/repositories/attendance.js`, `server/repositories/messages.js`: database operations.
- `server/routes/catalog.js`, `server/routes/students.js`, `server/routes/attendance.js`, `server/routes/messages.js`: authenticated API endpoints.
- `src/api/client.js`: typed-by-contract fetch wrapper and error normalization.
- `src/domain/catalog.js`, `src/domain/profile.js`, `src/domain/attendance.js`: client display constants matching server contracts.
- `src/App.jsx`, `src/state/flowReducer.js`: single responsive application flow.
- `src/features/auth/LoginScreen.jsx`: Google and emergency login.
- `src/features/branches/BranchGateway.jsx`: approved MK/STP/WS entrance.
- `src/features/groups/GroupChooser.jsx`: branch-scoped teacher choice.
- `src/features/roster/RosterScreen.jsx`, `StudentVirtualList.jsx`, `StudentCard.jsx`: filtered, virtualized check-in list.
- `src/features/students/EnrolDialog.jsx`, `StopDialog.jsx`, `RestoreDialog.jsx`, `ProfilePanel.jsx`: student lifecycle and profile workflows.
- `src/features/messages/MessageDialog.jsx`, `src/features/dashboard/SummaryBar.jsx`: one-at-a-time messages and current-group statistics.
- `src/styles/tokens.css`, `src/styles/app.css`: measured blue-and-white responsive styles.
- `scripts/import-rosters.mjs`, `data/rosters/*.csv`: idempotent initial roster import.
- `tests/server/*.test.js`, `tests/client/*.test.jsx`, `tests/e2e/daycare.spec.js`: API, component, and browser coverage.
- `render.yaml`, `.env.example`: production service and required configuration.

---

### Task 1: Bootstrap the Sites-ready React and Express application

**Files:**
- Create from Product Design template: `package.json`, `package-lock.json`, `vite.config.mjs`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/styles.css`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, `tests/sites-worker.test.mjs`, `.openai/hosting.json`
- Create: `server/app.js`
- Create: `server/index.js`
- Create: `server/config.js`
- Create: `tests/server/health.test.js`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `createApp({ pool, config }) -> Express`, `loadConfig(env) -> AppConfig`
- Produces HTTP: `GET /api/health -> { ok: true }`

- [ ] **Step 1: Copy the Product Design `prototype` template into the repository**

Use the plugin's template copy/initialization procedure during execution. Keep `worker/index.js`, `scripts/prepare-sites-build.mjs`, `.openai/hosting.json`, and `tests/sites-worker.test.mjs` unchanged. Add `.superpowers/`, `node_modules/`, `dist/`, `.env`, and `coverage/` to `.gitignore`.

- [ ] **Step 2: Add full-stack and test dependencies**

Set these scripts and dependencies in `package.json`:

```json
{
  "scripts": {
    "dev": "concurrently \"vite\" \"node --watch server/index.js\"",
    "build": "vite build && node scripts/prepare-sites-build.mjs",
    "start": "node server/index.js",
    "db:migrate": "node server/db/migrate.js",
    "import:rosters": "node scripts/import-rosters.mjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:sites": "node --test tests/sites-worker.test.mjs"
  },
  "dependencies": {
    "@tanstack/react-virtual": "3.13.12",
    "cookie-session": "2.1.1",
    "express": "5.1.0",
    "google-auth-library": "10.3.0",
    "pg": "8.16.3",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "zod": "4.1.12"
  },
  "devDependencies": {
    "@playwright/test": "1.56.1",
    "@testing-library/jest-dom": "6.9.1",
    "@testing-library/react": "16.3.0",
    "@vitejs/plugin-react": "5.0.4",
    "concurrently": "9.2.1",
    "jsdom": "27.0.1",
    "pg-mem": "3.0.5",
    "supertest": "7.1.4",
    "vite": "6.4.2",
    "vitest": "3.2.4"
  }
}
```

- [ ] **Step 3: Write the failing health/configuration test**

```js
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../server/app.js";

describe("GET /api/health", () => {
  it("returns a healthy JSON response", async () => {
    const response = await request(createApp({ pool: null, config: { sessionSecret: "test" } }))
      .get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 4: Run the test and verify the expected failure**

Run: `npm test -- tests/server/health.test.js`  
Expected: FAIL because `server/app.js` does not export `createApp`.

- [ ] **Step 5: Implement the minimal Express shell**

```js
import express from "express";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.get("/api/health", (_request, response) => response.json({ ok: true }));
  return app;
}
```

`server/index.js` must listen on `config.port`, and in production serve `dist/client` with an SPA fallback only for non-API `GET` requests.

- [ ] **Step 6: Run the unit, build, and Sites packaging checks**

Run: `npm test -- tests/server/health.test.js`  
Expected: PASS.

Run: `npm run build`  
Expected: `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json` exist.

Run: `npm run test:sites`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add .gitignore package.json package-lock.json vite.config.mjs index.html src server worker scripts tests .openai
git commit -m "chore: bootstrap daycare full-stack app"
```

---

### Task 2: Create the PostgreSQL model and fixed branch catalog

**Files:**
- Create: `server/db/migrations/001_initial.sql`
- Create: `server/db/pool.js`
- Create: `server/db/migrate.js`
- Create: `server/domain/catalog.js`
- Create: `server/domain/profile.js`
- Create: `server/domain/attendance.js`
- Create: `tests/server/schema.test.js`
- Create: `tests/helpers/testDatabase.js`

**Interfaces:**
- Produces: `BRANCHES`, `GROUPS`, `PROFILE_FIELDS`, `ATTENDANCE_EVENTS`
- Produces: `createPool(connectionString) -> pg.Pool`
- Database tables: `branches`, `teacher_groups`, `students`, `attendance_events`, `student_messages`, `student_activity`

- [ ] **Step 1: Define exact shared domain constants**

```js
export const GROUPS = [
  { code: "MK HAPPY", branch: "MK", label: "HAPPY" },
  { code: "MK QIAO EN", branch: "MK", label: "QIAO EN" },
  { code: "MK WEN XUAN", branch: "MK", label: "WEN XUAN" },
  { code: "巧恩 STP", branch: "STP", label: "巧恩" },
  { code: "PS STP", branch: "STP", label: "PS" },
  { code: "SY STP", branch: "STP", label: "SY" },
  { code: "WS HUILING", branch: "WS", label: "HUILING" },
  { code: "WS JIA WEN", branch: "WS", label: "JIA WEN" },
  { code: "WS MIXIN", branch: "WS", label: "MIXIN" }
];

export const PROFILE_FIELDS = [
  "school",
  "schoolClass",
  "usualPickupTime",
  "pickupMethod",
  "lateStayMonday",
  "lateStayTuesday",
  "lateStayWednesday",
  "lateStayThursday",
  "lateStayFriday"
];

export const ATTENDANCE_EVENTS = [
  "pickup", "arrive", "shower", "meal", "homework",
  "supplement", "review", "home", "absent", "koko"
];
```

- [ ] **Step 2: Write failing schema tests**

```js
it("seeds exactly three branches and nine teacher groups", async () => {
  const branches = await pool.query("select code from branches order by code");
  const groups = await pool.query("select code, branch_code from teacher_groups order by code");
  expect(branches.rows.map((row) => row.code)).toEqual(["MK", "STP", "WS"]);
  expect(groups.rows).toHaveLength(9);
});

it("prevents a student group from pointing at another branch", async () => {
  await expect(pool.query(
    `insert into students (id, name, grade, branch_code, group_code)
     values ('00000000-0000-4000-8000-000000000001', 'Test', 'Y2', 'WS', 'MK HAPPY')`
  )).rejects.toThrow();
});
```

- [ ] **Step 3: Run the schema tests and verify failure**

Run: `npm test -- tests/server/schema.test.js`  
Expected: FAIL because the migration and test database helper do not exist.

- [ ] **Step 4: Implement the schema**

`001_initial.sql` must create:

```sql
create extension if not exists pgcrypto;

create table branches (
  code text primary key check (code in ('MK', 'STP', 'WS')),
  label text not null
);

create table teacher_groups (
  code text primary key,
  branch_code text not null references branches(code),
  label text not null,
  unique (code, branch_code)
);

create table students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade text not null,
  branch_code text not null,
  group_code text not null,
  status text not null default 'active' check (status in ('active', 'stopped')),
  profile jsonb not null default '{}'::jsonb,
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (group_code, branch_code) references teacher_groups(code, branch_code),
  unique (group_code, source_ref)
);

create table attendance_events (
  student_id uuid not null references students(id),
  attendance_date date not null,
  event_code text not null,
  is_active boolean not null,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  primary key (student_id, attendance_date, event_code)
);

create table student_messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  message_date date not null,
  body text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table student_activity (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  action text not null check (action in ('enrol', 'stop', 'restore', 'profile_update')),
  actor text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

Seed all three branches and nine groups in the same migration. Add indexes on `(branch_code, group_code, status, name)`, attendance date, and message student/date.

- [ ] **Step 5: Run tests and migration twice**

Run: `npm test -- tests/server/schema.test.js`  
Expected: PASS.

Run: `npm run db:migrate` twice against the development database.  
Expected: both runs exit 0; the second reports no pending migration.

- [ ] **Step 6: Commit**

```bash
git add server/db server/domain tests/server/schema.test.js tests/helpers/testDatabase.js
git commit -m "feat: add branch-safe student data model"
```

---

### Task 3: Import and validate the MK, WS, and STP rosters

**Files:**
- Create: `data/rosters/mk-happy.csv`
- Create: `data/rosters/mk-qiao-en.csv`
- Create: `data/rosters/mk-wen-xuan.csv`
- Create: `data/rosters/ws-huiling.csv`
- Create: `data/rosters/ws-jia-wen.csv`
- Create: `data/rosters/ws-mixin.csv`
- Create: `data/rosters/stp-qiao-en.csv`
- Create: `data/rosters/stp-ps.csv`
- Create: `data/rosters/stp-sy.csv`
- Create: `scripts/import-rosters.mjs`
- Create: `tests/server/import-rosters.test.js`

**Interfaces:**
- Consumes: `students`, `teacher_groups`
- Produces: `parseRosterCsv(text, groupCode) -> StudentSeed[]`
- Produces: `importRosters(pool, rosterFiles) -> { inserted, updated, counts }`

- [ ] **Step 1: Export the approved roster sources**

Use the previously reviewed Google Sheets as read-only sources:

- WS workbook tabs: Hui Ling, Jia Wen, Mixin, Wen Xuan.
- MK workbook tabs: Happy and only rows belonging to Qiao En's main roster.
- Exclude Qiao En 基础班 beginning at its 基础班 section.
- Assign Wen Xuan to `MK WEN XUAN`, even though its source tab is in the WS workbook.
- Export the current online STP `巧恩 STP`, `PS STP`, and `SY STP` rosters without changing live records.

Each CSV has the exact header:

```csv
source_ref,name,grade
```

Normalize whitespace only; do not translate or respell names.

- [ ] **Step 2: Write failing import validation tests**

```js
expect(result.counts).toMatchObject({
  "MK HAPPY": 82,
  "MK QIAO EN": 40,
  "MK WEN XUAN": 18,
  "WS HUILING": 46,
  "WS JIA WEN": 61,
  "WS MIXIN": 42,
  "巧恩 STP": 90,
  "PS STP": 121,
  "SY STP": 50
});

expect(result.rows.filter((row) => row.groupCode === "MK QIAO EN"))
  .not.toContainEqual(expect.objectContaining({ sourceRef: expect.stringContaining("basic") }));
```

- [ ] **Step 3: Run the import test and verify failure**

Run: `npm test -- tests/server/import-rosters.test.js`  
Expected: FAIL because the importer is missing.

- [ ] **Step 4: Implement idempotent roster import**

```js
await client.query(
  `insert into students (name, grade, branch_code, group_code, source_ref)
   values ($1, $2, $3, $4, $5)
   on conflict (group_code, source_ref)
   do update set name = excluded.name, grade = excluded.grade, updated_at = now()`,
  [student.name, student.grade, branchCode, groupCode, student.sourceRef]
);
```

Wrap each roster file in a transaction. Reject the whole file when its count differs from the approved count, any required cell is blank, the group is unknown, or a duplicate `source_ref` exists in the same file.

- [ ] **Step 5: Run validation and a second idempotency pass**

Run: `npm test -- tests/server/import-rosters.test.js`  
Expected: PASS.

Run: `npm run import:rosters` twice.  
Expected: both runs report the same nine group counts and the second creates no duplicate students.

- [ ] **Step 6: Commit**

```bash
git add data/rosters scripts/import-rosters.mjs tests/server/import-rosters.test.js
git commit -m "data: import approved branch rosters"
```

---

### Task 4: Add authentication, catalog, and branch isolation

**Files:**
- Create: `server/auth/session.js`
- Create: `server/routes/session.js`
- Create: `server/routes/catalog.js`
- Create: `tests/server/session.test.js`
- Create: `tests/server/catalog.test.js`
- Modify: `server/app.js`
- Modify: `server/config.js`
- Create: `.env.example`

**Interfaces:**
- Produces HTTP: `POST /api/session/google`, `POST /api/session/emergency`, `GET /api/session`, `DELETE /api/session`
- Produces HTTP: `GET /api/catalog -> { branches: [{ code, label, groups }] }`
- Produces middleware: `requireSession(request, response, next)`

- [ ] **Step 1: Write failing authentication and catalog tests**

```js
it("rejects catalog access without a session", async () => {
  const response = await request(app).get("/api/catalog");
  expect(response.status).toBe(401);
});

it("returns only the fixed three-branch catalog after login", async () => {
  const agent = request.agent(app);
  await agent.post("/api/session/emergency").send({ password: "test-access" }).expect(204);
  const response = await agent.get("/api/catalog").expect(200);
  expect(response.body.branches.map((branch) => branch.code)).toEqual(["MK", "STP", "WS"]);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/server/session.test.js tests/server/catalog.test.js`  
Expected: FAIL because routes and middleware do not exist.

- [ ] **Step 3: Implement signed sessions**

Use an HTTP-only, `SameSite=Lax`, secure-in-production signed cookie. Verify Google ID tokens with `GOOGLE_CLIENT_ID`; allow only emails in `ALLOWED_EMAILS`. Verify the emergency password against `EMERGENCY_PASSWORD_HASH` using Node's `crypto.scrypt`. Never store or log the submitted password.

`.env.example` must declare:

```dotenv
DATABASE_URL=postgres://user:password@host:5432/daycare
SESSION_SECRET=replace-with-32-random-bytes
GOOGLE_CLIENT_ID=google-client-id.apps.googleusercontent.com
ALLOWED_EMAILS=teacher@example.com
EMERGENCY_PASSWORD_HASH=scrypt-salt-and-hash
PORT=3000
```

- [ ] **Step 4: Implement the server-owned catalog**

Return groups from `server/domain/catalog.js`, grouped by branch. Do not accept branch/group definitions from the client.

- [ ] **Step 5: Run authentication and catalog tests**

Run: `npm test -- tests/server/session.test.js tests/server/catalog.test.js`  
Expected: PASS, including wrong-password, disallowed-email, secure-cookie, and logout cases.

- [ ] **Step 6: Commit**

```bash
git add server/auth server/routes server/app.js server/config.js tests/server/session.test.js tests/server/catalog.test.js .env.example
git commit -m "feat: secure sessions and branch catalog"
```

---

### Task 5: Implement roster, Enrol, stop, restore, and profile APIs

**Files:**
- Create: `server/repositories/students.js`
- Create: `server/routes/students.js`
- Create: `tests/server/students.test.js`
- Modify: `server/app.js`

**Interfaces:**
- Produces HTTP: `GET /api/students?branch&group&status&search&cursor&limit`
- Produces HTTP: `POST /api/students`
- Produces HTTP: `POST /api/students/:id/stop`
- Produces HTTP: `POST /api/students/:id/restore`
- Produces HTTP: `PATCH /api/students/:id/profile`
- Student response: `{ id, name, grade, branchCode, groupCode, status, profile, updatedAt }`
- Every student write consumes headers: `X-Branch-Code`, `X-Group-Code`

- [ ] **Step 1: Write failing server-side isolation and lifecycle tests**

```js
it("never returns another branch through a mismatched group query", async () => {
  const response = await agent
    .get("/api/students?branch=WS&group=MK%20HAPPY&status=active")
    .expect(400);
  expect(response.body.code).toBe("GROUP_BRANCH_MISMATCH");
});

it("stops without deleting profile or attendance", async () => {
  await agent.post(`/api/students/${student.id}/stop`)
    .send({ name: student.name, grade: student.grade, groupCode: student.groupCode })
    .expect(200);
  const row = await pool.query("select status, profile from students where id = $1", [student.id]);
  expect(row.rows[0]).toMatchObject({ status: "stopped", profile: student.profile });
  expect(await attendanceCount(student.id)).toBe(1);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/server/students.test.js`  
Expected: FAIL because the repository and routes do not exist.

- [ ] **Step 3: Implement validated list and search**

Use Zod to validate `branch`, `group`, `status`, `search`, `cursor`, and `limit`. Clamp `limit` to 50. Validate the group belongs to the branch before querying. Order by normalized name then UUID and return:

```json
{
  "items": [],
  "nextCursor": null,
  "total": 0
}
```

The default status is `active`. Search uses a case-insensitive prefix/contains query inside the selected branch/group only.

- [ ] **Step 4: Implement transactional Enrol**

Accept:

```json
{
  "name": "Student Name",
  "grade": "Y3",
  "branchCode": "MK",
  "groupCode": "MK HAPPY",
  "profile": {
    "school": "",
    "schoolClass": "",
    "usualPickupTime": "",
    "pickupMethod": "",
    "lateStayMonday": "",
    "lateStayTuesday": "",
    "lateStayWednesday": "",
    "lateStayThursday": "",
    "lateStayFriday": ""
  }
}
```

In one transaction insert the active student and an `enrol` activity row. Return `201` with the new student. Reject missing name/grade/group and cross-branch groups.

- [ ] **Step 5: Implement identity-safe stop and restore**

Stop accepts `{ name, grade, groupCode }` and requires all three values to match the target UUID before changing status. Restore changes only `stopped -> active`. Both operations update `student_activity`; neither deletes attendance, messages, or profile.

- [ ] **Step 6: Implement profile updates and the no-selection rule**

Allow only keys from `PROFILE_FIELDS`. Require an explicit student UUID; a search string is never accepted as a profile target. Return `404` when the selected student no longer exists and `409` when the record changed since the supplied `updatedAt`.

- [ ] **Step 7: Run all student API tests**

Run: `npm test -- tests/server/students.test.js`  
Expected: PASS for pagination, branch isolation, enrol validation, duplicate submission protection, stop identity confirmation, restore, profile history, and optimistic conflict cases.

- [ ] **Step 8: Commit**

```bash
git add server/repositories/students.js server/routes/students.js server/app.js tests/server/students.test.js
git commit -m "feat: manage student enrolment and stop status"
```

---

### Task 6: Implement attendance, messages, and current-group summary APIs

**Files:**
- Create: `server/repositories/attendance.js`
- Create: `server/repositories/messages.js`
- Create: `server/routes/attendance.js`
- Create: `server/routes/messages.js`
- Create: `tests/server/attendance.test.js`
- Create: `tests/server/messages.test.js`
- Modify: `server/app.js`

**Interfaces:**
- Produces HTTP: `GET /api/attendance?branch&group&date`
- Produces HTTP: `PUT /api/students/:id/attendance/:date/:eventCode`
- Produces HTTP: `DELETE /api/students/:id/attendance/:date`
- Produces HTTP: `GET /api/summary?branch&group&date`
- Produces HTTP: `GET /api/students/:id/messages`, `POST /api/students/:id/messages`
- Every student-specific attendance/message write consumes headers: `X-Branch-Code`, `X-Group-Code`

- [ ] **Step 1: Write failing attendance and message tests**

```js
it("upserts one event without duplicating it", async () => {
  await agent.put(`/api/students/${student.id}/attendance/2026-07-27/arrive`)
    .send({ active: true }).expect(200);
  await agent.put(`/api/students/${student.id}/attendance/2026-07-27/arrive`)
    .send({ active: true }).expect(200);
  expect(await eventCount(student.id, "2026-07-27", "arrive")).toBe(1);
});

it("rejects attendance when the student is outside the selected group", async () => {
  await agent.put(`/api/students/${mkStudent.id}/attendance/2026-07-27/arrive`)
    .set("X-Branch-Code", "WS")
    .set("X-Group-Code", "WS HUILING")
    .send({ active: true }).expect(403);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/server/attendance.test.js tests/server/messages.test.js`  
Expected: FAIL because routes are missing.

- [ ] **Step 3: Implement attendance upsert and clear**

Validate date as `YYYY-MM-DD` and event code against `ATTENDANCE_EVENTS`. Upsert the unique `(student_id, attendance_date, event_code)` row. Use the session email as `updated_by`. `DELETE` clears all event rows only for the selected student/date.

- [ ] **Step 4: Implement group summary**

Return:

```json
{
  "expected": 46,
  "arrived": 20,
  "notArrived": 24,
  "absent": 2,
  "koko": 3,
  "unmarked": 21
}
```

Calculate only active students in the selected branch/group. Define `arrived` from active `arrive`, `absent` from active `absent`, and `koko` from active `koko`. Do not double-count the same student in one metric.

- [ ] **Step 5: Implement one-at-a-time messages**

List messages for one student newest first. Create one message only when `body.trim()` is non-empty and at most 2,000 characters. Do not generate a message input for every roster row.

- [ ] **Step 6: Run API tests**

Run: `npm test -- tests/server/attendance.test.js tests/server/messages.test.js`  
Expected: PASS for event idempotency, group isolation, clear, summary counts, empty message rejection, and message ordering.

- [ ] **Step 7: Commit**

```bash
git add server/repositories/attendance.js server/repositories/messages.js server/routes server/app.js tests/server/attendance.test.js tests/server/messages.test.js
git commit -m "feat: add attendance and message APIs"
```

---

### Task 7: Build the branch and teacher entrance

**Files:**
- Create: `src/api/client.js`
- Create: `src/state/flowReducer.js`
- Create: `src/features/auth/LoginScreen.jsx`
- Create: `src/features/branches/BranchGateway.jsx`
- Create: `src/features/groups/GroupChooser.jsx`
- Create: `src/features/layout/AppShell.jsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/app.css`
- Create: `tests/client/branch-flow.test.jsx`
- Modify: `src/App.jsx`
- Modify: `src/main.jsx`

**Interfaces:**
- Consumes HTTP: `POST /api/session/google`, `POST /api/session/emergency`, `GET /api/session`, `DELETE /api/session`, `GET /api/catalog`
- Produces state: `{ screen: "login" | "branch" | "group" | "roster", branchCode, groupCode }`
- Produces actions: `LOGIN`, `SELECT_BRANCH`, `SELECT_GROUP`, `BACK_TO_GROUPS`, `BACK_TO_BRANCHES`, `LOGOUT`

- [ ] **Step 1: Write the failing branch-flow component test**

```jsx
it("shows branches first and never mixes teacher groups", async () => {
  render(<App />);
  expect(await screen.findByRole("heading", { name: "请选择分院" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "MK" }));
  expect(screen.getByRole("button", { name: "HAPPY" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "HUILING" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "HAPPY" }));
  expect(await screen.findByText("MK HAPPY")).toBeVisible();
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test -- tests/client/branch-flow.test.jsx`  
Expected: FAIL because branch and group components do not exist.

- [ ] **Step 3: Implement the reducer and API client**

The client throws normalized `{ status, code, message }` errors. The reducer clears `groupCode` whenever branch changes and clears both codes on `BACK_TO_BRANCHES`.

- [ ] **Step 4: Implement login**

Show the existing Google login and emergency-login choices. Send the Google Identity Services credential to `/api/session/google`. The emergency form posts only the password to `/api/session/emergency`, disables submit while pending, shows a generic failure message, and clears the password after failure. A successful session dispatches `LOGIN` and opens the branch entrance.

- [ ] **Step 5: Implement the approved entrance**

Match option 1 exactly:

- white/light-blue background;
- title `请选择分院`;
- subtitle `进入后只显示该分院名单`;
- three large vertically stacked buttons in this order: `MK`, `STP`, `WS`;
- existing system's navy/blue button treatment, radius, spacing, and typography;
- no student, dashboard, or management content on this screen.

- [ ] **Step 6: Implement branch-scoped teacher selection**

Render only `catalog.branches.find(branch.code === branchCode).groups`. Keep visible back controls for branch and teacher levels. Set the selected branch and group in memory and include both on every later API request.

- [ ] **Step 7: Run component tests at desktop and mobile widths**

Run: `npm test -- tests/client/branch-flow.test.jsx`  
Expected: PASS at 1440×900 and 390×844 test containers, with no cross-branch teacher names.

- [ ] **Step 8: Commit**

```bash
git add src tests/client/branch-flow.test.jsx
git commit -m "feat: add branch-first teacher selection"
```

---

### Task 8: Build the virtualized roster, attendance, profile, messages, and summary

**Files:**
- Create: `src/domain/attendance.js`
- Create: `src/domain/profile.js`
- Create: `src/features/roster/RosterScreen.jsx`
- Create: `src/features/roster/StudentVirtualList.jsx`
- Create: `src/features/roster/StudentCard.jsx`
- Create: `src/features/students/ProfilePanel.jsx`
- Create: `src/features/messages/MessageDialog.jsx`
- Create: `src/features/dashboard/SummaryBar.jsx`
- Create: `tests/client/roster.test.jsx`
- Create: `tests/client/profile-search.test.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes HTTP: roster, attendance, profile, message, and summary endpoints from Tasks 5-6
- Produces UI actions: select event, clear day, search current group, edit selected profile, open one message dialog

- [ ] **Step 1: Write failing performance and stale-profile regression tests**

```jsx
it("does not render every card in a 121-student group", async () => {
  render(<RosterScreen branchCode="STP" groupCode="PS STP" />);
  await screen.findByText("Student 001");
  expect(screen.getAllByTestId("student-card").length).toBeLessThan(30);
});

it("clears the selected profile when search has no result", async () => {
  await user.click(await screen.findByText("HAYDEN CHIN"));
  expect(screen.getByRole("button", { name: "保存学生资料" })).toBeEnabled();
  await user.type(screen.getByRole("searchbox"), "ZZZ_NO_MATCH");
  expect(await screen.findByText("找不到学生")).toBeVisible();
  expect(screen.queryByRole("button", { name: "保存学生资料" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npm test -- tests/client/roster.test.jsx tests/client/profile-search.test.jsx`  
Expected: FAIL because the roster and profile components do not exist.

- [ ] **Step 3: Implement a single responsive virtual list**

Use `useVirtualizer` with one card component for all viewports. Fetch 50 rows at a time and load the next cursor when the virtual list reaches its final five items. Never mount separate desktop and mobile roster trees. Show a loading indicator during the first request; if it fails, replace the list with the exact error text and a `重新加载` button that repeats only the current branch/group request.

- [ ] **Step 4: Implement point controls and save states**

Map:

```js
export const EVENT_BUTTONS = [
  ["pickup", "接"], ["arrive", "到"], ["shower", "冲"], ["meal", "餐"],
  ["homework", "功"], ["supplement", "补"], ["review", "复"], ["home", "回"],
  ["absent", "缺席"], ["koko", "KOKO"]
];
```

Optimistically highlight a button, disable that student's controls while saving, then show `已保存`. On failure, restore the previous state and show a retry action. Label pickup information as `接送`.

- [ ] **Step 5: Implement current-group search and profile safety**

Debounce search by 250 ms. When results are empty, set `selectedStudentId` to `null`, clear all form values, show `找不到学生`, and remove the save button. Profile fields are school, school class, usual pickup time, pickup method, and Monday-Friday late-stay times.

- [ ] **Step 6: Implement summary and one message dialog**

Refresh the summary after attendance saves. Open one message editor only after selecting a student. No hidden textarea or save button may be rendered for every roster row.

- [ ] **Step 7: Run component tests**

Run: `npm test -- tests/client/roster.test.jsx tests/client/profile-search.test.jsx`  
Expected: PASS for virtualization, event save/failure, summary refresh, no-result profile clearing, and one-message-editor behavior.

- [ ] **Step 8: Commit**

```bash
git add src tests/client/roster.test.jsx tests/client/profile-search.test.jsx
git commit -m "feat: add fast branch-scoped check-in roster"
```

---

### Task 9: Build Enrol, stop-supplement, and restore interfaces

**Files:**
- Create: `src/features/students/EnrolDialog.jsx`
- Create: `src/features/students/StopDialog.jsx`
- Create: `src/features/students/RestoreDialog.jsx`
- Create: `tests/client/student-lifecycle.test.jsx`
- Modify: `src/features/roster/RosterScreen.jsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes HTTP: `POST /api/students`, `POST /api/students/:id/stop`, `POST /api/students/:id/restore`
- Produces UI buttons: `Enrol 学生`, `停补学生`, `恢复学生`

- [ ] **Step 1: Write failing lifecycle UI tests**

```jsx
it("enrols into the selected branch and refreshes only that group", async () => {
  await user.click(screen.getByRole("button", { name: "Enrol 学生" }));
  await user.type(screen.getByLabelText("学生姓名"), "NEW STUDENT");
  await user.selectOptions(screen.getByLabelText("年级"), "Y3");
  expect(screen.getByLabelText("老师班级")).toHaveValue("WS HUILING");
  await user.click(screen.getByRole("button", { name: "保存学生" }));
  expect(await screen.findByText("NEW STUDENT")).toBeVisible();
  expect(fetchCalls).not.toContainEqual(expect.stringContaining("branch=MK"));
});

it("requires confirmation before hiding a stopped student", async () => {
  await user.click(screen.getByRole("button", { name: "停补学生" }));
  await chooseStudent("CURRENT STUDENT", "Y4", "WS HUILING");
  expect(screen.getByText("CURRENT STUDENT · Y4 · WS HUILING")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "确认停补" }));
  expect(screen.queryByText("CURRENT STUDENT")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npm test -- tests/client/student-lifecycle.test.jsx`  
Expected: FAIL because lifecycle dialogs do not exist.

- [ ] **Step 3: Implement Enrol**

Require name, grade, and group. Limit group choices to the selected branch and default to the current group. Include the exact profile fields from Task 8. Disable submit while saving and prevent double-click duplicates. On success close the dialog, show `学生已加入`, and refresh only the current group.

- [ ] **Step 4: Implement stop-supplement**

Require student name, grade, and teacher group. Resolve to a UUID and show the exact `姓名 · 年级 · 老师班级` confirmation before submitting. If multiple records match, render the candidate list and require an explicit selection. On success show `学生已停补` and remove the active card.

- [ ] **Step 5: Implement restore**

List only stopped students for the current branch/group. Require explicit selection and confirmation. On success show `学生已恢复` and refresh the active roster.

- [ ] **Step 6: Run lifecycle tests**

Run: `npm test -- tests/client/student-lifecycle.test.jsx`  
Expected: PASS for required fields, branch-limited groups, duplicate-submit prevention, ambiguous-name selection, hide-with-history behavior, and restore.

- [ ] **Step 7: Commit**

```bash
git add src/features/students src/features/roster/RosterScreen.jsx src/styles/app.css tests/client/student-lifecycle.test.jsx
git commit -m "feat: add enrol stop and restore workflows"
```

---

### Task 10: Verify the complete workflow and deploy the optimized website

**Files:**
- Create: `tests/e2e/daycare.spec.js`
- Create: `playwright.config.js`
- Create: `render.yaml`
- Create: `docs/operations.md`
- Modify: `.env.example`
- Modify: `package.json`

**Interfaces:**
- Consumes: all client/API/database interfaces
- Produces: a production Render health check and website URL

- [ ] **Step 1: Write end-to-end acceptance tests**

```js
test("MK branch never exposes WS or STP students", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "MK" }).click();
  await page.getByRole("button", { name: "HAPPY" }).click();
  await expect(page.getByText("MK HAPPY")).toBeVisible();
  await expect(page.getByText("WS HUILING")).toHaveCount(0);
  await expect(page.getByText("PS STP")).toHaveCount(0);
});

test("enrol stop and restore preserve the same student id", async ({ page }) => {
  const id = await enrolStudent(page, "E2E STUDENT", "Y3", "MK WEN XUAN");
  await stopStudent(page, "E2E STUDENT", "Y3", "MK WEN XUAN");
  await restoreStudent(page, "E2E STUDENT", "MK WEN XUAN");
  expect(await selectedStudentId(page, "E2E STUDENT")).toBe(id);
});
```

Add cases for Qiao En 基础班 absence, mobile first-screen usability, event retry, empty search clearing, logout, and API branch mismatch.

- [ ] **Step 2: Run full verification locally**

Run: `npm test`  
Expected: all server and client tests PASS.

Run: `npm run build`  
Expected: build exits 0 with no missing assets.

Run: `npm run test:sites`  
Expected: PASS.

Run: `npm run test:e2e`  
Expected: all desktop Chromium 1440×900 and mobile Chromium 390×844 tests PASS.

- [ ] **Step 3: Perform visual comparison against the selected mock and audit screenshots**

Open the local preview in the user's selected in-app browser. Capture the branch entrance, one teacher chooser, a 121-student group, Enrol, stop, profile no-result, and mobile roster screens. Compare reference and implementation at the same viewport, correct visible spacing/type/color/layout mismatches, then rerun Playwright.

- [ ] **Step 4: Add Render configuration**

`render.yaml` must define one Node web service:

```yaml
services:
  - type: web
    name: daycare-checkin-optimized
    runtime: node
    plan: starter
    buildCommand: npm ci && npm run build && npm run db:migrate
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_VERSION
        value: 20.18.0
      - key: DATABASE_URL
        fromDatabase:
          name: daycare-checkin-db
          property: connectionString
      - key: SESSION_SECRET
        generateValue: true

databases:
  - name: daycare-checkin-db
    plan: basic-256mb
    databaseName: daycare
```

Add Google/emergency authentication secrets in Render's environment settings, never in Git.

- [ ] **Step 5: Document backup, import, and rollback**

`docs/operations.md` must include:

- pre-deploy PostgreSQL backup command;
- migration command and expected migration name;
- idempotent roster import command and the nine approved counts;
- health, login, branch, Enrol, stop, restore, and attendance smoke checks;
- rollback to the previous Render deployment;
- restore-from-backup procedure;
- exact environment variable names without secret values.

- [ ] **Step 6: Deploy with explicit access handling**

If the existing Render service/repository access is supplied, create a backup and deploy this build to that service. If it is not supplied, create a new Render service from this repository and return the new optimized URL; do not claim the original URL was replaced. After deployment, run the Playwright smoke subset against the production URL and check `/api/health`.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e playwright.config.js render.yaml docs/operations.md .env.example package.json package-lock.json
git commit -m "test: verify and prepare daycare deployment"
```

---

### Task 11: Add a persistent Sites runtime and publish the working system

**Files:**
- Modify: `.openai/hosting.json`
- Modify: `worker/index.js`
- Modify: `scripts/prepare-sites-build.mjs`
- Modify: `tests/sites-worker.test.mjs`
- Create: `db/schema.ts`
- Create: `drizzle/0000_daycare_sites.sql`
- Create: `drizzle/meta/_journal.json`
- Create as needed: focused worker test helpers

**Interfaces:**
- Consumes: the existing React API contract and the existing nine roster CSVs
- Produces: Cloudflare Worker-compatible `/api/*` routes backed by the Sites `DB` D1 binding
- Produces: a privately deployed, durable Sites production URL

- [ ] **Step 1: Write failing Sites runtime tests**

Exercise the real worker against a SQLite-backed D1-compatible test adapter. Cover session/catalog, exact active roster counts, branch/group validation, pagination/search, attendance/summary, profile optimistic concurrency, messages, Enrol duplicate protection, stop, and restore preservation. Confirm the current static-only worker fails these tests for missing API routes.

- [ ] **Step 2: Implement the D1 schema and roster migration**

Set `.openai/hosting.json` `d1` to `DB` and keep `r2` null. Add SQLite-compatible tables, foreign keys, indexes, and idempotent inserts for the three branches, nine teacher groups, and exactly 550 approved students from `data/rosters/*.csv`. Use stable UUID-format IDs and JSON text for profiles.

- [ ] **Step 3: Implement the Worker API contract**

Keep static asset serving and SPA fallback intact. Route `/api/*` before assets and reproduce the existing client contract with prepared D1 statements. Sites owner-only access is the authentication boundary, so `/api/session` returns the private-site operator identity and login/logout endpoints remain compatible no-ops. Validate every branch/group relationship and write context. Preserve student IDs, profile, attendance, and messages across stop/restore.

- [ ] **Step 4: Verify and package**

Run focused worker tests red then green, `npm test`, `npm run build`, `npm run test:sites`, and local Playwright. The build must copy D1 migration metadata into the Sites archive and retain the exact visually verified client.

- [ ] **Step 5: Save and deploy privately**

Create the Sites project once, persist its opaque `project_id`, push the exact validated source commit, package that commit, save one version, deploy it owner-only, poll to success, open the deployed URL, and run production read-only smoke checks.

- [ ] **Step 6: Commit**

```bash
git add .openai worker scripts tests db drizzle
git commit -m "feat: add persistent Sites runtime"
```

## Final Verification Checklist

- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] `npm run test:sites` passes.
- [ ] `npm run test:e2e` passes at desktop and mobile sizes.
- [ ] Production `/api/health` returns `{ "ok": true }`.
- [ ] Production first screen contains only MK, STP, and WS.
- [ ] Each branch contains only its three approved teacher groups.
- [ ] `MK QIAO EN` has 40 imported students and no 基础班 records.
- [ ] Enrol, stop, restore, profile, message, attendance, summary, and logout smoke checks pass.
- [ ] A stopped student keeps the same UUID, profile, attendance, and messages.
- [ ] Searching for a nonexistent student clears the previous selection and removes the save button.
- [ ] The 121-student STP group does not mount all student cards at once.
- [ ] The production URL and whether it replaces the original Render URL are stated accurately.
