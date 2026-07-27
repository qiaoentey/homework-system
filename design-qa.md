# Daycare Visual QA

## Comparison Target

- Source visual truth:
  `/Users/qiaoentey/.codex/generated_images/019f988e-1dc8-78a0-8d0e-50b8df8cd2dd/call_6MWWL5fN4voP8deTLCDyejkW.png`
- Source pixels: 853 × 1844, interpreted as approximately 426 × 922 CSS px at 2×.
- Branch implementation:
  `/private/tmp/daycare-visual-qa/branch-426x928-at2x.png`
- Full-view branch comparison:
  `/private/tmp/daycare-visual-qa/comparison-branch-side-by-side.png`
- Implementation pixels: 852 × 1856, captured at 426 × 928 CSS px at 2×.
- State: authenticated branch gateway with STP as the sole primary branch.

## Captured State Evidence

Seven browser-rendered states were reviewed:

1. Branch gateway — `/private/tmp/daycare-visual-qa/branch-426x928-at2x.png`
2. MK teacher chooser — `/private/tmp/daycare-visual-qa/teacher-mk-426x928-at2x.png`
3. Enrol dialog — `/private/tmp/daycare-visual-qa/enrol-426x928-at2x.png`
4. Stop-supplement dialog — `/private/tmp/daycare-visual-qa/stop-426x928-at2x.png`
5. Profile no-result state —
   `/private/tmp/daycare-visual-qa/profile-no-result-426x928-at2x.png`
6. PS STP desktop roster —
   `/private/tmp/daycare-visual-qa/roster-ps-stp-1440x900.png`
7. WS mobile roster —
   `/private/tmp/daycare-visual-qa/roster-ws-mobile-390x844.png`

The mobile captures are 852 × 1856 at 2× except the WS roster, which is a
390 × 844 single-density viewport. The desktop roster is 1440 × 900.

## Required Fidelity Surfaces

- Fonts and typography: the branch heading, subtitle, and branch labels preserve
  the source hierarchy, weight, wrapping, and optical scale. Residual baseline
  differences are within 2–4 CSS px and are P3-only.
- Spacing and layout rhythm: Iteration 2 moves the logo down 8 CSS px while
  compensating the header gap by −8 CSS px, so the heading stays effectively
  fixed. Branch buttons are 90px high with 25px gaps and a 49px
  heading-to-list gap.
- Colors and visual tokens: STP alone uses the navy primary treatment. MK and WS
  remain light and use pale-blue hover/focus surfaces with a visible focus ring.
- Image quality and asset fidelity: the supplied 1624 × 527 transparent brand
  PNG is rendered directly at 105 × 34 CSS px; no text, CSS, or SVG
  approximation remains.
- Copy and content: `请选择分院`, `进入后只显示该分院名单`, and MK/STP/WS match the
  approved source and order.

## Comparison History

### Iteration 1

- [P1] The brand was approximated with HTML text and CSS.
  - Fix: replaced it with `public/assets/brand-logo.png`, meaningful alt text,
    and explicit 105 × 34 display dimensions.
- [P2] The mobile branch composition started too high.
  - Fix: introduced branch-only mobile top padding and compensated header
    spacing without transforms.
- [P2] Default branches could inherit a navy interaction surface.
  - Fix: kept STP explicitly primary and changed MK/WS hover/focus to pale blue.

### Iteration 2

Normalized source-to-implementation measurements found:

- logo tagline 15 physical px too high;
- heading 4–8 physical px low;
- MK label 2–6 physical px low;
- STP button ending 17 physical px too high/short;
- WS label 35 physical px too high.

The final branch-only mobile correction is:

- top padding: 88px → 96px;
- header margin: 60px → 52px, holding the heading position;
- heading-to-list gap: 52px → 49px;
- branch choice height: 84px → 90px;
- branch choice gap: 22px → 25px.

This moves the logo approximately +16 physical px, preserves the heading and MK
label, extends the STP region approximately +24 physical px, and moves WS
approximately +36 physical px. The remaining differences are at most a few
physical pixels and do not constitute P0, P1, or P2 drift.

## Full-View and Focused Review

The 1740 × 1936 side-by-side image provides a normalized full-view comparison.
The logo lockup, heading/subtitle rhythm, button bounds, labels, borders, radii,
and state colors are readable at full 2× density, so a separate focused crop was
not needed. The seven additional captures cover teacher selection, both
lifecycle dialogs, no-result safety, desktop roster density, and mobile roster
containment.

## Interaction and Console Review

- Captured states cover branch selection, teacher selection, roster loading,
  Enrol, stop-supplement, and no-result profile safety.
- Local Vite websocket messages are preview-only noise and are not production
  application errors.
- The unauthenticated `/api/session` 401 is expected session-detection behavior.
- The production build completes cleanly.
- No deployment was performed.

## Findings

No actionable P0, P1, or P2 findings remain. Residual 1–4 CSS px optical
differences are acceptable P3 polish and do not affect hierarchy, containment,
interaction, or asset fidelity.

final result: passed
