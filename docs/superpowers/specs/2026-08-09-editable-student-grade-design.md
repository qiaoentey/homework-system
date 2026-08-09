# Editable Student Grade Design

## Goal

Allow teachers to change the grade of a student who is already enrolled, from the existing student profile form, without creating a new student or losing attendance, messages, lifecycle history, or profile data.

## Root cause

The current profile form receives `student.grade` only as a read-only input for filtering school classes. The form renders no grade control, the browser sends only `updatedAt` and `profile`, and both server implementations update only the profile column. The inability to change grade is therefore an end-to-end product gap, not a teacher error.

## Considered approaches

1. Extend the existing profile save operation to update grade and profile atomically. This is recommended because teachers already edit a selected student's details there, it preserves the same student UUID, and the current optimistic-lock protection can cover both values.
2. Add a separate “change grade” dialog and endpoint. This adds unnecessary navigation and duplicates save/error handling.
3. Stop and re-enrol the student at the new grade. This is rejected because it is cumbersome and risks splitting the student's history across records.

## User experience

- Add a required `年级` selector as the first field in the existing student profile form.
- Preselect the student's current grade.
- Offer the complete known catalog: `K1`, `K2`, `K1+K2`, `F1` through `F6`, `Y1` through `Y6`, `幼儿班`, and `一年级` through `六年级`.
- Preserve an existing non-catalog grade as a visible `（现有资料）` choice so legacy data remains editable.
- Save the selected grade with the existing `保存学生资料` button.
- When the new grade makes the current school class invalid, clear only the school-class value so the teacher can select a valid class. Keep the school and all other profile fields.
- After saving, update the student card immediately so the new grade is visible without refreshing.

## Data flow

1. `ProfilePanel` owns editable `grade` state alongside profile state.
2. The shared profile fields component renders the grade selector only when an `onGradeChange` callback is supplied, avoiding a duplicate selector in Enrol.
3. The client sends `{ updatedAt, grade, profile }` to the current UUID-scoped profile endpoint.
4. Both the Express/Postgres and Sites Worker/D1 implementations validate the optional grade, retain backward compatibility with older profile-only clients, and update grade and profile in one optimistic-lock-protected database operation.
5. The returned student replaces the matching UUID in the current roster, preserving attendance, messages, and lifecycle history automatically.

## Validation and safety

- Reject blank grades and unknown request keys.
- Keep branch and teacher-group scoping unchanged.
- Keep the existing `updatedAt` conflict check so a stale teacher screen cannot overwrite a newer change.
- Record the changed grade and profile fields in the existing `profile_update` activity.
- No schema or migration is required because `students.grade` already exists.

## Verification

- Client test: the existing student's current grade is selected, changing it sends the exact grade with the profile, and the returned grade updates the visible student card.
- Class compatibility test: changing grade clears an incompatible school class and preserves compatible profile data.
- Express API test: grade and profile update atomically; stale updates still return `STUDENT_CHANGED`.
- Sites Worker test: D1 stores the new grade on the same UUID and attendance/messages remain linked.
- Browser test: a teacher changes an enrolled student's grade and sees the new value on desktop and mobile.
- Run all unit, server, Sites, production-build, desktop, and mobile checks before saving the next website version.
