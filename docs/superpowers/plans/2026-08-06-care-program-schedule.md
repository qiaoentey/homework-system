# Student Care Program Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the roster's visible `清除今日` action and save each student's Full Daycare or 功课班 schedule in the shared student profile.

**Architecture:** Extend the existing string-only profile JSON contract, so no table migration is needed. Render the new schedule through `StudentProfileFields`, which is already shared by existing-student editing and Enrol, and keep the attendance-clear server endpoint only for backwards compatibility.

**Tech Stack:** React 19, Vitest, Testing Library, Express/Zod, Cloudflare Sites Worker with D1, Playwright.

## Global Constraints

- The visible student type choices are exactly `Full Daycare` and `功课班`.
- Homework-class fields are exactly `来校时间`, `回家时间`, and 星期一至星期五 under `星期几有来`.
- Weekdays use one-tap checkboxes; time fields use native time pickers.
- Leaving `功课班` clears every hidden homework-class field.
- Existing school, transport, dinner, special-stay, point-marking, and attendance-record behavior stays unchanged.
- `清除今日` is absent from the teacher-facing roster, but the server clear endpoint remains available for compatibility.
- Older profile JSON without the new keys normalizes to empty strings.

---

### Task 1: Shared care-program profile fields

**Files:**
- Modify: `src/domain/profile.js`
- Modify: `src/features/students/StudentProfileFields.jsx`
- Test: `tests/client/profile-options.test.jsx`
- Test: `tests/client/student-lifecycle.test.jsx`
- Update fixtures: `tests/client/attendance-records.test.jsx`
- Update fixtures: `tests/client/profile-search.test.jsx`
- Update fixtures: `tests/client/roster.test.jsx`

**Interfaces:**
- Produces profile fields: `careProgram`, `homeworkArrivalTime`, `homeworkDepartureTime`, `homeworkMonday`, `homeworkTuesday`, `homeworkWednesday`, `homeworkThursday`, `homeworkFriday`.
- Stores selected weekdays as `"有来"`; unselected weekdays and hidden homework fields are `""`.

- [x] **Step 1: Write failing shared-form tests**

In `tests/client/profile-options.test.jsx`, render `ProfilePanel` with a student using the expanded empty profile. Assert:

```js
expect(screen.getByRole("combobox", { name: "学生类型" })).toHaveValue("");
expect(screen.queryByLabelText("来校时间")).not.toBeInTheDocument();
fireEvent.change(screen.getByRole("combobox", { name: "学生类型" }), {
  target: { value: "功课班" },
});
expect(screen.getByLabelText("来校时间")).toHaveValue("");
expect(screen.getByLabelText("回家时间")).toHaveValue("");
expect(screen.getByRole("checkbox", { name: "星期一" })).not.toBeChecked();
expect(screen.getByRole("checkbox", { name: "星期五" })).not.toBeChecked();
```

Fill both times, select Monday and Friday, then switch to `Full Daycare`, switch back to `功课班`, and assert both times are blank and all weekday checkboxes are unchecked.

Add an Enrol assertion in `tests/client/student-lifecycle.test.jsx`: choose `功课班`, fill `14:00` and `18:00`, select Monday/Wednesday/Friday, submit, and assert the request body contains:

```js
expect(body.profile).toEqual(expect.objectContaining({
  careProgram: "功课班",
  homeworkArrivalTime: "14:00",
  homeworkDepartureTime: "18:00",
  homeworkMonday: "有来",
  homeworkTuesday: "",
  homeworkWednesday: "有来",
  homeworkThursday: "",
  homeworkFriday: "有来",
}));
```

