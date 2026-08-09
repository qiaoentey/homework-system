# MK Van Driver Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the seven requested Van drivers to MK profile and Enrol forms while keeping other branches unchanged.

**Architecture:** Extend the existing profile options module with one branch-aware selector and consume it in the shared profile fields component. No API or database changes are needed because the existing profile contract already stores arbitrary driver strings.

**Tech Stack:** React 19, Vitest, Testing Library, Playwright, Vite, Cloudflare Workers/Sites.

## Global Constraints

- Append the seven exact names only for branch code `MK`.
- Preserve the existing eight driver choices and their order.
- Preserve historical non-catalog driver values through `ExistingOption`.
- Do not change STP or WS driver choices.

---

### Task 1: Branch-specific Van driver catalog

**Files:**
- Modify: `src/domain/profileOptions.js`
- Modify: `src/features/students/StudentProfileFields.jsx`
- Test: `tests/client/profile-options.test.jsx`

**Interfaces:**
- Produces: `vanDriverOptionsFor(branchCode): string[]`.
- Consumes: `branchCode` already supplied to `StudentProfileFields`.

- [ ] **Step 1: Write failing MK and WS option tests**

Render the shared profile fields with Van selected. Assert the MK combobox contains the original eight drivers followed by `Mr Kent`, `Uncle Yeow`, `Uncle Sam`, `Uncle Leong`, `Uncle Ting`, `Uncle Tan`, and `Uncle Law`. Assert WS contains only the original eight.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/client/profile-options.test.jsx --testTimeout=20000 --maxWorkers=1`

Expected: FAIL because the MK list does not contain the seven new values.

- [ ] **Step 3: Implement the branch selector and component integration**

Keep `VAN_DRIVER_OPTIONS` as the shared base array, add a private MK append array, export `vanDriverOptionsFor`, and use its returned array for rendering and existing-value detection.

- [ ] **Step 4: Run focused and full verification**

Run: `npm test -- tests/client/profile-options.test.jsx --testTimeout=20000 --maxWorkers=1`

Run: `npm test -- --testTimeout=20000 --maxWorkers=1`

Run: `npm run test:sites`

Run: `npm run build`

Expected: every command exits successfully with zero failed tests.

### Task 2: Browser and Sites version preparation

**Files:**
- Modify: `tests/e2e/daycare.spec.js`

**Interfaces:**
- Consumes: the MK Enrol Van driver combobox.
- Produces: desktop and mobile proof that the MK form offers and saves one newly added driver.

- [ ] **Step 1: Update the existing MK Enrol flow to choose `Mr Kent`**

Assert the combobox contains all seven new values, select `Mr Kent`, and verify the saved profile retains `Mr Kent` through stop and restore.

- [ ] **Step 2: Run desktop and mobile Playwright**

Run: `npx playwright test --project=desktop-chromium --reporter=dot`

Run: `npx playwright test --project=mobile-chromium --reporter=dot`

Expected: both projects pass.

- [ ] **Step 3: Commit, push, package, and save one Sites version**

Commit the verified source, push the feature and Sites source branches, package the exact build, and save one Sites version. Wait for explicit public-release approval before deploying.

