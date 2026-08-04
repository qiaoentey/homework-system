# Attendance Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an automatic, date-based class record for present, absent, and unmarked students; make arrive/absent mutually exclusive; remove the pickup button.

**Architecture:** Keep `attendance_events` as the source of truth. Add one scoped read endpoint in both Express and the Sites Worker, build a focused dialog on top of that endpoint, and enforce arrive/absent exclusivity at both the optimistic UI and database write boundaries. No schema migration is required.

**Tech Stack:** React 19, Express 5, PostgreSQL/pg-mem, Cloudflare-compatible Sites Worker with D1, Vitest, Node test runner, Playwright.

## Global Constraints

- “出席” means active `arrive`; “缺席” means active `absent`; “未点名” means neither.
- Remove only the client `pickup` button; retain backend compatibility and all old pickup records.
- Activating arrive or absent atomically deactivates its opposite. Deactivation never activates the opposite.
- Historical present/absent lists include recorded students even after stop-supplement; unmarked uses the current active roster.
- All reads and writes remain branch/group scoped.
- Do not add calendar, per-student analytics, export, print, or a database migration.

---

### Task 1: Pointing controls and optimistic exclusivity

**Files:**
- Modify: `src/domain/attendance.js`
- Modify: `src/features/roster/RosterScreen.jsx`
- Modify: `tests/client/roster.test.jsx`

**Interfaces:**
- Produces: `nextAttendanceEvents(previous, eventCode, active)` in `src/domain/attendance.js`.
- Behavior: active `arrive` removes `absent`; active `absent` removes `arrive`; all other events remain independent.

- [ ] **Step 1: Write failing client tests**

Add literal behavior assertions:

```jsx
expect(within(card).queryByRole("button", { name: "接" })).not.toBeInTheDocument();
fireEvent.click(within(card).getByRole("button", { name: "缺席" }));
expect(within(card).getByRole("button", { name: "缺席" })).toHaveAttribute("aria-pressed", "true");
expect(within(card).getByRole("button", { name: "到" })).toHaveAttribute("aria-pressed", "false");
```

Cover retry rollback from an arrive/absent change so both buttons return to the exact `previous` array on failure.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run tests/client/roster.test.jsx`

Expected: FAIL because “接” still renders and toggling one status does not remove the other.

- [ ] **Step 3: Implement the minimal client behavior**

Change `EVENT_BUTTONS` to begin with `arrive`, leaving backend event constants unchanged. Export and use:

```js
export function nextAttendanceEvents(previous, eventCode, active) {
  const opposite = eventCode === "arrive"
    ? "absent"
    : eventCode === "absent"
      ? "arrive"
      : null;
  const withoutCurrent = previous.filter((code) => code !== eventCode);
  if (!active) return withoutCurrent;
  const compatible = opposite
    ? withoutCurrent.filter((code) => code !== opposite)
    : withoutCurrent;
  return [...compatible, eventCode];
}
```

Use this helper in both `toggleEvent` and `retry`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- --run tests/client/roster.test.jsx`

Expected: all roster client tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/attendance.js src/features/roster/RosterScreen.jsx tests/client/roster.test.jsx
git commit -m "feat: simplify attendance controls"
```

### Task 2: Express attendance record and atomic writes

**Files:**
- Modify: `server/repositories/attendance.js`
- Modify: `server/routes/attendance.js`
- Modify: `tests/server/attendance.test.js`

**Interfaces:**
- Produces: `getAttendanceRecord(pool, { branchCode, groupCode, date })`.
- Produces endpoint: `GET /api/attendance-records?branch=&group=&date=`.
- Response: `{ date, counts, present, absent, unmarked, conflicts }`, with each student item exactly `{ id, name, grade }`.

- [ ] **Step 1: Write failing API tests**

Create active present, active absent, active unmarked, stopped present, inactive event, cross-group, and conflicting fixtures. Assert this literal shape:

```js
expect(response.body).toEqual({
  date: "2026-07-27",
  counts: { present: 2, absent: 1, unmarked: 1, conflicts: 1 },
  present: [
    { id: present.id, name: "PRESENT", grade: "Y4" },
    { id: stoppedPresent.id, name: "STOPPED PRESENT", grade: "Y4" },
  ],
  absent: [{ id: absent.id, name: "ABSENT", grade: "Y4" }],
  unmarked: [{ id: unmarked.id, name: "UNMARKED", grade: "Y4" }],
  conflicts: [{ id: conflict.id, name: "CONFLICT", grade: "Y4" }],
});
```

Also assert unauthenticated, invalid date, and branch/group mismatch responses. Add write tests proving an active arrive makes stored absent false, active absent makes stored arrive false, and inactive arrive leaves absent unchanged.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run tests/server/attendance.test.js`

Expected: FAIL with missing `/api/attendance-records` behavior and opposite event still active.

- [ ] **Step 3: Implement record classification**

Query all current active students plus students with an active arrive/absent event on the requested date. Classify active events using sets. Put both-event students only in `conflicts`, never duplicate them in present or absent. Sort every list by lowercased name then ID.

- [ ] **Step 4: Implement transactional exclusivity**

Use one checked-out client and `begin/commit/rollback`. After upserting active arrive or absent, upsert its opposite with `is_active = false` and the same actor inside the same transaction. Return the requested event as before.

