# Student Profile Options Restoration Design

## Goal

Restore the original STP student-profile choices in the optimized system so teachers select valid schools, matching school classes, transport details, and times instead of typing every value manually.

## Root cause

The optimized rebuild retained nine generic profile storage fields but rendered every field as a plain text input. The original STP interface's option catalogs, grade-aware school/class linkage, time inputs, Van-only fields, and weekday stay-time selections were not ported. The recent one-tap shortcut exposed this pre-existing omission; it did not remove profile data.

## Chosen approach

Port the original controlled-choice behavior into one reusable React profile-fields component shared by the existing-student profile panel and the Enrol dialog. Keep the current camelCase storage contract and add only the two missing Van fields. This restores the old teacher workflow without moving or deleting existing profile JSON.

Free-text inputs with suggestions were rejected because they still allow misspellings and cannot guarantee school/class linkage. A separate admin configuration screen was rejected because the user asked to restore the known fixed setup, not add configuration management.

## School and class catalog

The fixed schools and suffixes are copied from the original STP system:

| School | Primary/secondary class suffixes |
| --- | --- |
| 南益 | K, H, B, M, U, J, C |
| 民义 | M, K, J, B, H, U, P |
| 旺小 | 坚, 持, 传, 承, 延, 续 |
| 桥南 | M, K |
| 中华小学 | 礼, 义, 廉 |
| 中华中学 | S, M, J, K, C, H, O, N, G, W, A |

For primary students, the school class is the grade number plus a school suffix, such as `3K`. `Y1` through `Y6` and `一年级` through `六年级` map to primary levels 1 through 6. For 中华中学, `F1` through `F5` map to `F<level><suffix>`, such as `F2S`. Kindergarten grades have no generated school-class choices.

Changing school clears the prior class before showing the new valid list. Existing non-catalog schools, classes, drivers, or stay times remain visible as `现有资料` choices so viewing or saving another field never silently deletes them.

## Time and transport controls

- `usualPickupTime`: label `平常回家时间`, native time input.
- `pickupMethod`: label `回家载送`, controlled choices `家长` and `Van`.
- `vanDriver`: shown only for Van, with Tong, Lam, Lim, Kent, Wong, Boon, Aunty Lily, and Liew.
- `vanHomeTime`: shown only for Van, native time input labeled `Van 回程时间`.
- Monday through Friday stay fields: controlled choices `不留校`, `3:30 PM`, `4:00 PM`, and `5:00 PM`, stored as empty string, `15:30`, `16:00`, and `17:00`.

The save button stays explicit. Switching from Van to 家长 hides the Van fields but does not erase their stored values, so switching back before saving restores the choices.

## Data contract and compatibility

The existing profile keys remain unchanged. Two optional-string-compatible keys are added to the full normalized profile contract:

- `vanDriver`
- `vanHomeTime`

Existing database rows can omit these JSON keys; frontend normalization supplies empty strings. New enrolments send all eleven profile fields. Profile updates remain partial and optimistic-lock protected. No SQL/D1 schema migration is required because profiles are JSON.

## UI reuse

Create one `StudentProfileFields` component that receives `grade`, `values`, `disabled`, and `onChange`. Both `ProfilePanel` and `EnrolDialog` use it, preventing the two workflows from drifting apart again. The first focus target remains the school control after one-tap profile navigation.

## Verification

Automated tests must prove:

- the exact six schools are selectable;
- Y and Chinese primary grades generate the correct class list;
- F grades generate classes only for 中华中学;
- changing school clears an incompatible class;
- parent/Van selection controls Van-only fields;
- both normal and Van return times use time inputs;
- all five stay-time selects expose the original four options;
- non-catalog existing values remain visible;
- Profile save and Enrol send all eleven keys through both Express and Sites runtimes;
- existing attendance, profile, enrol/stop/restore, desktop, mobile, and deployment tests remain green.
