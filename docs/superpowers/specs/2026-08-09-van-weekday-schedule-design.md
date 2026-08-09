# Van Weekday Schedule Design

## Goal

Let teachers record which weekdays a student uses Van transport, while keeping the existing single driver and return-time fields simple.

## Teacher flow

- `回家载送` remains the trigger. When it is `Van`, show `Van 司机`, `Van 回程时间`, and five checkboxes labelled `星期一 Van` through `星期五 Van`.
- The teacher selects one driver, enters one return time, and checks every weekday that uses the same Van schedule.
- The schedule stays optional so existing students can still be opened and saved without forced data entry.
- Hiding the Van controls does not erase saved Van details. This follows the existing transport behaviour and prevents accidental data loss.

## Stored data

Add five string profile fields: `vanMonday`, `vanTuesday`, `vanWednesday`, `vanThursday`, and `vanFriday`. A selected weekday stores `需要`; an unselected weekday stores an empty string. The fields travel through the existing full and partial profile APIs and remain inside the existing profile JSON, so no SQL schema migration is required.

Existing profiles are normalized with empty values for the five new fields. Express and the Sites Worker both accept and preserve them.

## Student-card label

The green label uses the saved weekdays and existing return time, for example `Van载送 · Uncle Kent · 周一、三、五 · 17:00`. If an older Van profile has no weekday selections, keep the current `平日` fallback so the label remains useful and old data does not appear broken.

## Verification

Use failing tests first for the Van form, submitted enrolment profile, green student-card label, Express persistence, and Sites Worker persistence. Then run the complete unit, Worker, build, desktop, and mobile suites before saving a release version.
