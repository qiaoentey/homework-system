# MK Van Driver Options Design

## Goal

Add seven requested Van drivers to the MK branch only, without changing the driver choices shown in STP or WS.

## Driver lists

Keep the existing shared driver list unchanged. For MK, append these exact options in the supplied order:

1. Mr Kent
2. Uncle Yeow
3. Uncle Sam
4. Uncle Leong
5. Uncle Ting
6. Uncle Tan
7. Uncle Law

`Kent` and `Mr Kent` remain separate choices because both are valid exact names.

## Implementation

- Add a branch-aware `vanDriverOptionsFor(branchCode)` function in the existing profile options module.
- Return a fresh array so callers cannot mutate the shared catalog.
- Use that branch-specific list in the shared student profile fields component, which covers both existing student profiles and Enrol student forms.
- Preserve the existing-profile fallback option so historical values outside the current branch catalog are not lost.

## Verification

- Prove MK shows the original eight drivers followed by the seven new drivers.
- Prove WS retains only the original eight drivers.
- Run the full client/server suite, Sites Worker suite, production build, and desktop/mobile browser tests.

