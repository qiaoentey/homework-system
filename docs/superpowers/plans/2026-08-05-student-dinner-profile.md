# Student Dinner Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a saved dinner requirement and conditional Monday-to-Friday dinner choices to student profiles and enrolment.

**Architecture:** Extend the existing profile JSON contract by six string fields, so no relational schema migration is needed. `StudentProfileFields` owns the conditional UI and emits field changes through its existing `onChange(field, value)` interface; Express and the Sites Worker share the same expanded field allowlist.

**Tech Stack:** React 19, Vitest/Testing Library, Express/Zod/PostgreSQL JSONB, Cloudflare Worker/D1 JSON text, Playwright.

## Global Constraints

- The control label is exactly `是否需要晚餐`.
- The overall and weekday choices use exactly `需要` and `不需要`; the overall control also allows an unselected legacy value.
- Weekday controls render only while `dinnerRequired === "需要"`.
- Selecting `需要` defaults any blank weekday to `不需要`.
- Selecting another overall value clears all five weekday values.
- Existing profiles without the six new fields normalize to empty strings.
- Reuse the current profile JSON and save buttons; do not add a database table or a second save operation.

---

### Task 1: Dinner profile UI and client contract

**Files:**
- Modify: `tests/client/profile-options.test.jsx`
- Modify: `tests/client/profile-search.test.jsx`
- Modify: `tests/client/student-lifecycle.test.jsx`
- Modify: `src/domain/profile.js`
- Modify: `src/features/students/StudentProfileFields.jsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `StudentProfileFields({ values, onChange, disabled, fieldTestId })` and `normalizeProfile(profile)`.
- Produces: the six fields `dinnerRequired`, `dinnerMonday`, `dinnerTuesday`, `dinnerWednesday`, `dinnerThursday`, and `dinnerFriday` in every normalized profile.

- [ ] **Step 1: Write the failing conditional-UI test**

Add a real `ProfilePanel` test that asserts the weekday dinner selects are absent initially, selects `需要`, verifies all five selects appear with `不需要` defaults, changes Monday to `需要`, then selects overall `不需要` and verifies the weekday selects disappear.

```jsx
fireEvent.change(screen.getByLabelText("是否需要晚餐"), {
  target: { value: "需要" },
});
expect(screen.getByLabelText("星期一晚餐")).toHaveValue("不需要");
fireEvent.change(screen.getByLabelText("是否需要晚餐"), {
  target: { value: "不需要" },
});
expect(screen.queryByLabelText("星期一晚餐")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- --run tests/client/profile-options.test.jsx`

Expected: FAIL because `是否需要晚餐` does not exist.

- [ ] **Step 3: Expand the client profile fields and render the controls**

Add the six fields to `PROFILE_FIELDS`. In `StudentProfileFields`, define a weekday field list and a `changeDinnerRequired` handler that emits the overall value and either defaults or clears all weekday fields. Render the conditional section between the basic grid and stay-time section.

```js
const DINNER_FIELDS = [
  ["dinnerMonday", "星期一晚餐"],
  ["dinnerTuesday", "星期二晚餐"],
  ["dinnerWednesday", "星期三晚餐"],
  ["dinnerThursday", "星期四晚餐"],
  ["dinnerFriday", "星期五晚餐"],
];
```

- [ ] **Step 4: Update save-contract fixtures and verify GREEN**

Update client fixture profiles and exact request expectations to include all six fields. Run:

`npm test -- --run tests/client/profile-options.test.jsx tests/client/profile-search.test.jsx tests/client/student-lifecycle.test.jsx`

Expected: all selected client tests pass.

---

### Task 2: Express and Sites Worker persistence contract

**Files:**
- Modify: `server/domain/profile.js`
- Modify: `worker/index.js`
- Modify: `tests/server/students.test.js`
- Modify: `tests/sites-worker.test.mjs`

**Interfaces:**
- Consumes: full and partial profile validation already built from `PROFILE_FIELDS`.
- Produces: API enrolment and profile updates that accept and persist all six dinner strings in PostgreSQL and D1.

- [ ] **Step 1: Write failing persistence assertions**

Extend the server profile-update test and Worker profile-update test with literal dinner values, including `dinnerRequired: "需要"`, Monday `需要`, and remaining days `不需要`. Assert the response, stored profile, and activity history preserve them.

- [ ] **Step 2: Run server and Worker tests and verify RED**

Run:

`npm test -- --run tests/server/students.test.js`

`npm run test:sites`

Expected: FAIL with invalid/omitted dinner fields because the server and Worker allowlists do not yet include them.

- [ ] **Step 3: Expand both API allowlists**

Append the same six field names to `server/domain/profile.js` and `worker/index.js`. Keep the existing string validation and JSON merge behavior.

- [ ] **Step 4: Verify GREEN**

Run the same server and Worker tests. Expected: all pass, including full enrolment payload equality and profile-update persistence.

---

### Task 3: End-to-end verification and publication

**Files:**
- Modify: `tests/e2e/daycare.spec.js`

**Interfaces:**
- Consumes: the existing Google-login test flow and profile save UI.
- Produces: browser evidence that desktop and mobile save and restore dinner choices.

- [ ] **Step 1: Add the browser workflow**

In the editable-profile test, select `需要`, set weekday values, save, and verify the success message. Reopen or query the saved student and verify the dinner profile values are present.

- [ ] **Step 2: Run focused and full verification**

Run:

`npm test -- --testTimeout=20000`

`npm run test:sites`

`npm run build`

`npm run test:e2e`

Expected: zero failures; the desktop and mobile projects both execute the dinner workflow.

- [ ] **Step 3: Commit and publish**

Commit the exact verified source, push the Sites source branch, package the successful build, save one version, deploy it to the site's existing access level, poll to success, and check `/api/health` on the unchanged live URL.
