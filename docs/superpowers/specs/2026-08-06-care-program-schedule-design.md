# Student Care Program Schedule Design

## Goal

Make roll call safer and student setup simpler by removing the visible `清除今日` action and adding each student's care-program schedule to the existing student profile.

## Chosen approach

Use conditional fields inside the shared student-profile form. This is the shortest teacher workflow because existing-student editing and Enrol use the same form, and no separate schedule page or dialog is required.

Two alternatives were considered and rejected:

- A separate schedule dialog adds another open/save step for teachers.
- Reusing `特别留校放学时间` cannot represent arrival time and would mix two different meanings.

## Profile experience

- Add a required-choice-style field labelled `学生类型` with blank, `Full Daycare`, and `功课班` choices. Existing students start blank until a teacher updates them; saving remains possible while blank so old records are not blocked.
- When `功课班` is selected, show:
  - `来校时间`, using a native time picker.
  - `回家时间`, using a native time picker.
  - `星期几有来`, with one checkbox each for 星期一 through 星期五.
- The weekday checkboxes store `有来` when selected and an empty string when not selected.
- When `Full Daycare` or blank is selected, hide and clear all homework-class time and weekday fields so stale hidden data is not saved.
- The shared fields appear in both existing-student profile editing and Enrol.
- Existing school, transport, dinner, and special-stay fields remain unchanged.

## Data contract

Add these string fields to the existing profile JSON contract:

- `careProgram`
- `homeworkArrivalTime`
- `homeworkDepartureTime`
- `homeworkMonday`
- `homeworkTuesday`
- `homeworkWednesday`
- `homeworkThursday`
- `homeworkFriday`

No database table migration is needed because profiles are already stored as JSON. Older profiles normalize missing fields to empty strings. The Express and Sites Worker profile allowlists must both accept the new fields so Enrol, profile updates, retries, and activity history preserve the exact payload.

## Roll-call change

- Remove the visible `清除今日` button from every student card.
- Remove the unused clear action from the client component chain.
- Keep the server attendance-clear endpoint intact for backwards compatibility and data maintenance; teachers can no longer trigger it from the roster screen.
- All point-marking buttons and saved attendance records remain unchanged.

## Error handling and compatibility

- Existing students with no new fields load normally with blank values.
- Failed profile saves continue to show the current retry message and do not overwrite another student's profile.
- Switching away from `功课班` clears its hidden fields immediately before saving.
- No attendance records are deleted by this change.

## Validation

- A student-card test proves `清除今日` is absent.
- Profile tests prove the new type selector controls visibility and clears hidden homework-class values.
- Enrol and profile-save tests prove the new fields are submitted and restored.
- Server and Sites Worker tests prove the expanded exact profile contract.
- Full client/server/Sites tests, production build, and desktop/mobile browser tests run before preparing the public release.
