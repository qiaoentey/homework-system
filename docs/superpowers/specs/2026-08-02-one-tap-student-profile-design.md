# One-Tap Student Profile Design

## Goal

Make student profile editing obvious and fast for teachers using Safari or a phone/tablet. A teacher should need only one tap from a student's card to reach an unlocked form for that exact student.

## Chosen approach

Add a clearly labeled `填写资料` button to every student card. Pressing it selects that student and automatically scrolls the shared profile panel into view. The profile heading changes from `请选择学生` to the selected student's name, the inputs unlock, and focus moves to the first profile field.

This is preferred over automatically selecting the first student because automatic selection makes it easier to edit the wrong child. It is also preferred over putting all profile inputs inside every card because that would make the roster much longer and slower to scan.

## Interaction contract

- Every loaded student card shows a visible `填写资料` button beside `清除今日`.
- Pressing `填写资料` selects only that student.
- The page scrolls smoothly to the profile panel after React has rendered the selection.
- The first profile input receives focus so typing can start immediately.
- Attendance buttons keep their current behavior and do not unexpectedly move the page.
- The existing student-name selector remains available for compatibility, but it uses the same scroll-and-focus behavior.
- The profile form still requires `保存学生资料` to prevent partial or accidental edits from being saved.

## Accessibility and mobile behavior

The new entry point is a real button with a specific accessible name containing the student's name. Scrolling uses the profile section as a stable target, and focusing the first input makes the destination clear to keyboard and assistive-technology users. The button uses the existing secondary-button style so its touch target remains large and visually distinct.

## Verification

Automated tests must prove that one tap on `填写资料` selects the correct student, shows that student's name, unlocks the form, scrolls the panel into view, and focuses the first input. Existing attendance, roster, profile-save, search, pagination, mobile, and Sites tests must remain green.
