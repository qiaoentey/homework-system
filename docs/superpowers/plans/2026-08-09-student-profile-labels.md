# Student Profile Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display saved school, transport, homework-class, dinner, and late-stay details beside each student name with the requested color-coded labels.

**Architecture:** Add a focused formatter that converts an existing student profile into display-ready label models, then render those models in `StudentCard`. Keep profile data storage and APIs unchanged. CSS controls the requested colors and responsive wrapping.

**Tech Stack:** React 19, CSS, Vitest, Testing Library, Playwright, Vite, Cloudflare Workers/Sites.

## Global Constraints

- Read only existing student profile fields; do not add a database migration or API field.
- Preserve current pickup summary, attendance buttons, profile editing, and save behavior.
- Render only saved information; never invent a dinner time or missing schedule.
- Van is green, homework class orange, dinner red, and late stay yellow.
- Labels must wrap cleanly on mobile.

---

### Task 1: Profile label formatting and rendering

**Files:**
- Create: `src/features/roster/studentProfileLabels.js`
- Modify: `src/features/roster/StudentCard.jsx`
- Test: `tests/client/roster.test.jsx`

**Interfaces:**
- Consumes: the existing normalized `student.profile` object.
- Produces: `studentSchoolSummary(profile): string` and `studentProfileLabels(profile): Array<{ kind: string, icon: string, text: string, ariaLabel: string }>`.

- [x] **Step 1: Write the failing roster tests**

Add a roster response with school `启智`, class `1J`, Van driver `Uncle Kent`, Van time `17:00`, homework days Monday/Wednesday/Friday from `14:00` to `18:00`, Monday/Wednesday dinner, and late-stay times. Assert the school summary and exact four accessible label texts. Add a partial-profile case that omits unsaved label kinds and missing details.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/client/roster.test.jsx --testTimeout=20000 --maxWorkers=1`

Expected: FAIL because the school summary and profile labels are not rendered.

- [x] **Step 3: Implement the minimal formatter and card markup**

Create weekday field maps with literal compact Chinese day labels. Format Van, homework-class, dinner, and late-stay details according to the design. Render the school summary inside the existing identity button and render an accessible label list immediately below it, using `profile-label--<kind>` classes and an `aria-label` for each complete label.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- tests/client/roster.test.jsx --testTimeout=20000 --maxWorkers=1`

Expected: PASS.

### Task 2: Requested colors and mobile layout

**Files:**
- Modify: `src/styles/app.css`
- Test: `tests/client/roster.test.jsx`

**Interfaces:**
- Consumes: `student-card__school`, `student-card__labels`, `profile-label`, and modifier classes from Task 1.
- Produces: wrapping, readable profile labels with distinct requested colors.

- [x] **Step 1: Add semantic color-class expectations to the failing test**

Assert that each accessible label uses the correct modifier: `profile-label--van`, `profile-label--homework`, `profile-label--dinner`, and `profile-label--stay`.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/client/roster.test.jsx --testTimeout=20000 --maxWorkers=1`

Expected: FAIL if any label kind is missing or mapped to the wrong visual class.

- [x] **Step 3: Add responsive label styles**

Define shared pill layout, CSS text icons, green/orange/red/yellow modifier colors, label wrapping, and small-screen spacing. Replace the broad `.student-card__identity span` selector with explicit grade and school selectors so label spans keep their own colors.

- [x] **Step 4: Verify tests and production build**

Run: `npm test -- --testTimeout=20000 --maxWorkers=1`

Run: `npm run test:sites`

Run: `npm run build`

Expected: all commands exit successfully with zero failed tests.

### Task 3: End-to-end verification and version preparation

**Files:**
- Modify: `tests/e2e/daycare.spec.js`

**Interfaces:**
- Consumes: a student fixture containing all requested profile fields.
- Produces: desktop and mobile proof that labels render after profile data loads.

- [x] **Step 1: Add end-to-end label assertions before implementation is considered complete**

Assert the school summary and each label's accessible name for the existing fixture after roster load or enrolment.

- [x] **Step 2: Run desktop and mobile Playwright verification**

Run: `npx playwright test --project=desktop-chromium --reporter=dot`

Run: `npx playwright test --project=mobile-chromium --reporter=dot`

Expected: both projects pass.

- [ ] **Step 3: Commit, push, package, and save one Sites version**

Commit the exact verified source, push `codex/daycare-optimized` and the configured Sites source branch, package the build, and save one Sites version using the pushed commit SHA. Do not publicly deploy without explicit approval for that saved version.
