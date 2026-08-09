# WS Van Driver Options Design

## Goal

Add three requested Van drivers to the WS branch only, without changing the driver choices shown in MK or STP.

## Driver list

Keep the existing shared driver list unchanged. For WS, append these options in the supplied order and use the existing title-style naming convention:

1. Uncle Liew
2. Uncle Chan
3. Aunty Airine

The existing shared `Liew` option remains separate from `Uncle Liew` because they are distinct displayed names.

## Considered approaches

1. Extend the current branch-aware selector with a WS-only append list. This is the recommended approach because it matches the existing MK implementation and keeps every branch isolated.
2. Add the names to the shared list. This is rejected because it would expose WS drivers in MK and STP.
3. Move driver catalogs into the database. This is rejected because the request is a small static catalog update and does not require administrative editing.

## Implementation

- Add a private WS driver array beside the existing shared and MK arrays.
- Update `vanDriverOptionsFor(branchCode)` so MK receives its current seven additions, WS receives the new three additions, and STP receives only the shared list.
- Continue returning fresh arrays so callers cannot mutate the catalogs.
- Keep using the shared student profile fields component so the options appear in both existing-student Profile and Enrol forms.
- Preserve the existing historical-value fallback.

## Verification

- Prove WS shows the shared eight drivers followed by the three new drivers.
- Prove MK retains its current shared-plus-seven list.
- Prove STP retains only the shared list.
- Verify one WS Enrol flow can select and save `Uncle Liew` on desktop and mobile.
- Run the complete automated test suites and production build before saving the next website version.
