# Student Profile Options Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the original fixed school, linked class, transport, Van, and weekday time controls in both existing-student profile editing and Enrol.

**Architecture:** Put catalogs and grade-to-class derivation in a pure domain module, and render all controls through one reusable `StudentProfileFields` component. Extend the normalized JSON profile contract with `vanDriver` and `vanHomeTime`; SQL schemas remain unchanged because the profile is JSON.

**Tech Stack:** React 19, Vitest, Testing Library, Playwright, Express/Zod, Cloudflare Worker/D1, Vite, OpenAI Sites.

## Global Constraints

- Fixed schools: 南益、民义、旺小、桥南、中华小学、中华中学.
- Stay choices: 不留校 (`""`), 3:30 PM (`15:30`), 4:00 PM (`16:00`), 5:00 PM (`17:00`).
- Transport choices: 家长 and Van; only Van shows driver and Van return-time controls.
- Drivers: Tong, Lam, Lim, Kent, Wong, Boon, Aunty Lily, Liew.
- Existing non-catalog values remain selectable as `现有资料` and are never silently erased.
- The profile contract contains exactly eleven string keys, including `vanDriver` and `vanHomeTime`.
- Existing one-tap profile navigation continues focusing the school control.
- No SQL or D1 migration and no new dependency.

---

### Task 1: Profile catalogs and reusable controlled fields

**Files:**
- Create: `src/domain/profileOptions.js`
- Create: `src/features/students/StudentProfileFields.jsx`
- Create: `tests/client/profile-options.test.jsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Produces: `SCHOOL_OPTIONS`, `STAY_TIME_OPTIONS`, `PICKUP_METHOD_OPTIONS`, `VAN_DRIVER_OPTIONS`, `schoolClassesFor(school, grade)`.
- Produces: `<StudentProfileFields grade values disabled onChange fieldTestId />`, where `onChange(field, value)` updates one profile string.

- [ ] **Step 1: Write pure catalog and grade-linkage tests**

Assert literal results including:

```js
expect(schoolClassesFor("南益", "Y3")).toEqual([
  "3K", "3H", "3B", "3M", "3U", "3J", "3C",
]);
expect(schoolClassesFor("旺小", "三年级")).toEqual([
  "3坚", "3持", "3传", "3承", "3延", "3续",
]);
expect(schoolClassesFor("中华中学", "F2")[0]).toBe("F2S");
expect(schoolClassesFor("中华中学", "Y2")).toEqual([]);
```

- [ ] **Step 2: Write component tests for every restored choice**

Render a Y3 profile and assert the school select has the exact six schools, selecting 南益 reveals the seven `3*` classes and clears an old class, both time fields use `type="time"`, Van reveals the eight drivers, and all five weekday selects expose the four fixed stay choices. Rerender with non-catalog current values and assert each remains present with `现有资料`.

- [ ] **Step 3: Run tests and verify RED**

Run: `npm test -- --run tests/client/profile-options.test.jsx`

Expected: FAIL because `profileOptions.js` and `StudentProfileFields.jsx` do not exist.

- [ ] **Step 4: Implement the catalogs and grade parser**

Implement `schoolClassesFor` with `Y1`-`Y6`, `F1`-`F5`, and Chinese primary-grade mappings. Use the original suffix arrays verbatim and return an empty array for kindergarten or a school/track mismatch.

- [ ] **Step 5: Implement `StudentProfileFields`**

Render controlled `<select>` and `<input type="time">` elements. On school change call:

```js
onChange("school", nextSchool);
onChange("schoolClass", "");
```

Show `vanDriver` and `vanHomeTime` only when `pickupMethod === "Van"`. Append non-catalog current values as disabled-safe `现有资料` options. Keep Van values in state when transport changes to 家长.

- [ ] **Step 6: Add responsive styles and verify GREEN**

Style the standard profile grid and five-column stay grid, collapsing both to one column/two columns at the existing mobile breakpoint. Run the focused test and expect PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/profileOptions.js src/features/students/StudentProfileFields.jsx src/styles/app.css tests/client/profile-options.test.jsx
git commit -m "feat: restore profile selection controls"
```

