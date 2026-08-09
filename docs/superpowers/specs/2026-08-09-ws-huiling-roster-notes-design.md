# WS Huiling Roster and Student Notes Design

## Goal

Add the supplied 83 students to the existing `WS HUILING` roster, authorize the two requested Google emails, and let teachers record detention and visible special notes in each student profile.

## Roster and access

- Keep the current `WS HUILING` teacher option. Do not create an `NG` option.
- Merge the supplied 83-name list into the existing 46 students without duplicating matching identities, producing 89 active roster records.
- Preserve the supplied grades exactly. Keep `颜凯峯 · Y2` and `颜凯峯 · Y3` as two separate students with separate stable source references.
- Apply the supplied-list corrections to the matching existing records: `chen yi qi` becomes `陈怡棋`, `胡浩文` becomes `胡浩问`, `陈廷熙` moves from Y4 to Y3, and `欧阳昕媛` moves from Y3 to Y2.
- Add `mkkikiwong@gmail.com` and `liewying825@gmail.com` to the hosted Google email allowlist without removing existing authorized emails.

## Student profile fields

- Add one optional select called `留堂` with `听写留堂`, `功课留堂`, and `不可以留堂`.
- Add a `特别备注` section with three independent checkboxes:
  - `高c`
  - `一定要每天拍照功课进群组给家长`
  - `来不及完成功课一定要通知家长`
- Add one optional text field called `其他备注`. Its saved text becomes an additional special note.
- Preserve all values when unrelated profile controls are changed.

## Roster display

Each selected preset and the custom note render as separate purple `备注` labels beneath the student identity. Multiple labels wrap on narrow phone screens. Detention remains available in the profile form but does not create a roster label because only special notes were requested under the name.

## Persistence

Extend the shared profile JSON contract with `detentionType`, `specialNoteHighC`, `specialNoteDailyHomeworkPhoto`, `specialNoteNotifyIncompleteHomework`, and `specialNoteOther`. Existing profiles normalize these fields to empty strings. Add idempotent PostgreSQL and D1 roster migrations plus the CSV import source; no table schema change is required.

## Verification

Use failing tests first for the 89-student merged roster, duplicate-name grades, profile payload, persistence allowlists, and visible notes. Then run unit, Worker migration, production build, desktop Chromium, and mobile Chromium verification before saving a website version.
