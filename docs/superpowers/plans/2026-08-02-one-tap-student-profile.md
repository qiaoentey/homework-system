# One-Tap Student Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher open an unlocked profile form for the correct student with one obvious tap from that student's card.

**Architecture:** Keep the existing shared `ProfilePanel` and selection state. Add a dedicated card action that uses the existing selection callback, then have `RosterScreen` scroll the panel into view and focus its first enabled input after the selection render completes.

**Tech Stack:** React 18, Vitest, Testing Library, Playwright, CSS, Vite, OpenAI Sites.

## Global Constraints

- The visible shortcut label is `填写资料` and its accessible name contains the student's name.
- Attendance buttons retain their current behavior and never trigger navigation.
- Selecting a student by either the name or the new shortcut uses the same scroll-and-focus behavior.
- Saving remains explicit through `保存学生资料`.
- No new dependency is added.

---

### Task 1: One-tap profile shortcut and navigation

**Files:**
- Modify: `tests/client/profile-search.test.jsx`
- Modify: `tests/e2e/daycare.spec.js`
- Modify: `src/features/roster/StudentCard.jsx`
- Modify: `src/features/roster/RosterScreen.jsx`
- Modify: `src/features/students/ProfilePanel.jsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `StudentCard.onSelect(studentId: string)` and the existing `selectedStudentId` state.
- Produces: a visible card button with accessible name `填写 <student name> 资料`; `ProfilePanel.panelRef` receives a React ref for the section element.

- [x] **Step 1: Write the failing component test**

Add a test that loads `HAYDEN CHIN`, verifies the form starts disabled, taps `填写 HAYDEN CHIN 资料`, and then asserts that the profile heading is `HAYDEN CHIN`, the `学校` input is enabled and focused, and `scrollIntoView({ behavior: "smooth", block: "start" })` was called on the panel.

- [x] **Step 2: Write the failing mobile/desktop E2E test**

Add a Playwright test that enters a populated teacher group, taps the first `填写资料` shortcut by accessible name, and verifies the profile heading and first input are visible, enabled, and focused. The existing two Playwright projects cover desktop and touch-sized mobile viewports.

- [x] **Step 3: Run the focused tests and verify RED**

Run: `npm test -- --run tests/client/profile-search.test.jsx`

Expected: FAIL because the `填写 <student> 资料` button does not exist.

- [x] **Step 4: Add the card shortcut**

In `StudentCard.jsx`, add a `填写资料` button in a grouped footer action area. Give it `aria-label={`填写 ${student.name} 资料`}` and call `onSelect(student.id)`.

- [x] **Step 5: Add post-selection navigation**

In `RosterScreen.jsx`, keep a `profilePanelRef` and a navigation request counter. Every `selectStudent(studentId)` call updates both selection and the counter. In an effect that runs after rendering, call `scrollIntoView({ behavior: "smooth", block: "start" })` and focus `input:not(:disabled)` inside the panel. Pass the ref to `ProfilePanel`, which attaches it to its root section.

- [x] **Step 6: Style the shortcut for clear touch use**

In `app.css`, group the footer buttons with a flex container and give the profile shortcut a blue background, white text, a minimum 40px height, and a padded touch target. Preserve the attendance save-state area at the opposite side of the footer.

- [x] **Step 7: Run focused tests and verify GREEN**

Run: `npm test -- --run tests/client/profile-search.test.jsx`

Expected: PASS with the correct student selected, panel scrolled, and first input focused.

- [x] **Step 8: Run full verification**

Run: `npm test -- --maxWorkers=1`

Run: `npm run test:sites`

Run: `npm run test:e2e`

Run: `npm run build`

Expected: all suites pass; `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json` exist.

- [ ] **Step 9: Commit**

```bash
git add tests/client/profile-search.test.jsx tests/e2e/daycare.spec.js src/features/roster/StudentCard.jsx src/features/roster/RosterScreen.jsx src/features/students/ProfilePanel.jsx src/styles/app.css docs/superpowers/plans/2026-08-02-one-tap-student-profile.md
git commit -m "feat: simplify student profile editing"
```
