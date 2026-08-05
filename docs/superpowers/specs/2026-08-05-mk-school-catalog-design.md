# MK School Catalog Design

## Goal

When a teacher is working inside the MK branch, the student profile school field must show only 一校, 二校, and 启智. The school-class field must then show only the classes for the student's selected school and grade.

## School and class rules

- 一校: Year 1 `1B, 1M, 1U`; Year 2 `2B, 2M, 2U`; Year 3 `3J, 3B, 3M, 3U`; Year 4 `4B, 4M, 4U`; Year 5 `5B, 5M, 5U`; Year 6 `6B, 6M, 6U`.
- 二校: every Year 1–6 uses the matching year prefix with `W, I, S`.
- 启智: every Year 1–6 uses the matching year prefix with `C, J, B`.

Both `Y1`–`Y6` and `一年级`–`六年级` map to Year 1–6. Other grades have no selectable MK school class.

## Behavior

- Pass the active branch into the shared student-profile fields used by both existing-student editing and Enrol.
- MK receives a branch-specific school catalog containing only the three approved schools.
- 南益、民义、旺小、桥南、中华小学、中华中学 are not selectable in MK.
- STP and WS retain their current school choices until their own branch catalogs are supplied.
- Changing school or grade clears an incompatible class, preserving the current safe behavior.
- A previously saved non-catalog value remains visible as `现有资料` so old records are not silently erased, but it is not offered as a normal new choice.

## Validation

- Unit tests prove MK has exactly the three schools and the exact class lists for each year.
- Unit tests prove the six previous schools are absent in MK and remain available outside MK.
- Enrol and existing-student profile tests prove both entry points receive the branch-aware catalog.
- The complete client, server, Sites Worker, build, desktop, and mobile checks run before publishing.
