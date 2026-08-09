# Van Weekday Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save Van weekdays with the existing driver and common return time, and show the schedule beside each student's name.

**Architecture:** Extend the profile JSON contract with five string weekday fields and reuse the existing checkbox pattern. Keep the current single `vanHomeTime`, validate the new fields in Express and the Sites Worker, and summarize selected weekdays in the existing green Van label with a backward-compatible `平日` fallback.

**Tech Stack:** React, Express, PostgreSQL JSON, Cloudflare Worker/D1 JSON, Vitest, Node test runner, Playwright, Vite

## Global Constraints

- One return time applies to all selected Van weekdays.
- Weekday selections are optional and store `需要` or an empty string.
- Existing Van profiles without weekdays continue to display `平日`.
- No SQL schema migration is added because the profile remains JSON.
- Hidden Van values are preserved to prevent accidental data loss.

---

### Task 1: Van weekday controls and enrol payload

**Files:**
- Modify: `tests/client/profile-options.test.jsx`
- Modify: `tests/client/student-lifecycle.test.jsx`
- Modify: `src/domain/profile.js`
- Modify: `src/features/students/StudentProfileFields.jsx`

**Interfaces:**
- Consumes: `values.vanMonday` through `values.vanFriday` as profile strings.
- Produces: five `星期X Van` checkboxes that write `需要` when checked and `""` when unchecked.

- [x] **Step 1: Write failing client behaviour tests**

Assert that selecting `Van` reveals all five uniquely labelled weekday checkboxes, that Monday/Wednesday/Friday can be checked, and that the Enrol request includes those exact profile values with the existing driver and return time.

- [x] **Step 2: Verify client RED**

Run `npm test -- tests/client/profile-options.test.jsx tests/client/student-lifecycle.test.jsx --testTimeout=20000 --maxWorkers=1`. Expect failures because the weekday controls do not exist.

- [x] **Step 3: Implement the client fields and controls**

Add the five fields to `PROFILE_FIELDS`, define a Van weekday field map in `StudentProfileFields`, and render checkboxes only when `pickupMethod === "Van"`.

- [x] **Step 4: Verify client GREEN**

Repeat the focused client command and require every test to pass.

### Task 2: Express and Sites Worker persistence

**Files:**
- Modify: `tests/server/students.test.js`
- Modify: `tests/sites-worker.test.mjs`
- Modify: `server/domain/profile.js`
- Modify: `worker/index.js`

**Interfaces:**
- Consumes: partial and full profile payloads containing the five Van weekday strings.
- Produces: returned and stored profiles that preserve every supplied Van weekday.

- [x] **Step 1: Write failing persistence tests**

Extend the existing atomic profile update tests to send `vanMonday: "需要"`, `vanWednesday: "需要"`, and `vanFriday: "需要"`, then assert the response and stored profile contain those exact values.

- [x] **Step 2: Verify persistence RED**

Run `npm test -- tests/server/students.test.js --testTimeout=20000 --maxWorkers=1` and `npm run test:sites`. Expect invalid-profile failures because the new keys are not allowed yet.

- [x] **Step 3: Extend both profile allowlists**

Add `vanMonday` through `vanFriday` to Express `PROFILE_FIELDS` and the Worker `PROFILE_FIELDS`. Keep the existing partial/full string validation unchanged.

- [x] **Step 4: Verify persistence GREEN**

Repeat both persistence test commands and require every test to pass.

### Task 3: Green label, browser flow, and release preparation

**Files:**
- Modify: `tests/client/roster.test.jsx`
- Modify: `tests/e2e/daycare.spec.js`
- Modify: `src/features/roster/studentProfileLabels.js`
- Modify: all test profile fixtures that mirror the complete profile contract.

**Interfaces:**
- Consumes: saved Van weekday values plus `vanDriver` and `vanHomeTime`.
- Produces: `Van载送 · <driver> · 周<days> · <time>`, falling back to `平日` when no Van weekdays are saved.

- [x] **Step 1: Write the failing label assertion**

Use a profile with Monday, Wednesday, and Friday selected and expect the exact green label `Van载送 · Uncle Kent · 周一、三、五 · 17:00`.

- [x] **Step 2: Verify label RED**

Run `npm test -- tests/client/roster.test.jsx --testTimeout=20000 --maxWorkers=1`. Expect the label to contain `平日` instead of the selected weekdays.

- [x] **Step 3: Implement summary and browser coverage**

Add Van field names to the weekday metadata, use the selected-day summary with `平日` fallback, and extend the MK Enrol browser flow to select and verify Van weekdays.

- [x] **Step 4: Run complete verification**

Run all unit tests, Sites Worker tests, the production build, desktop Chromium, mobile Chromium, and `git diff --check`.

- [ ] **Step 5: Save one release version**

Commit and push the exact verified source, package the matching build, and save one Sites version without publicly deploying until the user confirms.
