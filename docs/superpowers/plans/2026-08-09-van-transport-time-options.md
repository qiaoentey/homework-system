# Van Transport Time Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put fixed Van transport-time choices beneath the weekday controls and display the saved time beneath each student name.

**Architecture:** Reuse `profile.vanHomeTime` and replace the free time input with a fixed select. Add one pure display formatter in the roster-label module so stored 24-hour values render as teacher-friendly 12-hour times.

**Tech Stack:** React 19, Vitest, Testing Library, Playwright, Vite, Cloudflare Sites Worker.

## Global Constraints

- Approved choices are `17:30`, `19:00`, and `20:45`, labelled `5:30 PM`, `7:00 PM`, and `8:45 PM`.
- The selector appears after the Van weekday controls.
- Existing non-catalog values remain selectable as existing data.
- No database or profile-field changes.

---

### Task 1: Van time form control

**Files:**
- Modify: `tests/client/profile-options.test.jsx`
- Modify: `src/features/students/StudentProfileFields.jsx`
- Modify: `src/domain/profile.js`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes and produces the existing `values.vanHomeTime` string through `onChange`.

- [ ] Change the component test to expect a `Van 载送时间` combobox after the weekday group with options `请选择时间`, `5:30 PM`, `7:00 PM`, `8:45 PM`.
- [ ] Add an assertion that a saved `17:00` value remains available as `17:00（现有资料）`.
- [ ] Run `npx vitest run tests/client/profile-options.test.jsx` and confirm failure because the current control is a free time input above weekdays.
- [ ] Replace the input with the fixed select after weekday controls, add `ExistingOption`, and update the field label to `Van 载送时间`.
- [ ] Rerun the focused test and confirm it passes.

### Task 2: Student-name time display

**Files:**
- Modify: `tests/client/roster.test.jsx`
- Modify: `src/features/roster/studentProfileLabels.js`
- Modify: `tests/client/student-lifecycle.test.jsx`
- Modify: `tests/client/profile-search.test.jsx`
- Modify: `tests/e2e/daycare.spec.js`

**Interfaces:**
- Consumes the existing `profile.vanHomeTime` or fallback `usualPickupTime`.
- Produces the existing Van label detail string in 12-hour display format.

- [ ] Change the roster test to expect `19:00` as `7:00 PM` and run it to verify RED.
- [ ] Add a formatter for `HH:MM` strings and use it in the Van label.
- [ ] Update profile labels and browser fixtures to the new form label and approved time values.
- [ ] Run the focused client tests and confirm GREEN.

### Task 3: Validate and publish

**Files:**
- Modify only if verification exposes a regression in the files above.

**Interfaces:**
- Consumes the completed profile control and roster label.
- Produces a validated production deployment.

- [ ] Run `npm test -- --fileParallelism=false` and `npm run test:sites`.
- [ ] Run `npm run build`.
- [ ] Run desktop and mobile Playwright projects.
- [ ] Run `git diff --check`, commit, push, save a Sites version, deploy, and poll until `succeeded`.
