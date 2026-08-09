# MK School-Specific Stay Times Design

## Goal

Make the `特别留校放学时间` choices match the selected MK school without changing WS, STP, or unrelated MK schools.

## Behaviour

- MK `二校` shows `不留校`, `3:20 PM`, `4:00 PM`, and `5:00 PM`. Its previous `3:30 PM` choice is replaced by `3:20 PM`.
- MK `启智` shows `不留校`, `2:00 PM`, `3:30 PM`, `4:00 PM`, and `5:00 PM`.
- MK `一校` and `姚贞暖`, plus all WS and STP schools, keep the existing choices: `不留校`, `3:30 PM`, `4:00 PM`, and `5:00 PM`.
- Previously saved values that are not in the current school's choices remain visible as `（现有资料）` so changing a school cannot silently erase student data.

## Architecture

Add one domain helper that returns stay-time options from `branchCode` and `school`. `StudentProfileFields` consumes that helper for all five weekday selectors. No database or API change is required because profiles already store time strings.

## Verification

Add UI tests for MK `二校`, MK `启智`, and non-MK isolation, then run the complete unit, Sites Worker, build, desktop, and mobile suites.
