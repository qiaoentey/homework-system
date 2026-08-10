# Absence Reasons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require and persist a reason whenever a teacher marks a student absent, then show it in the roster, Dashboard, and dated attendance records.

**Architecture:** Add a nullable `absence_reason` column to the shared attendance event model in PostgreSQL and Sites D1. Keep event codes as the source of attendance status, while carrying the optional reason alongside the absent event through API mapping and client state. A focused dialog owns reason selection and validation before the existing optimistic save path runs.

**Tech Stack:** React 19, Express 5, Zod 4, PostgreSQL/pg-mem, Cloudflare D1 SQLite, Vitest, Testing Library, Node test runner, Playwright.

## Global Constraints

- Reasons are exactly 生病、旅行、校外比赛、家事、其他.
- “其他” requires 1–100 non-whitespace characters and displays as `其他：<内容>`.
- Old absence rows with no reason remain readable.
- A first click on 缺席 opens the dialog; a second click on an already-active 缺席 button clears it immediately.
- The reason must display on the roster, Dashboard, and dated attendance records.
- Do not restore KOKO or the removed pickup/return attendance buttons.

---

### Task 1: Persistent absence reason contract

**Files:**
- Create: `shared/absenceReasons.js`
- Create: `server/db/migrations/007_attendance_absence_reason.sql`
- Create: `drizzle/0006_attendance_absence_reason.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `db/schema.ts`
- Modify: `server/routes/attendance.js`
- Modify: `server/repositories/attendance.js`
- Modify: `worker/index.js`
- Test: `tests/server/attendance.test.js`
- Test: `tests/server/schema.test.js`
- Test: `tests/sites-worker.test.mjs`

**Interfaces:**
- Consumes: existing attendance event PUT endpoint and `attendance_events` primary key.
- Produces: `normalizeAbsenceReason(value): string | null`, `formatAbsenceReason(value): string`, and API field `absenceReason: string | null`.

- [ ] **Step 1: Write failing PostgreSQL API and schema tests**

Add a test that sends:

```js
await agent.put(`${prefix}/absent`).set(groupHeaders())
  .send({ active: true, reason: "旅行" }).expect(200);
