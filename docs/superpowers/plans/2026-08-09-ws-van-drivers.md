# WS Van Driver Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Uncle Liew`, `Uncle Chan`, and `Aunty Airine` to WS Van driver choices while preserving MK and STP behavior.

**Architecture:** Extend the existing branch-aware driver catalog with one private WS append array. The shared student profile component already consumes `vanDriverOptionsFor(branchCode)`, so both Profile and Enrol forms receive the change without API or database work.

**Tech Stack:** React 19, Vitest, Testing Library, Playwright, Vite, Cloudflare Workers/Sites.

## Global Constraints

- Append `Uncle Liew`, `Uncle Chan`, and `Aunty Airine` only for branch code `WS`, in that order.
- Preserve the existing eight shared choices and their order.
- Preserve the seven current MK-only choices and their order.
- Preserve historical non-catalog driver values through `ExistingOption`.
- Do not change STP choices.

---

### Task 1: WS-specific Van driver catalog

**Files:**
- Modify: `tests/client/profile-options.test.jsx`
- Modify: `src/domain/profileOptions.js`

**Interfaces:**
- Consumes: `vanDriverOptionsFor(branchCode): string[]`.
- Produces: WS-specific driver choices while retaining the established MK and STP results.

- [ ] **Step 1: Write the failing branch-isolation test**

Update the existing branch driver test so its literal expectations require:

```js
const wsDrivers = ["Uncle Liew", "Uncle Chan", "Aunty Airine"];
expect(wsOptions).toEqual(["请选择司机", ...sharedDrivers, ...wsDrivers]);
expect(stpOptions).toEqual(["请选择司机", ...sharedDrivers]);
```

Keep the current exact MK expectation unchanged.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/client/profile-options.test.jsx --testTimeout=20000 --maxWorkers=1`

Expected: FAIL because WS still returns only the shared driver list.

- [ ] **Step 3: Implement the minimal WS branch selector**

Add the exact private catalog:

```js
const WS_VAN_DRIVER_OPTIONS = [
  "Uncle Liew",
  "Uncle Chan",
  "Aunty Airine",
];
```

Extend `vanDriverOptionsFor` so `WS` returns the shared list followed by this catalog, `MK` retains its current list, and all other branches return only the shared list.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- tests/client/profile-options.test.jsx --testTimeout=20000 --maxWorkers=1`

Expected: all focused tests pass.

### Task 2: Browser coverage and release preparation

**Files:**
- Modify: `tests/e2e/daycare.spec.js`

**Interfaces:**
- Consumes: the WS Enrol `Van 司机` combobox and saved profile payload.
- Produces: desktop/mobile proof that WS offers and retains `Uncle Liew`.

- [ ] **Step 1: Extend a WS browser flow**

In an existing WS Enrol flow, assert all three new options exist, choose `Uncle Liew`, and verify the saved profile retains that exact driver value.

- [ ] **Step 2: Run complete verification**

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

- [ ] **Step 3: Commit, push, package, and save one Sites version**

Commit the exact verified source, push the feature branch and Sites source branch, package the exact build, and save one Sites version. Do not publicly deploy until explicit approval is received.
