# Daily Daycare Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an all-branch daily Dashboard, restore mutually exclusive KOKO marking, and make the current-class summary and Dashboard use one attendance-status calculation.

**Architecture:** A small shared pure module will classify each student's primary daily status and calculate the six approved totals. The Express runtime and the Sites Worker will both call that module for current-group summaries and a new all-group Dashboard endpoint. React will add a Dashboard route from the branch entrance and render branch-filtered, expandable class cards from one API response.

**Tech Stack:** React 19, Vite, Express 5, Cloudflare Worker/D1, PostgreSQL, Vitest, Testing Library, Node test runner, Playwright.

## Global Constraints

- Dashboard scope is today only; do not add history charts, exports, or print.
- All authorized Google accounts may see all branches and groups.
- Primary states are mutually exclusive: `arrive`, `absent`, `koko`, or no event (`unmarked`).
- `notArrived = koko + unmarked` and `expected = arrived + absent + koko + unmarked`.
- Current-class summary and Dashboard must call the same pure calculation.
- Point-marking button order is `到`, `缺席`, `KOKO`, `冲`, `餐`, `功`, `补`.
- Dashboard layout is option A: one expandable card per class, responsive on desktop and mobile.

---

### Task 1: Shared primary-status contract and KOKO marking

**Files:**
- Create: `shared/dailyAttendance.js`
- Modify: `src/domain/attendance.js`
- Modify: `server/domain/attendance.js`
- Modify: `server/repositories/attendance.js`
- Modify: `worker/index.js`
- Test: `tests/client/roster.test.jsx`
- Test: `tests/server/attendance.test.js`
- Test: `tests/sites-worker.test.mjs`

**Interfaces:**
- Produces: `PRIMARY_ATTENDANCE_EVENTS = ["arrive", "absent", "koko"]`.
- Produces: `primaryStatusFor(events: Iterable<string>): "arrived" | "absent" | "koko" | "unmarked"` using legacy-conflict priority `absent > arrive > koko`.
- Produces: `dailyAttendanceResult(students)` returning `{ summary, students }`, where `summary` has `expected`, `arrived`, `notArrived`, `absent`, `koko`, `unmarked`, and each returned student has `status`.

- [ ] **Step 1: Write failing pure-contract and client tests**

Add tests that expect:

```js
expect(EVENT_BUTTONS.map(([code]) => code)).toEqual([
  "arrive", "absent", "koko", "shower", "meal", "homework", "supplement",
]);
expect(nextAttendanceEvents(["arrive", "meal"], "koko", true))
  .toEqual(["meal", "koko"]);
expect(dailyAttendanceResult([
  { id: "a", events: ["arrive"] },
  { id: "b", events: ["absent"] },
  { id: "c", events: ["koko"] },
  { id: "d", events: [] },
]).summary).toEqual({
  expected: 4, arrived: 1, notArrived: 2, absent: 1, koko: 1, unmarked: 1,
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npx vitest run tests/client/roster.test.jsx tests/server/attendance.test.js`

Expected: failure because KOKO is absent from the client/server event lists and the shared module does not exist.

- [ ] **Step 3: Implement the shared classifier and client event behavior**

Create `shared/dailyAttendance.js` with pure, runtime-neutral functions. Update `src/domain/attendance.js` so `nextAttendanceEvents` removes every other primary event when activating one primary event. Add `koko` to both server event allowlists.

- [ ] **Step 4: Make server writes deactivate all other primary events**

