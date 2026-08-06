# Attendance Button Order Implementation Plan

**Goal:** Place `缺席` directly after `到` without changing attendance behavior.

**Architecture:** Keep `StudentCard` rendering the shared `EVENT_BUTTONS` definition. Change only that definition's display order so every responsive layout receives the same result.

## Tasks

- [x] Add a DOM test asserting `到、缺席、冲、餐、功、补、复、回、KOKO`.
- [x] Run the focused test and confirm it fails on the previous order.
- [x] Move the existing `absent` entry directly after `arrive`.
- [x] Run focused and complete verification, including desktop and mobile.
- [ ] Save a new Sites version for public release.