### Task 2: Integrate both profile workflows and extend the JSON contract

**Files:**
- Modify: `src/domain/profile.js`
- Modify: `src/features/students/ProfilePanel.jsx`
- Modify: `src/features/students/EnrolDialog.jsx`
- Modify: `server/domain/profile.js`
- Modify: `worker/index.js`
- Modify: `tests/client/profile-search.test.jsx`
- Modify: `tests/client/student-lifecycle.test.jsx`
- Modify: `tests/server/students.test.js`
- Modify: `tests/sites-worker.test.mjs`

**Interfaces:**
- Consumes: `StudentProfileFields` from Task 1.
- Produces: normalized eleven-key profiles with `vanDriver` and `vanHomeTime` in both Express and Sites runtimes.

- [ ] **Step 1: Write failing integration and contract tests**

Update profile fixtures to include:

```js
vanDriver: "Tong",
vanHomeTime: "17:30",
```

Assert `ProfilePanel` and `EnrolDialog` both render controlled school selection, and that save/enrol requests contain the same eleven literal keys. Add server and Sites cases that accept both new fields and reject an unknown twelfth field.

- [ ] **Step 2: Run focused integration tests and verify RED**

Run: `npm test -- --run tests/client/profile-search.test.jsx tests/client/student-lifecycle.test.jsx tests/server/students.test.js`

Expected: FAIL because the two fields are absent and the forms still render generic inputs.

- [ ] **Step 3: Extend and normalize the profile contract**

Add `vanDriver` and `vanHomeTime` to the client, Express, and Worker profile-field lists. Update `EMPTY_PROFILE` and `normalizeProfile` so missing keys become empty strings while all existing fields keep their current values.

- [ ] **Step 4: Replace generic field maps with the shared component**

Pass the selected student's grade from `ProfilePanel`, and the enrolment grade from `EnrolDialog`. Route component changes through their existing state setters. Preserve disabled/saving behavior, explicit save buttons, optimistic locking, and one-tap focus.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the focused client/server command from Step 2 and `npm run test:sites`.

Expected: every modified contract and workflow test passes.

- [ ] **Step 6: Commit**

```bash
git add src/domain/profile.js src/features/students/ProfilePanel.jsx src/features/students/EnrolDialog.jsx server/domain/profile.js worker/index.js tests/client/profile-search.test.jsx tests/client/student-lifecycle.test.jsx tests/server/students.test.js tests/sites-worker.test.mjs
git commit -m "feat: link schools classes and profile times"
```

### Task 3: Browser verification, production build, and release

**Files:**
- Modify: `tests/e2e/daycare.spec.js`

**Interfaces:**
- Consumes: the completed eleven-field profile UI and API contract.
- Produces: desktop/mobile browser coverage and a deployable Sites archive.

- [ ] **Step 1: Add a browser workflow test**

Search one known Y-grade student, tap `填写资料`, choose 南益, assert a grade-matched class becomes selectable, set a home time, choose Van, choose Tong and a Van return time, choose one weekday stay time, and save. Assert the saved confirmation appears. Run in the existing desktop and mobile projects.

- [ ] **Step 2: Run full verification**

Run: `npm test -- --maxWorkers=1`

Run: `npm run test:sites`

Run: `npm run test:e2e`

Run: `npm run build`

Expected: all suites pass; Sites build contains `dist/client/index.html`, `dist/server/index.js`, hosting metadata, and the existing D1 migrations.

- [ ] **Step 3: Commit and publish**

```bash
git add tests/e2e/daycare.spec.js docs/superpowers/plans/2026-08-02-student-profile-options.md
git commit -m "test: verify restored profile choices"
```

Push the exact clean HEAD, package the validated build, save one Sites version, deploy it to the existing public site, and poll until production reports `succeeded`.