In the PostgreSQL transaction and D1 batch, when one primary event is activated, set both other primary event rows inactive for the same student/date. Preserve independent events such as meal and shower.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npx vitest run tests/client/roster.test.jsx tests/server/attendance.test.js`

Run: `npm run test:sites`

Expected: KOKO button/order, optimistic state, PostgreSQL writes, and D1 writes all pass.

- [ ] **Step 6: Commit**

```bash
git add shared/dailyAttendance.js src/domain/attendance.js server/domain/attendance.js server/repositories/attendance.js worker/index.js tests/client/roster.test.jsx tests/server/attendance.test.js tests/sites-worker.test.mjs
git commit -m "feat: restore exclusive KOKO attendance"
```

### Task 2: Unified summary and all-class Dashboard API

**Files:**
- Modify: `shared/dailyAttendance.js`
- Modify: `server/repositories/attendance.js`
- Modify: `server/routes/attendance.js`
- Modify: `worker/index.js`
- Modify: `src/api/client.js`
- Test: `tests/server/attendance.test.js`
- Test: `tests/sites-worker.test.mjs`

**Interfaces:**
- Consumes: `dailyAttendanceResult(students)` from Task 1.
- Produces: authenticated `GET /api/dashboard?date=YYYY-MM-DD`.
- Produces response:

```js
{
  date: "2026-08-09",
  groups: [{
    branchCode: "MK",
    groupCode: "MK HAPPY",
    groupLabel: "HAPPY",
    summary: { expected: 2, arrived: 1, notArrived: 1, absent: 0, koko: 1, unmarked: 0 },
    students: [
      { id: "...", name: "Adam", grade: "Y1", status: "arrived" },
      { id: "...", name: "Emily", grade: "Y2", status: "koko" },
    ],
  }],
}
```
- Produces client call `rosterApi.dashboard({ date })`.

- [ ] **Step 1: Write failing API tests**

For Express and Sites Worker, seed active and stopped students across at least two groups, activate each primary status, and assert:

```js
expect(response.body.groups.map((group) => group.groupCode)).toContain("MK HAPPY");
expect(response.body.groups[0].summary.expected).toBe(
  response.body.groups[0].summary.arrived
  + response.body.groups[0].summary.absent
  + response.body.groups[0].summary.koko
  + response.body.groups[0].summary.unmarked
);
expect(response.body.groups[0].students).toEqual(expect.arrayContaining([
  expect.objectContaining({ name: "KOKO STUDENT", status: "koko" }),
]));
```

Also assert unauthenticated access returns 401, invalid/extra date parameters return 400, stopped students are excluded, and empty catalog groups return six zeros plus an empty student list.

- [ ] **Step 2: Run API tests and verify RED**

Run: `npx vitest run tests/server/attendance.test.js`

Run: `npm run test:sites`

Expected: `/api/dashboard` is not registered.

- [ ] **Step 3: Replace group-summary formulas with the shared calculation**

Map each active student to `{ id, name, grade, events }`, call `dailyAttendanceResult`, and return only its `summary` for `/api/summary`. Remove the duplicated counters from PostgreSQL and Worker implementations.

- [ ] **Step 4: Implement all-group reads in both runtimes**

Read every `teacher_groups` row, left join active students and active primary events for the requested date, group rows by teacher group, and call `dailyAttendanceResult` independently per group. Sort groups by catalog order and students by case-insensitive name then stable ID.

- [ ] **Step 5: Register routes and client API**

Add authenticated `GET /api/dashboard` to Express and the Sites Worker database route list. Add `rosterApi.dashboard({ date })` without branch/group headers because all authenticated users are allowed to read every group.

- [ ] **Step 6: Run API tests and verify GREEN**

Run: `npx vitest run tests/server/attendance.test.js`

Run: `npm run test:sites`

Expected: all summary and Dashboard tests pass with identical totals.

- [ ] **Step 7: Commit**

```bash
git add shared/dailyAttendance.js server/repositories/attendance.js server/routes/attendance.js worker/index.js src/api/client.js tests/server/attendance.test.js tests/sites-worker.test.mjs
git commit -m "feat: add unified daily dashboard API"
```

### Task 3: Responsive Dashboard entrance and class cards

**Files:**
- Create: `src/features/dashboard/DashboardScreen.jsx`
- Create: `tests/client/dashboard.test.jsx`
- Modify: `src/features/dashboard/SummaryBar.jsx`
- Modify: `src/features/branches/BranchGateway.jsx`
- Modify: `src/state/flowReducer.js`
- Modify: `src/App.jsx`
- Modify: `src/styles/app.css`
- Modify: `tests/client/branch-flow.test.jsx`

**Interfaces:**
- Consumes: `rosterApi.dashboard({ date })` from Task 2.
- Produces: `DashboardScreen({ branches, onBack })` with `全部`, `MK`, `STP`, `WS` filter buttons, manual refresh, expandable class cards, and student status labels.
- Produces reducer actions `OPEN_DASHBOARD` and `BACK_TO_BRANCHES`.

- [ ] **Step 1: Write failing component and navigation tests**

Test the entrance button, route transition, six exact labels, branch filtering, card expansion, status colors, refresh request, empty group, and retry after error. Representative assertions:

```jsx
expect(screen.getByRole("button", { name: "Dashboard" })).toBeVisible();
expect(await screen.findByRole("heading", { name: "当天 Dashboard" })).toBeVisible();
expect(within(card).getByText("还没有")).toBeVisible();
fireEvent.click(within(card).getByRole("button", { name: /展开学生/ }));
expect(within(card).getByText("Adam")).toBeVisible();
expect(within(card).getByText("已到")).toHaveClass("dashboard-status--arrived");
```

- [ ] **Step 2: Run client tests and verify RED**

Run: `npx vitest run tests/client/dashboard.test.jsx tests/client/branch-flow.test.jsx tests/client/roster.test.jsx`

Expected: Dashboard route/components are missing and current summary labels do not match.

- [ ] **Step 3: Implement routing and entrance**

Add a `Dashboard` button below the three branch buttons. Extend the reducer and `App` to show `DashboardScreen` inside `AppShell` with logout and back-to-branches actions.

- [ ] **Step 4: Implement Dashboard state and cards**

On mount load Malaysia-local today, render a full-page loading state, preserve no stale payload on a failed refresh, and show retry. Render one expandable card per returned group and filter by branch without refetching. Map statuses to exact text/color: `arrived → 已到`, `absent → 缺席`, `koko → KOKO`, `unmarked → 未点`.

- [ ] **Step 5: Align current-class summary copy**

Change the six summary items to exact order: `应到`, `已到`, `还没有`, `缺席`, `KOKO`, `未点`. Keep the existing independent summary retry behavior.

- [ ] **Step 6: Add responsive styles**

Use a three-column summary grid inside cards on mobile and six columns when space allows. Keep cards full-width, make the branch filters wrap, and ensure student rows remain readable at 375px width without horizontal scrolling.

- [ ] **Step 7: Run client tests and verify GREEN**

Run: `npx vitest run tests/client/dashboard.test.jsx tests/client/branch-flow.test.jsx tests/client/roster.test.jsx`

Expected: navigation, filters, cards, statuses, refresh/retry, and current summary all pass.

- [ ] **Step 8: Commit**

```bash
git add src/features/dashboard/DashboardScreen.jsx src/features/dashboard/SummaryBar.jsx src/features/branches/BranchGateway.jsx src/state/flowReducer.js src/App.jsx src/styles/app.css tests/client/dashboard.test.jsx tests/client/branch-flow.test.jsx tests/client/roster.test.jsx
git commit -m "feat: add responsive daily dashboard"
```

### Task 4: End-to-end consistency, regression verification, and publication

**Files:**
- Modify: `tests/e2e/daycare.spec.js`

**Interfaces:**
- Consumes: completed KOKO flow, Dashboard API, and Dashboard UI.
- Produces: browser-level proof that a point-marking write updates both the current class and Dashboard with identical totals.

- [ ] **Step 1: Write the failing end-to-end scenario**

Add a scenario that opens one class, marks four fixture students as `到`, `缺席`, `KOKO`, and untouched, asserts the current summary, returns to Dashboard, filters the branch, expands the class, and asserts the same six totals and four student statuses.

- [ ] **Step 2: Run desktop and mobile E2E tests**

Run: `npm run test:e2e -- --project=desktop-chromium`

Run: `npm run test:e2e -- --project=mobile-chromium`

Expected: all scenarios pass with no horizontal overflow on mobile.

- [ ] **Step 3: Run the full regression suite and build**

Run: `npm test -- --fileParallelism=false`

Run: `npm run test:sites`

Run: `npm run build`

Run: `git diff --check`

Expected: every command exits 0.

- [ ] **Step 4: Commit the end-to-end coverage**

```bash
git add tests/e2e/daycare.spec.js
git commit -m "test: verify dashboard attendance consistency"
```

- [ ] **Step 5: Publish and verify production**

Push `codex/daycare-optimized`, package the exact commit, save a new Sites version, publicly deploy it to the existing project, wait for `succeeded`, confirm the custom domain remains active, and verify `https://daycarecheckin.cyedu.biz` returns HTTP 200.
