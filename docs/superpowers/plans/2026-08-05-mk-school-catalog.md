# MK School Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MK student profiles and enrolment show only 一校、二校、启智、姚贞暖 with the exact supplied Year 1–6 class lists and no classes for 姚贞暖 yet.

**Architecture:** Keep school catalogs in `src/domain/profileOptions.js` and select them by `branchCode`. Pass `branchCode` through the shared `StudentProfileFields` component so both profile editing and enrolment use the same rules without duplicating UI logic.

**Tech Stack:** React 19, Vitest, Testing Library, Playwright, Sites Worker build.

## Global Constraints

- MK selectable schools are exactly 一校、二校、启智、姚贞暖, in that order.
- MK classes exactly match the approved Year 1–6 lists.
- 姚贞暖 has no selectable class for any grade.
- MK does not offer 南益、民义、旺小、桥南、中华小学、中华中学.
- STP and WS retain their existing school catalog.
- Both `Y1`–`Y6` and `一年级`–`六年级` map to the matching year.
- Existing-student editing and Enrol must share the same catalog behavior.

---

### Task 1: Branch-aware school catalog

**Files:**
- Modify: `src/domain/profileOptions.js`
- Test: `tests/client/profile-options.test.jsx`

**Interfaces:**
- Produces: `schoolOptionsFor(branchCode: string): string[]`
- Produces: `schoolClassesFor(branchCode: string, school: string, grade: string): string[]`

- [ ] **Step 1: Write the failing catalog test**

Add assertions that:

```js
expect(schoolOptionsFor("MK")).toEqual(["一校", "二校", "启智", "姚贞暖"]);
expect(schoolOptionsFor("WS")).toEqual([
  "南益", "民义", "旺小", "桥南", "中华小学", "中华中学",
]);
expect(schoolClassesFor("MK", "一校", "Y3")).toEqual(["3J", "3B", "3M", "3U"]);
expect(schoolClassesFor("MK", "二校", "六年级")).toEqual(["6W", "6I", "6S"]);
expect(schoolClassesFor("MK", "启智", "Y1")).toEqual(["1C", "1J", "1B"]);
expect(schoolClassesFor("MK", "姚贞暖", "Y3")).toEqual([]);
expect(schoolClassesFor("MK", "南益", "Y3")).toEqual([]);
```

Also use a table-driven assertion covering every approved class list:

```js
const mkClasses = {
  一校: {
    Y1: ["1B", "1M", "1U"], Y2: ["2B", "2M", "2U"],
    Y3: ["3J", "3B", "3M", "3U"], Y4: ["4B", "4M", "4U"],
    Y5: ["5B", "5M", "5U"], Y6: ["6B", "6M", "6U"],
  },
  二校: {
    Y1: ["1W", "1I", "1S"], Y2: ["2W", "2I", "2S"],
    Y3: ["3W", "3I", "3S"], Y4: ["4W", "4I", "4S"],
    Y5: ["5W", "5I", "5S"], Y6: ["6W", "6I", "6S"],
  },
  启智: {
    Y1: ["1C", "1J", "1B"], Y2: ["2C", "2J", "2B"],
    Y3: ["3C", "3J", "3B"], Y4: ["4C", "4J", "4B"],
    Y5: ["5C", "5J", "5B"], Y6: ["6C", "6J", "6B"],
  },
};
for (const [school, grades] of Object.entries(mkClasses)) {
  for (const [grade, classes] of Object.entries(grades)) {
    expect(schoolClassesFor("MK", school, grade)).toEqual(classes);
  }
}
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- --run tests/client/profile-options.test.jsx`

Expected: FAIL because `schoolOptionsFor` does not exist and `schoolClassesFor` is not branch-aware.

- [ ] **Step 3: Implement the branch catalog**

In `src/domain/profileOptions.js`, retain the existing six schools as the default catalog, add:

```js
const MK_SCHOOL_OPTIONS = ["一校", "二校", "启智", "姚贞暖"];

const MK_SCHOOL_CLASSES = {
  一校: {
    1: ["1B", "1M", "1U"],
    2: ["2B", "2M", "2U"],
    3: ["3J", "3B", "3M", "3U"],
    4: ["4B", "4M", "4U"],
    5: ["5B", "5M", "5U"],
    6: ["6B", "6M", "6U"],
  },
  二校: Object.fromEntries([1, 2, 3, 4, 5, 6].map((year) => [
    String(year), [`${year}W`, `${year}I`, `${year}S`],
  ])),
  启智: Object.fromEntries([1, 2, 3, 4, 5, 6].map((year) => [
    String(year), [`${year}C`, `${year}J`, `${year}B`],
  ])),
};
```

Return a copy of the appropriate school list from `schoolOptionsFor`, and return the exact MK class array from `schoolClassesFor` before using the existing suffix logic for other branches.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npm test -- --run tests/client/profile-options.test.jsx`

Expected: all profile option tests pass.

### Task 2: Use the MK catalog in both student forms

**Files:**
- Modify: `src/features/students/StudentProfileFields.jsx`
- Modify: `src/features/students/ProfilePanel.jsx`
- Modify: `src/features/students/EnrolDialog.jsx`
- Test: `tests/client/profile-options.test.jsx`
- Test: `tests/client/student-lifecycle.test.jsx`
- Test: `tests/e2e/daycare.spec.js`

**Interfaces:**
- Consumes: `schoolOptionsFor(branchCode)` and `schoolClassesFor(branchCode, school, grade)`
- Changes: `StudentProfileFields` accepts required `branchCode`

- [ ] **Step 1: Write failing component tests**

Render an MK `ProfilePanel` and MK `EnrolDialog`. Assert both school selects contain only:

```js
["请选择学校", "一校", "二校", "启智", "姚贞暖"]
```

Select `一校` for an `Y3` student and assert the class select contains only:

```js
["请选择学校班级", "3J", "3B", "3M", "3U"]
```

Then select `姚贞暖` and assert the class select contains only `请选择学校班级` and has a blank value.

- [ ] **Step 2: Run both component tests and confirm RED**

Run: `npm test -- --run tests/client/profile-options.test.jsx tests/client/student-lifecycle.test.jsx`

Expected: FAIL because both forms still use the global six-school catalog.

- [ ] **Step 3: Pass branch context into shared fields**

Update `ProfilePanel` and `EnrolDialog` to pass `branchCode`. Update `StudentProfileFields` to derive:

```js
const schoolOptions = schoolOptionsFor(branchCode);
const schoolClasses = schoolClassesFor(branchCode, values.school, grade);
```

Use `schoolOptions` for normal choices and `ExistingOption`. Normalize an existing MK profile whose school is outside `schoolOptions` to blank `school` and `schoolClass` values before rendering, so the old six schools cannot appear as `现有资料`; its stored record remains unchanged until the teacher saves. Changing the school continues clearing `schoolClass`.

- [ ] **Step 4: Run focused component tests and confirm GREEN**

Run: `npm test -- --run tests/client/profile-options.test.jsx tests/client/student-lifecycle.test.jsx`

Expected: all focused tests pass.

- [ ] **Step 5: Add browser coverage**

In the existing MK enrol lifecycle browser test, assert old schools are absent, select 一校 and `3J`, then verify the saved profile contains:

```js
{ school: "一校", schoolClass: "3J" }
```

- [ ] **Step 6: Run full verification**

Run:

```bash
npm test
npm run test:sites
npm run build
npm run test:e2e
git diff --check
```

Expected: all checks pass, including both desktop and mobile browser projects.

- [ ] **Step 7: Commit and publish**

Commit the validated source, push the exact commit to the Sites source repository, package the build with the Sites helper, save one version, obtain explicit approval for the public deployment, deploy, and confirm the production health endpoint plus the new MK school labels in the served asset.
