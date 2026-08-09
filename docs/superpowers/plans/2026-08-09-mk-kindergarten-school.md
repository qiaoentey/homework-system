# MK Kindergarten School Option Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `幼儿园` as an MK-only school whose class list is empty.

**Architecture:** Reuse `schoolOptionsFor` and the existing empty-result behavior of `schoolClassesFor`. No API or database change is necessary because school and class are already profile strings.

**Tech Stack:** React, Vitest, Testing Library, Playwright, Vite

## Global Constraints

- `幼儿园` appears only for MK.
- Selecting it must not require or invent a class.
- Existing student and attendance data must remain unchanged.

---

### Task 1: Add and verify the MK kindergarten school

**Files:**
- Modify: `tests/client/profile-options.test.jsx`
- Modify: `tests/client/student-lifecycle.test.jsx`
- Modify: `tests/e2e/daycare.spec.js`
- Modify: `src/domain/profileOptions.js`

**Interfaces:**
- Consumes: `schoolOptionsFor(branchCode)` and `schoolClassesFor(branchCode, school, grade)`.
- Produces: an MK school option `幼儿园` with an empty class list.

- [x] **Step 1: Write failing behaviour assertions**

Add `幼儿园` to the literal MK school lists in the existing profile, Enrol, and browser tests. Select it and assert the class selector contains only `请选择学校班级`.

- [x] **Step 2: Verify RED**

Run `npm test -- tests/client/profile-options.test.jsx tests/client/student-lifecycle.test.jsx --testTimeout=20000 --maxWorkers=1`. Expect exact-list failures because `幼儿园` is missing.

- [x] **Step 3: Add the minimal catalog entry**

Append `幼儿园` to `MK_SCHOOL_OPTIONS`. Do not add an entry to `MK_SCHOOL_CLASSES`, so the class lookup stays empty.

- [x] **Step 4: Verify GREEN and complete regressions**

Run the focused tests, complete unit and Sites Worker suites, production build, desktop and mobile Playwright suites, and `git diff --check`.

- [x] **Step 5: Save and publicly deploy the exact verified version**

Commit and push the verified source, package and save one Sites version, deploy that version using the user's explicit approval, poll until successful, and check the public health endpoint.
