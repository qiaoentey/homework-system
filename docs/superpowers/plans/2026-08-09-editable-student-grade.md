# Editable Student Grade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let teachers change an already-enrolled student's grade from the current profile form while preserving the same UUID and all linked history.

**Architecture:** Add controlled grade state to `ProfilePanel`, render a conditional grade selector in the shared profile fields, and send grade with the existing UUID-scoped profile PATCH. Extend both Express/Postgres and Sites Worker/D1 implementations to update grade and profile atomically under the current optimistic lock; no schema migration is required.

**Tech Stack:** React 19, Vitest, Testing Library, Express, Zod, PostgreSQL, Cloudflare Workers/D1, Playwright, Vite, Sites.

## Global Constraints

- Edit the selected student's existing row; never enrol a replacement student.
- Preserve UUID, branch, teacher group, status, profile, attendance, messages, and lifecycle history.
- Accept the known grade catalog: `K1`, `K2`, `K1+K2`, `F1`-`F6`, `Y1`-`Y6`, `幼儿班`, and `一年级`-`六年级`.
- Preserve an existing non-catalog grade as an `（现有资料）` choice.
- Clear `schoolClass` only when it is incompatible with the newly selected grade.
- Keep profile-only PATCH requests valid for older cached clients.
- Keep branch/group scope validation and `updatedAt` optimistic locking unchanged.

---

### Task 1: Editable grade in the current profile form

**Files:**
- Modify: `tests/client/profile-search.test.jsx`
- Modify: `src/domain/profileOptions.js`
- Modify: `src/features/students/StudentProfileFields.jsx`
- Modify: `src/features/students/ProfilePanel.jsx`
- Modify: `src/features/students/EnrolDialog.jsx`
- Modify: `src/features/students/StopDialog.jsx`
- Modify: `src/api/client.js`

**Interfaces:**
- Produces: `STUDENT_GRADE_OPTIONS: string[]` and an optional `onGradeChange(nextGrade)` prop on `StudentProfileFields`.
- Consumes: `rosterApi.saveProfile({ branchCode, groupCode, studentId, updatedAt, grade, profile })`.

- [x] **Step 1: Write a failing client behavior test**

Open an existing student's profile, assert `年级` is preselected as `Y3`, change it to `Y4`, and save. Require this literal request body and immediate card update:

```js
expect(JSON.parse(profileRequest.options.body)).toEqual({
  updatedAt: HAYDEN.updatedAt,
  grade: "Y4",
  profile: { ...PROFILE, schoolClass: "" },
});
expect(within(card).getByText("Y4", { exact: true })).toBeVisible();
```

Also assert the selector includes `F4`, `F5`, and `F6`, and that changing from `Y3` to `Y4` clears incompatible `3K` while preserving the school.

- [x] **Step 2: Run the client test and verify RED**

Run: `npm test -- tests/client/profile-search.test.jsx --testTimeout=20000 --maxWorkers=1`

Expected: FAIL because no editable grade selector exists and the client does not send `grade`.

- [x] **Step 3: Implement the minimal client flow**

Export the canonical catalog:

```js
export const STUDENT_GRADE_OPTIONS = [
  "K1", "K2", "K1+K2",
  "F1", "F2", "F3", "F4", "F5", "F6",
  "Y1", "Y2", "Y3", "Y4", "Y5", "Y6",
  "幼儿班", "一年级", "二年级", "三年级", "四年级", "五年级", "六年级",
];
```

Use it in Enrol, Stop, and the conditional profile grade selector. In `ProfilePanel`, initialize grade from the selected student, clear only an incompatible `schoolClass` using `schoolClassesFor`, and pass grade into `saveProfile`. Make `src/api/client.js` serialize `{ updatedAt, grade, profile }`.

- [x] **Step 4: Run the client test and verify GREEN**

Run: `npm test -- tests/client/profile-search.test.jsx --testTimeout=20000 --maxWorkers=1`

Expected: all profile-search tests pass.

### Task 2: Express/Postgres atomic grade update

