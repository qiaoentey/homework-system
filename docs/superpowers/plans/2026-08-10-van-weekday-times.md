# Van Weekday Times Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a teacher to choose `5:30 PM`, `7:00 PM`, or `8:45 PM` separately for each Van weekday and show those weekday-time combinations beside the student name.

**Architecture:** Reuse `vanMonday` through `vanFriday` as string-valued weekday-time fields so no D1 schema change is needed. The client converts legacy `需要` plus `vanHomeTime` records into displayed selector values, while roster labels group explicit weekday times and preserve the legacy label format.

**Tech Stack:** React, Vitest, Testing Library, Node test runner, Vite, Sites Worker/D1 JSON profiles.

## Global Constraints

- Weekday choices are exactly `不需要`, `5:30 PM`, `7:00 PM`, and `8:45 PM`.
- New edits store `17:30`, `19:00`, or `20:45` directly in the existing weekday field.
- Existing `需要` weekday values use `vanHomeTime`, then `usualPickupTime`, as their display fallback.
- No database migration and no unrelated profile, attendance, Dashboard, or access changes.

---

### Task 1: Per-weekday Van time controls

**Files:**
- Modify: `tests/client/profile-options.test.jsx`
- Modify: `src/features/students/StudentProfileFields.jsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `values.vanMonday` through `values.vanFriday`, legacy `values.vanHomeTime`, and `onChange(field, value)`.
- Produces: five comboboxes named `星期一 Van 时间` through `星期五 Van 时间` that store one of `""`, `"17:30"`, `"19:00"`, or `"20:45"`.

- [ ] **Step 1: Write the failing component test**

Update the Van controls test to assert each weekday combobox has literal options `不需要`, `5:30 PM`, `7:00 PM`, `8:45 PM`, then change Monday to `17:30` and Wednesday to `19:00` and assert their selected values.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `./node_modules/.bin/vitest run tests/client/profile-options.test.jsx -t 'restores time, transport, Van, driver, and weekday stay controls'`

Expected: FAIL because the weekday time comboboxes do not exist.

- [ ] **Step 3: Implement the minimal controls**

Replace the Van weekday checkboxes and shared `Van 载送时间` select with one select per weekday. Resolve legacy `需要` to `vanHomeTime` when it matches a requested choice, otherwise to an empty value. Keep the five controls in the existing full-width Van section and use a responsive five-column/two-column grid.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the focused Vitest command from Step 2 and expect one passing test.

### Task 2: Saved payload and search compatibility

**Files:**
- Modify: `tests/client/student-lifecycle.test.jsx`
- Modify: `tests/client/profile-search.test.jsx`
- Modify: `tests/e2e/daycare.spec.js`

**Interfaces:**
- Consumes: the weekday combobox contract from Task 1.
- Produces: enrol/profile payloads containing explicit weekday times and search coverage for the new labels.

- [ ] **Step 1: Update interaction tests to the new controls**

Select `17:30` for Monday and Friday and `19:00` for Wednesday. Assert the submitted profile keeps `vanHomeTime` compatible but stores the explicit weekday values. Replace checkbox-specific search/E2E interactions with combobox selections.

- [ ] **Step 2: Run affected client tests**

Run: `./node_modules/.bin/vitest run tests/client/student-lifecycle.test.jsx tests/client/profile-search.test.jsx tests/client/profile-options.test.jsx`

Expected: all affected client tests pass.

### Task 3: Grouped Van labels with legacy compatibility

**Files:**
- Modify: `tests/client/roster.test.jsx`
- Modify: `src/features/roster/studentProfileLabels.js`

**Interfaces:**
- Consumes: explicit weekday time strings and legacy `需要` plus shared/fallback times.
- Produces: Van label details grouped as `周一、五 5:30 PM` and `周三 7:00 PM`, while legacy records retain `周一、三、五 · 7:00 PM`.

- [ ] **Step 1: Write the failing grouped-label test**

Add a roster fixture with `vanMonday: "17:30"`, `vanWednesday: "19:00"`, and `vanFriday: "17:30"`; assert the literal label `Van载送 · Uncle Kent · 周一、五 5:30 PM · 周三 7:00 PM`.

- [ ] **Step 2: Run the focused roster test and verify RED**

Run: `./node_modules/.bin/vitest run tests/client/roster.test.jsx -t 'groups Van weekdays by their saved return time'`

Expected: FAIL because the current label helper only recognizes `需要`.

- [ ] **Step 3: Implement explicit-time grouping**

Add a helper that maps each weekday to an explicit time, or to the legacy fallback when its value is `需要`. Group explicit times in weekday order and render each group with `displayTime`. Use the existing legacy layout when every active day came from `需要` so current records do not change unexpectedly.

- [ ] **Step 4: Run the focused and full roster tests**

Run the focused command, then `./node_modules/.bin/vitest run tests/client/roster.test.jsx` and expect all roster tests to pass.

### Task 4: Full verification and publication

**Files:**
- Verify all modified files and the existing Sites build output.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: a validated production build and public deployment.

- [ ] **Step 1: Run complete verification**

Run `npm test -- --maxWorkers=1 --reporter=dot`, `npm run test:sites`, `npm run build`, and `git diff --check`. Expect 0 failures and exit code 0 for each command.

- [ ] **Step 2: Commit and push the exact source**

Stage only the design, plan, implementation, and relevant tests. Commit with `feat: add per-day Van return times`, then push `codex/daycare-optimized` to GitHub and the Sites source repository.

- [ ] **Step 3: Package and deploy**

Package the exact committed build, save one Sites version, deploy it publicly using the user's standing direct-publication instruction, and poll until `succeeded`.

- [ ] **Step 4: Verify production**

Check `https://daycarecheckin.cyedu.biz/api/health` returns `{ "ok": true }` and the homepage returns HTTP 200.
