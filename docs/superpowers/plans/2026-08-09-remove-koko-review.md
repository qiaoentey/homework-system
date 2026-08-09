# Remove KOKO and Review Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove KOKO and review from the operational attendance UI and publish the complete pending release.

**Architecture:** Remove both codes from client and server write allowlists, remove the KOKO summary tile, preserve historical rows, and deploy one fully verified Sites version.

**Tech Stack:** React, Express, Cloudflare Worker/D1, Vitest, Node test runner, Playwright, Sites

## Global Constraints

- Keep only 到、缺席、冲、餐、功、补 in the daily action grid.
- Preserve historical `koko` and `review` records.
- Remove the KOKO summary tile without changing other summary calculations.

---

### Task 1: Tests and implementation

**Files:**
- Modify: `tests/client/roster.test.jsx`
- Modify: `tests/e2e/daycare.spec.js`
- Modify: `tests/server/attendance.test.js`
- Modify: `tests/sites-worker.test.mjs`
- Modify: `src/domain/attendance.js`
- Modify: `src/features/dashboard/SummaryBar.jsx`
- Modify: `server/domain/attendance.js`
- Modify: `worker/index.js`

**Interfaces:**
- Consumes: attendance event codes.
- Produces: six action buttons and five summary tiles.

- [x] **Step 1: Write failing UI and API tests**
- [x] **Step 2: Verify failures show extra controls and accepted writes**
- [x] **Step 3: Remove the two action codes and KOKO summary item**
- [x] **Step 4: Verify focused tests pass**

### Task 2: Publish

**Files:**
- Modify: final source and packaged build only.

**Interfaces:**
- Consumes: exact validated branch head.
- Produces: one successful public Sites deployment.

- [x] **Step 1: Run unit, Worker, build, desktop, mobile, and diff checks**
- [ ] **Step 2: Commit and push exact source**
- [ ] **Step 3: Save and publicly deploy one version**
- [ ] **Step 4: Poll deployment to success and verify the production URL**