- [x] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npm test -- --run tests/client/profile-options.test.jsx tests/client/student-lifecycle.test.jsx
```

Expected: FAIL because `学生类型` and homework schedule controls do not exist.

- [x] **Step 3: Expand the client profile contract**

Append the eight fields to `PROFILE_FIELDS` in `src/domain/profile.js`:

```js
["careProgram", "学生类型"],
["homeworkArrivalTime", "来校时间"],
["homeworkDepartureTime", "回家时间"],
["homeworkMonday", "星期一有来"],
["homeworkTuesday", "星期二有来"],
["homeworkWednesday", "星期三有来"],
["homeworkThursday", "星期四有来"],
["homeworkFriday", "星期五有来"],
```

Update every explicit client `EMPTY_PROFILE` fixture with the same keys set to `""`.

- [x] **Step 4: Render conditional schedule controls**

In `StudentProfileFields.jsx`, define:

```js
const HOMEWORK_DAY_FIELDS = [
  ["homeworkMonday", "星期一"],
  ["homeworkTuesday", "星期二"],
  ["homeworkWednesday", "星期三"],
  ["homeworkThursday", "星期四"],
  ["homeworkFriday", "星期五"],
];
```

Add `changeCareProgram(nextValue)` that calls `onChange("careProgram", nextValue)` and, when `nextValue !== "功课班"`, clears both time fields and every weekday field. Render a `学生类型` select with blank, `Full Daycare`, and `功课班`. When the value is `功课班`, render two `type="time"` inputs and five checkboxes with:

```jsx
checked={values[field] === "有来"}
onChange={(event) => onChange(field, event.target.checked ? "有来" : "")}
```

- [x] **Step 5: Run the focused tests and verify GREEN**

Run the focused command from Step 2. Expected: both test files pass.

---

### Task 2: Remove the teacher-facing clear action

**Files:**
- Modify: `src/features/roster/StudentCard.jsx`
- Modify: `src/features/roster/StudentVirtualList.jsx`
- Modify: `src/features/roster/RosterScreen.jsx`
- Test: `tests/client/roster.test.jsx`
- Test: `tests/e2e/daycare.spec.js`

**Interfaces:**
- Removes the `onClear(studentId)` prop from `StudentCard` and `StudentVirtualList`.
- Keeps `rosterApi.clearAttendance` and the server endpoint unchanged.

- [x] **Step 1: Replace the old client clear-flow test with a failing absence test**

In `tests/client/roster.test.jsx`, replace the test that clicks `清除今日` with:

```js
it("does not expose a clear-today action on student cards", async () => {
  // render one loaded student with existing attendance
  expect(await screen.findByTestId("student-card")).toBeVisible();
  expect(screen.queryByRole("button", { name: "清除今日" })).not.toBeInTheDocument();
});
```

Add the same absence assertion to the roster E2E flow.

- [x] **Step 2: Run the focused roster test and verify RED**

Run:

```bash
npm test -- --run tests/client/roster.test.jsx -t "does not expose a clear-today action"
```

Expected: FAIL because the current student card contains `清除今日`.

- [x] **Step 3: Remove the action from the client component chain**

- Remove the `清除今日` button and `onClear` prop from `StudentCard`.
- Remove `onClear` forwarding from `StudentVirtualList`.
- Remove `clearDay` and `onClear={clearDay}` from `RosterScreen`.
- Simplify the client attendance save/retry branches so only event operations are created by the roster UI; do not change the API or server clear endpoint.

- [x] **Step 4: Run the focused roster test and verify GREEN**

Run the command from Step 2. Expected: PASS.

---

### Task 3: Expand server and Sites Worker profile validation

**Files:**
- Modify: `server/domain/profile.js`
- Modify: `worker/index.js`
- Test: `tests/server/students.test.js`
- Test: `tests/sites-worker.test.mjs`
- Update fixture: `tests/e2e/daycare.spec.js`

**Interfaces:**
- Express `fullProfileSchema` and Sites Worker `fullProfile` accept the same exact eight new string keys as the client.
- Existing partial profile updates continue accepting any non-empty subset of the complete allowlist.

- [x] **Step 1: Write failing contract tests**

Extend the Sites `emptyProfile` fixture with all eight keys. Add a profile update that saves `功课班`, `14:00`, `18:00`, and Monday/Wednesday/Friday, then assert the returned and stored profile preserves those exact values.

The existing table-driven Express test already mutates every `PROFILE_FIELDS` key. After adding the fields to its imported server contract, it must prove each new key participates in enrolment idempotency and partial updates.

- [x] **Step 2: Run server and Sites tests and verify RED**

Run:

```bash
npm test -- --run tests/server/students.test.js
npm run test:sites
```

Expected: FAIL because Express and the Worker still reject the expanded exact profile payload.

- [x] **Step 3: Expand both runtime allowlists**

Append these exact strings to both `server/domain/profile.js` and `worker/index.js`:

```js
"careProgram",
"homeworkArrivalTime",
"homeworkDepartureTime",
"homeworkMonday",
"homeworkTuesday",
"homeworkWednesday",
"homeworkThursday",
"homeworkFriday",
```

Update explicit E2E and Sites profile fixtures with blank defaults. Do not add a database migration because the existing `profile` column stores JSON.

- [x] **Step 4: Run contract tests and verify GREEN**

Run the commands from Step 2. Expected: all pass.

---

### Task 4: Full responsive validation and release preparation

**Files:**
- Modify: `docs/superpowers/plans/2026-08-06-care-program-schedule.md` checkbox states only before the implementation commit

**Interfaces:**
- Produces a validated Sites archive from the exact committed source.

- [x] **Step 1: Run complete automated checks serially**

Run:

```bash
npm test -- --testTimeout=20000 --maxWorkers=1
npm run build
npm run test:sites
git diff --check
```

Expected: all client/server tests, build, and Sites Worker tests pass.

- [x] **Step 2: Run desktop and mobile browser tests**

Run:

```bash
npx playwright test --project=desktop-chromium --reporter=dot
npx playwright test --project=mobile-chromium --reporter=dot
```

Expected: all tests pass on both projects, including the hidden clear action and homework schedule form.

- [x] **Step 3: Commit the exact validated implementation**

```bash
git add src server worker tests docs/superpowers/plans/2026-08-06-care-program-schedule.md
git commit -m "feat: add student care program schedules"
```

- [ ] **Step 4: Push, package, and save one Sites version**

Push the exact HEAD to both the working branch and the configured Sites source branch. Package that same build with the Sites helper and save one site version using the exact full HEAD SHA.

- [ ] **Step 5: Request explicit public-release approval**

The current site is public. Report that the new version is ready and ask the user to reply `确认公开发布`. Deploy only after that reply, then poll until successful and verify `/api/health` returns `{ "ok": true }`.