- [ ] **Step 5: Register the route and verify GREEN**

Run: `npm test -- --run tests/server/attendance.test.js`

Expected: all Express attendance tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/repositories/attendance.js server/routes/attendance.js tests/server/attendance.test.js
git commit -m "feat: add scoped attendance records API"
```

### Task 3: Sites Worker parity

**Files:**
- Modify: `worker/index.js`
- Modify: `tests/sites-worker.test.mjs`

**Interfaces:**
- Consumes: the exact route and response contract from Task 2.
- Produces: D1-backed `/api/attendance-records` and atomic arrive/absent writes.

- [ ] **Step 1: Write failing Worker tests**

Seed the same six fixture categories as Task 2 in a temporary D1 database. Assert the exact response lists, scope validation, and stopped recorded student preservation. Write both arrive→absent and absent→arrive exclusivity assertions against stored D1 rows.

- [ ] **Step 2: Verify RED**

Run: `npm run test:sites`

Expected: FAIL because the Worker route is absent and both statuses remain active.

- [ ] **Step 3: Implement the Worker record read**

Add `attendanceRecord(database, url)` beside `attendanceList`. Validate only `branch`, `group`, and `date`; run the same union query and classification rules as Express; register `/api/attendance-records` as a database route.

- [ ] **Step 4: Implement D1 batch exclusivity**

For active arrive/absent, call `database.batch` with the requested upsert and the opposite inactive upsert. For all other writes, keep the existing single upsert. Return the requested event row.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm run test:sites`

Expected: all Sites Worker tests PASS.

```bash
git add worker/index.js tests/sites-worker.test.mjs
git commit -m "feat: add worker attendance records"
```

### Task 4: Teacher attendance record dialog

**Files:**
- Create: `src/features/attendance/AttendanceRecordsDialog.jsx`
- Modify: `src/api/client.js`
- Modify: `src/features/roster/RosterScreen.jsx`
- Modify: `src/styles/app.css`
- Create: `tests/client/attendance-records.test.jsx`

**Interfaces:**
- Consumes: `rosterApi.attendanceRecords({ branchCode, groupCode, date })`.
- Component props: `{ branchCode, groupCode, initialDate, onClose }`.
- Renders counts and student lists directly from the API without recomputing classification.

- [ ] **Step 1: Write failing dialog tests**

Render the real `RosterScreen`, open “点名记录”, and assert:

```jsx
expect(screen.getByRole("dialog", { name: "点名记录" })).toBeVisible();
expect(screen.getByLabelText("记录日期")).toHaveValue("2026-07-27");
expect(screen.getByRole("heading", { name: "出席 1" })).toBeVisible();
expect(screen.getByRole("heading", { name: "缺席 1" })).toBeVisible();
expect(screen.getByRole("heading", { name: "未点名 1" })).toBeVisible();
```

Change the date and assert the second URL contains the new date and current branch/group. Add empty-list, conflict-warning, request failure, retry, Escape close, and opener-focus restoration coverage.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run tests/client/attendance-records.test.jsx`

Expected: FAIL because there is no “点名记录” button or dialog.

- [ ] **Step 3: Implement API and dialog**

Add the API method through `queryPath`. Build the dialog with `LifecycleDialog`, a date input (`max` set to local today), independent loading/error/ready states, three list cards, and a conditional conflict alert. Use stable student IDs as list keys.

- [ ] **Step 4: Add responsive styles**

Use a three-column `.attendance-records__lists` grid on desktop and one column inside the existing mobile media query. Keep buttons and the date input at least 44px high.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm test -- --run tests/client/attendance-records.test.jsx tests/client/roster.test.jsx`

Expected: all selected client tests PASS.

```bash
git add src/api/client.js src/features/attendance/AttendanceRecordsDialog.jsx src/features/roster/RosterScreen.jsx src/styles/app.css tests/client/attendance-records.test.jsx
git commit -m "feat: show daily attendance records"
```

### Task 5: End-to-end verification and production publish

**Files:**
- Modify: `tests/e2e/daycare.spec.js`

**Interfaces:**
- Verifies the complete UI/API contract on desktop and mobile.

- [ ] **Step 1: Add failing browser coverage**

Open a teacher group, assert no “接” button, set one visible student to “到”, open “点名记录”, and assert that student appears under the exact selected date’s 出席 list. Switch to an older date and assert the dialog reloads without changing branch or teacher group.

- [ ] **Step 2: Run the focused browser test before any adjustment**

Run: `npm run test:e2e -- --grep "attendance records"`

Expected: PASS after Tasks 1-4; if it fails, fix production behavior rather than weakening assertions.

- [ ] **Step 3: Run full verification**

Run in order:

```bash
npm test
npm run test:sites
npm run build
npm run test:e2e
git diff --check
```

Expected: zero failures, successful production build, and a clean diff check.

- [ ] **Step 4: Commit browser coverage**

```bash
git add tests/e2e/daycare.spec.js
git commit -m "test: verify attendance record workflow"
```

- [ ] **Step 5: Publish the exact validated commit**

Use the existing `.openai/hosting.json` project, push the validated HEAD to the configured Sites source branch, package with the Sites helper, save one version, deploy to the existing access level, poll until `succeeded`, and request `/api/health` from the deployed URL.
