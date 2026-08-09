# Multi-Detention and Dinner Size Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow teachers to select both supported detention types and record a large or small dinner portion for each weekday without losing old profile data.

**Architecture:** Keep the existing profile JSON contract and reuse `detentionType` with a stable `|`-delimited representation. Add small parsing/toggling helpers beside the profile form, retain legacy dinner values as explicit existing-data options, and extend the roster-label formatter to group weekdays by dinner portion.

**Tech Stack:** React 19, Testing Library, Vitest, Playwright, Vite, Cloudflare Sites Worker.

## Global Constraints

- `听写留堂` and `功课留堂` may be selected together.
- `不可以留堂` is mutually exclusive with the other detention choices.
- Weekday dinner choices are exactly `不需要`, `小`, and `大` for new edits.
- Existing weekday value `需要` remains visible as `需要（未选大小）` until a teacher changes it.
- No database schema or profile-field additions.
- Existing enrolment, profile saving, desktop, and mobile flows must remain functional.

---

### Task 1: Multi-select detention and dinner-size profile controls

**Files:**
- Modify: `tests/client/profile-options.test.jsx`
- Modify: `src/features/students/StudentProfileFields.jsx`

**Interfaces:**
- Consumes: `values.detentionType`, `values.dinnerRequired`, and `values.dinnerMonday` through `values.dinnerFriday`.
- Produces: checkbox changes through `onChange("detentionType", serialized)` and dinner changes through the existing weekday fields.

- [ ] **Step 1: Write failing component tests**

Add tests that render `ProfilePanel`, assert that detention is three checkboxes rather than a combobox, select `听写留堂` and `功课留堂` together, and verify the saved profile contains `听写留堂|功课留堂`. Add assertions that selecting `不可以留堂` clears the other two. Update the dinner test to expect weekday choices `不需要`, `小`, `大`, and a legacy `需要（未选大小）` option only when the saved value is `需要`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/client/profile-options.test.jsx`

Expected: FAIL because detention is still a single combobox and dinner weekdays still offer `需要` instead of `小` and `大`.

- [ ] **Step 3: Implement minimal form behavior**

Add these local helpers and checkbox rules in `StudentProfileFields.jsx`:

```js
const DETENTION_OPTIONS = ["听写留堂", "功课留堂", "不可以留堂"];

function parseDetentionTypes(value) {
  return new Set(String(value || "").split("|").filter((item) => DETENTION_OPTIONS.includes(item)));
}

function serializeDetentionTypes(types) {
  return DETENTION_OPTIONS.filter((item) => types.has(item)).join("|");
}
```

Render three checkboxes. When `不可以留堂` is checked, save only that value. When either other checkbox is checked, remove `不可以留堂` before serializing. Render new dinner options and inject `<option value="需要">需要（未选大小）</option>` only when the current weekday value is `需要`.

- [ ] **Step 4: Run focused test and verify GREEN**

Run: `npx vitest run tests/client/profile-options.test.jsx`

Expected: all tests pass.

- [ ] **Step 5: Commit the independently working form change**

```bash
git add tests/client/profile-options.test.jsx src/features/students/StudentProfileFields.jsx
git commit -m "feat: add multi-select detention and dinner sizes"
```

### Task 2: Dinner-size roster labels and fixture compatibility

**Files:**
- Modify: `tests/client/roster.test.jsx`
- Modify: `src/features/roster/studentProfileLabels.js`
- Modify: `tests/client/student-lifecycle.test.jsx`
- Modify: `tests/client/profile-search.test.jsx`
- Modify: `tests/e2e/daycare.spec.js`

**Interfaces:**
- Consumes: weekday dinner values `不需要`, `小`, `大`, or legacy `需要`.
- Produces: the existing `{ kind, icon, text, ariaLabel }` dinner label with grouped size details.

- [ ] **Step 1: Write a failing roster-label test**

Use a profile with `dinnerMonday: "小"`, `dinnerTuesday: "大"`, `dinnerWednesday: "小"`, and `dinnerFriday: "需要"`. Assert the label text is `晚餐 · 小：周一、三 · 大：周二 · 未选大小：周五`.

- [ ] **Step 2: Run the roster test and verify RED**

Run: `npx vitest run tests/client/roster.test.jsx`

Expected: FAIL because the current label only groups weekdays whose value is `需要`.

- [ ] **Step 3: Implement grouped dinner summaries**

Add a formatter in `studentProfileLabels.js` that iterates `WEEKDAYS`, groups `小`, `大`, and legacy `需要`, and returns details in this fixed order:

```js
[
  ["小", "小"],
  ["大", "大"],
  ["需要", "未选大小"],
]
```

Each populated group becomes `${label}：周${days.join("、")}`. Use these details in the existing red dinner label.

- [ ] **Step 4: Update shared test fixtures to valid current values**

Change representative weekday dinner values in client and browser fixtures from `需要` to `小` or `大`, while retaining one explicit legacy test for `需要`. Update detention fixtures containing two selections to use `听写留堂|功课留堂`.

- [ ] **Step 5: Run client tests and verify GREEN**

Run: `npx vitest run tests/client/roster.test.jsx tests/client/student-lifecycle.test.jsx tests/client/profile-search.test.jsx`

Expected: all tests pass.

- [ ] **Step 6: Commit the label and compatibility change**

```bash
git add tests/client/roster.test.jsx tests/client/student-lifecycle.test.jsx tests/client/profile-search.test.jsx tests/e2e/daycare.spec.js src/features/roster/studentProfileLabels.js
git commit -m "feat: show dinner portions on student labels"
```

### Task 3: Full validation and public deployment

**Files:**
- Modify only if a verification failure exposes a regression in the files already listed.

**Interfaces:**
- Consumes: the completed profile controls and roster labels.
- Produces: a validated production build and published Sites version.

- [ ] **Step 1: Run complete application tests**

Run: `npm test`

Expected: all Vitest files and tests pass with zero failures.

- [ ] **Step 2: Run the Sites Worker contract tests**

Run: `npm run test:sites`

Expected: all Node test cases pass, proving profile persistence remains compatible.

- [ ] **Step 3: Build the deployment artifact**

Run: `npm run build`

Expected: Vite client and Worker builds complete, and the prepared Sites output contains `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

- [ ] **Step 4: Run desktop and mobile browser suites**

Run: `npm run test:e2e -- --project=chromium`

Run: `npm run test:e2e -- --project=mobile-chromium`

Expected: both projects pass with zero failures.

- [ ] **Step 5: Check the working diff**

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 6: Publish the validated Sites version and verify deployment status**

Save a new Sites version from the current build, deploy it to the existing public environment, and poll until the deployment reports `succeeded`.
