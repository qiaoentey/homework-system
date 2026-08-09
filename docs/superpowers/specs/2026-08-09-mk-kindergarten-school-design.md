# MK Kindergarten School Option Design

## Goal

Add `幼儿园` to the MK school selector without adding or requiring a school class.

## Behaviour

- Both Enrol and existing-student profile forms show `幼儿园` in the MK school list.
- Selecting `幼儿园` leaves `学校班级` empty and offers no class choices beyond the placeholder.
- WS and STP school lists remain unchanged.
- The existing school and class storage contract remains unchanged; an MK kindergarten student is saved with `school: "幼儿园"` and `schoolClass: ""`.

## Architecture and verification

Extend the existing MK school catalog only. The current class lookup already returns an empty list for schools without a class map. Cover the profile form, Enrol form, and browser flow with exact visible-option assertions, then run the complete test and build suites before deployment.