**Files:**
- Modify: `tests/server/students.test.js`
- Modify: `server/routes/students.js`
- Modify: `server/repositories/students.js`

**Interfaces:**
- Consumes: `PATCH /api/students/:id/profile` body `{ updatedAt, grade?, profile? }`.
- Produces: the updated student row with a new `updatedAt` and a `profile_update` activity containing the supplied changes.

- [x] **Step 1: Write a failing Express API test**

Patch an existing student from `Y4` to `Y5` with one profile field, then assert:

```js
expect(response.body).toMatchObject({ id: student.id, grade: "Y5" });
expect(stored.rows[0]).toMatchObject({ id: student.id, grade: "Y5" });
expect(activity.rows[0].details).toEqual({
  grade: "Y5",
  profile: { school: "New School" },
});
```

Keep the stale `updatedAt` conflict assertion and add blank-grade rejection.

- [x] **Step 2: Run the server test and verify RED**

Run: `npm test -- tests/server/students.test.js --testTimeout=20000 --maxWorkers=1`

Expected: FAIL because the strict request schema rejects `grade`.

- [x] **Step 3: Implement schema and repository updates**

Make `grade` and `profile` optional individually but require at least one change. In one transaction, compute:

```js
const nextGrade = grade ?? student.grade;
const mergedProfile = profile ? { ...student.profile, ...profile } : student.profile;
```

Update `grade`, `profile`, and `updated_at` in the same SQL statement, then store only supplied fields in the existing `profile_update` details object.

- [x] **Step 4: Run the server test and verify GREEN**

Run: `npm test -- tests/server/students.test.js --testTimeout=20000 --maxWorkers=1`

Expected: all student API tests pass.

### Task 3: Sites Worker/D1 parity

**Files:**
- Modify: `tests/sites-worker.test.mjs`
- Modify: `worker/index.js`

**Interfaces:**
- Consumes: the same `{ updatedAt, grade?, profile? }` PATCH contract.
- Produces: one D1 batch that updates the scoped student and appends activity only when the optimistic update succeeds.

- [x] **Step 1: Write a failing Sites Worker test**

Update an existing student's grade, then query the roster and assert the same UUID has the new grade. Create attendance and a message before the update and assert both remain queryable afterward.

- [x] **Step 2: Run the Sites test and verify RED**

Run: `npm run test:sites`

Expected: FAIL because the Worker rejects the additional `grade` key.

- [x] **Step 3: Implement the D1 atomic update**

Validate optional non-empty `grade` and optional partial `profile`, requiring at least one. Bind the new or current grade and merged or current profile in one optimistic SQL update:

```sql
UPDATE students
SET grade = ?, profile = ?, updated_at = ?
WHERE id = ? AND branch_code = ? AND group_code = ? AND updated_at = ?
```

Keep the activity insert guarded by `WHERE changes() = 1`.

- [x] **Step 4: Run the Sites test and verify GREEN**

Run: `npm run test:sites`

Expected: all Sites Worker tests pass.

### Task 4: Browser proof and release preparation

**Files:**
- Modify: `tests/e2e/daycare.spec.js`

**Interfaces:**
- Consumes: an enrolled student's editable grade selector and the saved student response.
- Produces: desktop/mobile proof of grade editing on the same student.

- [x] **Step 1: Extend the existing enrol lifecycle browser test**

After enrolling and attaching attendance/message history, open the student's profile, change `Y3` to `Y4`, save, and assert the card plus API return the same UUID with grade `Y4`. Continue stop/restore using `Y4` and verify the previously saved attendance and message remain linked.

- [x] **Step 2: Run complete verification**

Run:

```bash
npm test -- --testTimeout=20000 --maxWorkers=1
npm run test:sites
npm run build
npx playwright test --project=desktop-chromium --reporter=dot
npx playwright test --project=mobile-chromium --reporter=dot
git diff --check
```

Expected: every command exits successfully with zero failed tests.

- [x] **Step 3: Commit, push, package, and save one Sites version**

Commit the exact verified source, push the existing feature branch and Sites source branch, package the exact build, and save one Sites version. Do not publicly deploy until explicit approval is received.