expect(response.body.absenceReason).toBe("旅行");
```

Also assert that active absence without a reason, whitespace-only reason, a reason longer than 100 characters, and `reason` on a non-absence event return 400. Assert the migration adds nullable `absence_reason`.

- [ ] **Step 2: Run the focused PostgreSQL tests and verify failure**

Run: `npm test -- --maxWorkers=1 tests/server/attendance.test.js tests/server/schema.test.js`

Expected: FAIL because the API rejects the new body and the column does not exist.

- [ ] **Step 3: Implement the shared validation, PostgreSQL migration, route, and repository mapping**

Use this contract:

```js
export const ABSENCE_REASON_OPTIONS = ["生病", "旅行", "校外比赛", "家事", "其他"];
export function normalizeAbsenceReason(value) {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  return reason && reason.length <= 100 ? reason : null;
}
export function formatAbsenceReason(value) {
  if (!value) return "";
  return ABSENCE_REASON_OPTIONS.slice(0, 4).includes(value) ? value : `其他：${value}`;
}
```

Add `absence_reason text` to the database, include it in SELECT/RETURNING clauses, clear it when an absence becomes inactive, and require it only for active absent writes.

- [ ] **Step 4: Write failing D1 Worker tests**

Assert D1 accepts `{ active: true, reason: "生病" }`, returns `absenceReason`, lists it, rejects missing/invalid reasons, and includes the reason in Dashboard and attendance-record responses.

- [ ] **Step 5: Run the Sites tests and verify failure**

Run: `npm run test:sites`

Expected: FAIL because D1 has no `absence_reason` column or Worker handling.

- [ ] **Step 6: Implement D1 schema, migration journal, and Worker parity**

Add one migration statement:

```sql
ALTER TABLE attendance_events ADD COLUMN absence_reason TEXT;
```

Update Worker request validation, SQL bindings, mapping, Dashboard aggregation, and record aggregation so its JSON matches Express exactly.

- [ ] **Step 7: Run persistence tests and commit**

Run:

```bash
npm test -- --maxWorkers=1 tests/server/attendance.test.js tests/server/schema.test.js
npm run test:sites
git add shared/absenceReasons.js server db drizzle worker tests/server tests/sites-worker.test.mjs
git commit -m "feat: persist absence reasons"
```

Expected: all focused persistence tests PASS.

### Task 2: Point-marking reason dialog and roster display

**Files:**
- Create: `src/features/attendance/AbsenceReasonDialog.jsx`
- Modify: `src/api/client.js`
- Modify: `src/features/roster/RosterScreen.jsx`
- Modify: `src/features/roster/StudentVirtualList.jsx`
- Modify: `src/features/roster/StudentCard.jsx`
- Modify: `src/styles/app.css`
- Test: `tests/client/roster.test.jsx`

**Interfaces:**
- Consumes: `rosterApi.setAttendance({ ..., active, reason? })` and `absenceReason` from the attendance list.
- Produces: `AbsenceReasonDialog({ studentName, onConfirm, onClose })` where `onConfirm(reason)` receives a trimmed fixed or custom reason.

- [ ] **Step 1: Write failing roster tests**

Cover these behaviors:

```jsx
fireEvent.click(within(card).getByRole("button", { name: "缺席" }));
const dialog = await screen.findByRole("dialog", { name: "选择缺席原因" });
fireEvent.click(within(dialog).getByLabelText("旅行"));
fireEvent.click(within(dialog).getByRole("button", { name: "确认缺席" }));
expect(JSON.parse(fetchPut.mock.calls[0][1].body)).toEqual({ active: true, reason: "旅行" });
expect(await within(card).findByText("缺席原因：旅行")).toBeVisible();
```

Add tests for an empty “其他”, cancel-without-change, existing stored reason display, retry preserving the reason, and second-click clearing without opening the dialog.

- [ ] **Step 2: Run the roster tests and verify failure**

Run: `npm test -- --maxWorkers=1 tests/client/roster.test.jsx`

Expected: FAIL because clicking 缺席 saves immediately and there is no reason UI.

- [ ] **Step 3: Implement dialog, reason-aware state, save/retry, and responsive styling**

Maintain two maps in `RosterScreen`: event codes by student and absence reason by student. Only open the dialog for a newly active absent event. Confirming starts the existing optimistic save with `reason`; cancellation leaves both maps untouched. Show this label only while absent:

```jsx
{eventSet.has("absent") && absenceReason ? (
  <p className="student-card__absence-reason">
    缺席原因：{formatAbsenceReason(absenceReason)}
  </p>
) : null}
```

- [ ] **Step 4: Run roster tests and commit**

Run:

```bash
npm test -- --maxWorkers=1 tests/client/roster.test.jsx
git add src tests/client/roster.test.jsx
git commit -m "feat: require absence reason when marking"
```

Expected: roster tests PASS on desktop and narrow viewport styles remain usable.

### Task 3: Dashboard and dated record display

**Files:**
- Modify: `src/features/dashboard/DashboardScreen.jsx`
- Modify: `src/features/attendance/AttendanceRecordsDialog.jsx`
- Modify: `src/styles/app.css`
- Test: `tests/client/dashboard.test.jsx`
- Test: `tests/client/attendance-records.test.jsx`
- Test: `tests/client/daily-attendance.test.js`

**Interfaces:**
- Consumes: `student.absenceReason` from Dashboard and attendance-record APIs plus `formatAbsenceReason`.
- Produces: visible `缺席原因：<formatted>` text only for absence students with a saved reason.

- [ ] **Step 1: Write failing display tests**

Add `absenceReason: "生病"` to an absent Dashboard student and `absenceReason: "回乡处理事情"` to an absent historical record. Assert the exact visible strings `缺席原因：生病` and `缺席原因：其他：回乡处理事情`. Also keep a legacy null fixture and assert no empty label renders.

- [ ] **Step 2: Run display tests and verify failure**

Run: `npm test -- --maxWorkers=1 tests/client/dashboard.test.jsx tests/client/attendance-records.test.jsx tests/client/daily-attendance.test.js`

Expected: FAIL because the API field is not rendered.

- [ ] **Step 3: Render the reason without changing existing status calculations**

Use `formatAbsenceReason` in both views. Keep metrics, button order, active blue styling, and hidden KOKO behavior unchanged.

- [ ] **Step 4: Run display tests and commit**

Run:

```bash
npm test -- --maxWorkers=1 tests/client/dashboard.test.jsx tests/client/attendance-records.test.jsx tests/client/daily-attendance.test.js
git add src/features/dashboard src/features/attendance src/styles tests/client
git commit -m "feat: show absence reasons in reports"
```

Expected: all focused display tests PASS.

### Task 4: Full verification and public release

**Files:**
- Modify: `tests/e2e/daycare.spec.js`

**Interfaces:**
- Consumes: complete feature through the browser and deployed Sites artifact.
- Produces: verified desktop/mobile workflow and a publicly deployed version on `daycarecheckin.cyedu.biz`.

- [ ] **Step 1: Add the browser journey**

Test selecting “其他”, requiring its text, saving an absence, seeing the reason on the roster, opening Dashboard to see the same reason, and revisiting the dated attendance record.

- [ ] **Step 2: Run all verification commands**

Run:

```bash
npm test -- --maxWorkers=1 --reporter=dot
npm run test:sites
npm run build
npm run test:e2e -- --grep "absence reason"
git diff --check
```

Expected: every command exits 0; `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json` exist.

- [ ] **Step 3: Commit the journey, push, publish, and verify**

```bash
git add tests/e2e/daycare.spec.js
git commit -m "test: cover absence reason workflow"
git push origin codex/daycare-optimized
```

Package and deploy the committed source to the existing Sites project, wait for the deployment to become ready, then verify `https://daycarecheckin.cyedu.biz` returns the new asset bundle and healthy page.
