# STP Aunty Airine Driver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Aunty Airine` to the STP Van driver selector without changing MK or WS choices.

**Architecture:** Extend the existing branch-specific driver option mapper with one STP-only array. Keep the shared form and existing `vanDriver` profile field unchanged.

**Tech Stack:** React 19, Vitest, Testing Library, Vite, Cloudflare Sites Worker.

## Global Constraints

- STP receives exactly one additional driver: `Aunty Airine`.
- MK and WS driver lists remain unchanged.
- No database or profile-contract changes.

---

### Task 1: Add and verify the STP driver

**Files:**
- Modify: `tests/client/profile-options.test.jsx`
- Modify: `src/domain/profileOptions.js`

**Interfaces:**
- Consumes: `vanDriverOptionsFor(branchCode)`.
- Produces: the ordered driver options used by existing profile and Enrol forms.

- [ ] Update the STP assertion to expect `[...sharedDrivers, "Aunty Airine"]`.
- [ ] Run `npx vitest run tests/client/profile-options.test.jsx` and confirm it fails because STP lacks the new driver.
- [ ] Add `const STP_VAN_DRIVER_OPTIONS = ["Aunty Airine"]` and return it only when `branchCode === "STP"`.
- [ ] Rerun the focused test and confirm it passes.
- [ ] Run the complete test, Worker, build, desktop, and mobile verification commands.
- [ ] Commit, push, save a Sites version, deploy, and poll until the public deployment succeeds.
