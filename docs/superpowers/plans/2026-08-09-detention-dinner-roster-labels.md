# Detention and Dinner Roster Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show saved detention items and every dinner-requiring student directly beneath the student name.

**Architecture:** Extend the existing pure `studentProfileLabels(profile)` formatter. Parse the existing detention string into ordered display values and derive dinner visibility from both the global flag and active weekday values, preserving the current label rendering component and profile contract.

**Tech Stack:** React 19, Vitest, Testing Library, Playwright, Vite, Cloudflare Sites Worker.

## Global Constraints

- No database or profile-field changes.
- Detention labels must support old single values and new `|`-delimited values.
- Dinner labels must support `小`, `大`, and legacy `需要` weekday values.
- Labels must remain visible and wrapped on phone screens.

---

### Task 1: Reproduce missing roster labels

**Files:**
- Modify: `tests/client/roster.test.jsx`

**Interfaces:**
- Consumes: profiles passed to `RosterScreen`.
- Produces: assertions for `留堂事项` and `需要晚餐` labels.

- [ ] Add a failing assertion for `留堂事项 · 听写留堂、功课留堂` with class `profile-label--detention`.
- [ ] Add a failing test proving `dinnerMonday: "小"` displays `需要晚餐 · 小：周一` even when `dinnerRequired` is blank.
- [ ] Run `npx vitest run tests/client/roster.test.jsx` and confirm both failures describe the missing behavior.

### Task 2: Implement the label rules

**Files:**
- Modify: `src/features/roster/studentProfileLabels.js`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `profile.detentionType`, `profile.dinnerRequired`, and five weekday dinner fields.
- Produces: existing label objects `{ kind, icon, text, ariaLabel }`.

- [ ] Parse detention values with `String(value || "").split("|")`, filter to the three supported items, and render one `detention` label with icon `堂`.
- [ ] Treat any weekday value in `小`, `大`, or `需要` as dinner-required in addition to the global flag.
- [ ] Change the dinner title to `需要晚餐` and add the purple detention label style alongside existing note styles.
- [ ] Run the focused roster test and confirm all cases pass.

### Task 3: Validate and publish

**Files:**
- Modify only if verification exposes a regression in the files above.

**Interfaces:**
- Consumes: completed label formatter and styles.
- Produces: validated and deployed production version.

- [ ] Run `npm test -- --fileParallelism=false`.
- [ ] Run `npm run test:sites`.
- [ ] Run `npm run build`.
- [ ] Run desktop and mobile Playwright projects.
- [ ] Run `git diff --check`, commit, push, save a Sites version, deploy it, and poll until `succeeded`.
