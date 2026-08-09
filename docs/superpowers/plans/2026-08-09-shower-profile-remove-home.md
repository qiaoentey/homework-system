# Shower Profile and Remove Home Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the “回” attendance action and add a persisted shower requirement that appears below each student name.

**Architecture:** Remove `home` from client and server attendance write allowlists while preserving stored history. Extend the shared profile JSON contract with `showerRequired`, render one select in the shared profile form, and map either saved choice to a roster label.

**Tech Stack:** React, Express, PostgreSQL JSONB, Cloudflare Worker/D1 JSON, Vitest, Node test runner, Playwright, Sites

## Global Constraints

- Keep the daily “冲” attendance action.
- Do not delete historical `home` attendance rows.
- `showerRequired` accepts an empty string, `需要`, or `不需要` through the existing exact string profile contract.
- Display `洗澡 · 需要` or `洗澡 · 不需要` only when a choice is saved.

---

### Task 1: Attendance action removal

**Files:**
- Modify: `tests/client/roster.test.jsx`
- Modify: `tests/e2e/daycare.spec.js`
- Modify: `tests/server/attendance.test.js`
- Modify: `tests/sites-worker.test.mjs`
- Modify: `src/domain/attendance.js`
- Modify: `server/domain/attendance.js`
- Modify: `worker/index.js`

**Interfaces:**
- Consumes: attendance code strings from roster buttons and write routes.
- Produces: eight visible buttons with no `home` write action.

- [x] **Step 1: Write tests expecting no “回” button and a rejected `home` write**
- [x] **Step 2: Run focused tests and verify failures mention the extra button or accepted event**
- [x] **Step 3: Remove `home` from all three write allowlists**
- [x] **Step 4: Repeat the focused tests and require green results**

### Task 2: Shower profile persistence and label

**Files:**
- Modify: `tests/client/profile-options.test.jsx`
- Modify: `tests/client/student-lifecycle.test.jsx`
- Modify: `tests/client/profile-search.test.jsx`
- Modify: `tests/client/roster.test.jsx`
- Modify: `tests/server/students.test.js`
- Modify: `tests/sites-worker.test.mjs`
- Modify: `tests/e2e/daycare.spec.js`
- Modify: `src/domain/profile.js`
- Modify: `server/domain/profile.js`
- Modify: `worker/index.js`
- Modify: `src/features/students/StudentProfileFields.jsx`
- Modify: `src/features/roster/studentProfileLabels.js`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `profile.showerRequired: string`.
- Produces: accessible “洗澡” select plus a `profile-label--shower` roster label.

- [x] **Step 1: Write tests for exact options, create/update round trips, and both visible labels**
- [x] **Step 2: Run focused tests and verify missing field/control/label failures**
- [x] **Step 3: Add `showerRequired` to the shared contract, form, and label mapper**
- [x] **Step 4: Run focused tests and require green results**

### Task 3: Release verification

**Files:**
- Modify: complete test fixtures that mirror the exact profile contract.

**Interfaces:**
- Consumes: final source tree.
- Produces: one pushed commit and one saved Sites version, without public deployment.

- [x] **Step 1: Run all unit, Worker, build, desktop, mobile, and diff checks**
- [ ] **Step 2: Commit and push the exact validated source**
- [ ] **Step 3: Package and save one new Sites version for explicit public approval**
