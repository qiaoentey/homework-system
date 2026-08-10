# Van Weekday Times Design

## Goal

Let teachers choose a separate Van home time for each weekday using only the three requested choices: `5:30 PM`, `7:00 PM`, and `8:45 PM`.

## Chosen interaction

Replace the Van weekday checkboxes plus one shared time selector with five weekday selectors. Each selector contains `不需要`, `5:30 PM`, `7:00 PM`, and `8:45 PM`. Choosing a time means the student uses the Van on that weekday; choosing `不需要` clears that weekday. This is fewer steps than checking a weekday and then choosing a second field.

Two alternatives were rejected:

- Keep one shared time below the weekday checkboxes. This cannot represent different return times on different days and is already the current behavior.
- Add five new `van*Time` profile properties. This is explicit but duplicates the existing weekday properties and would require a wider API contract change without improving the teacher workflow.

## Data compatibility

Reuse the existing `vanMonday` through `vanFriday` profile properties. New edits store the selected time directly (`17:30`, `19:00`, or `20:45`) in each weekday property. An empty string means the Van is not needed that day.

Existing records that store `需要` in a weekday property remain supported. Their displayed weekday time falls back to the existing `vanHomeTime`, then to `usualPickupTime`. No database schema or migration is required because the profile is already stored as JSON and the existing API contract accepts strings for these properties.

## Student labels

The green Van label groups weekdays that share a time. For example:

`Van载送 · Mr Kent · 周一、五 5:30 PM · 周三 7:00 PM`

Legacy records with one shared time keep their current compact label, such as `周一、三、五 · 7:00 PM`. If a Van profile has no weekdays, the label continues to show `平日` with its saved fallback time when available.

## Validation and testing

- Component tests verify all five weekday selectors expose only the three requested times plus `不需要` and send the selected time through the existing profile change callback.
- Label tests verify weekdays are grouped by their saved per-day times and verify legacy `需要` plus `vanHomeTime` data still renders correctly.
- Existing enrolment, profile-editing, server, Worker, build, and Sites packaging tests remain green.

## Scope

This change affects Van weekday/time entry and Van labels only. Driver lists, attendance, login, Dashboard permissions, and other student profile fields remain unchanged.
