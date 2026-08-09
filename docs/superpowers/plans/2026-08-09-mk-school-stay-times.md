# MK School-Specific Stay Times Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give MK 二校 a 3:20 PM stay option and MK 启智 a 2:00 PM stay option while preserving every unrelated school's choices.

**Architecture:** A pure `stayTimeOptionsFor(branchCode, school)` domain helper owns the school rules. The existing student profile component uses its return value for each weekday and retains the existing-value fallback.

**Tech Stack:** React, Vitest, Testing Library, Vite

## Global Constraints

- Do not change the stored profile schema or API contract.
- Do not expose MK-specific options to WS, STP, or unrelated MK schools.
- Preserve legacy saved times through the existing `（现有资料）` option.

---

### Task 1: School-specific stay-time choices

**Files:**
- Modify: `tests/client/profile-options.test.jsx`
- Modify: `src/domain/profileOptions.js`
- Modify: `src/features/students/StudentProfileFields.jsx`

**Interfaces:**
- Consumes: `branchCode`, `values.school`, and existing `[value, label]` stay option tuples.
- Produces: `stayTimeOptionsFor(branchCode, school): Array<[string, string]>`.

- [x] **Step 1: Write failing UI tests**

Add literal assertions that MK 二校 renders `不留校`, `3:20 PM`, `4:00 PM`, `5:00 PM`; MK 启智 renders `不留校`, `2:00 PM`, `3:30 PM`, `4:00 PM`, `5:00 PM`; and WS remains unchanged.

- [x] **Step 2: Verify RED**

Run `npm test -- tests/client/profile-options.test.jsx --testTimeout=20000 --maxWorkers=1`. Expect failures because the current global list has neither MK-specific branch.

- [x] **Step 3: Implement the minimal helper and consumer change**

Export `stayTimeOptionsFor` from `profileOptions.js`, return the two MK overrides, and otherwise return the existing standard list. Replace direct `STAY_TIME_OPTIONS` use in `StudentProfileFields` with the helper result.

- [x] **Step 4: Verify GREEN and regressions**

Run the focused client test, then the complete unit, Sites Worker, build, desktop Chromium, and mobile Chromium suites. Finish with `git diff --check`.

- [x] **Step 5: Save a release version**

Commit and push the exact verified source, package the matching build, and save one Sites version without publicly deploying until the user confirms.
