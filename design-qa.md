# Branch Entrance Design QA

## Comparison Target

- Source visual truth:
  `/Users/qiaoentey/.codex/generated_images/019f988e-1dc8-78a0-8d0e-50b8df8cd2dd/call_6MWWL5fN4voP8deTLCDyejkW.png`
- Latest browser-rendered implementation evidence available before this fix:
  `/private/tmp/daycare-visual-qa/branch-426x928-at2x.png`
- Full-view side-by-side comparison:
  `/private/tmp/daycare-visual-qa/comparison-branch-side-by-side.png`
- Source pixels: 853 × 1844, interpreted as approximately 426 × 922 CSS px at 2×.
- Implementation pixels: 852 × 1856, captured at 426 × 928 CSS px at 2×.
- State: authenticated branch gateway, default interaction state.

## Findings

- [P1] The visible brand was approximated with HTML text and CSS.
  - Location: `AppShell` / `.brand`.
  - Evidence: the source contains a distinctive raster logo lockup; the
    implementation used two text nodes with skew, letter spacing, and text shadow.
  - Fix applied: copied the supplied cleaned RGBA logo into
    `public/assets/brand-logo.png` and rendered it as a 105 × 34 image with the
    meaningful alt text `诚意教育，您身边学习专家`.

- [P2] The mobile composition started too high.
  - Location: mobile branch entrance.
  - Evidence: source tagline y243–254, heading y393–454, and first-choice label
    y726–763 at 2×; pre-fix implementation tagline y142–159, heading y333–398,
    and first-choice label y664–705.
  - Fix applied: mobile branch-only top padding is now 88px and its header gap is
    60px. This targets a logo top near 88px, heading top near 196px, and first
    choice near 332px without fixed transforms or 390 × 844 overflow.

- [P2] Default branches inherited the navy interaction surface.
  - Location: `.choice-button:hover` and `.choice-button:focus-visible`.
  - Evidence: the pre-fix screenshot showed WS navy even though only STP is
    primary in the source.
  - Fix applied: default branch hover/focus now uses a pale-blue surface with a
    visible blue focus ring. The explicit STP `data-variant="primary"` rule
    remains navy at rest and during interaction.

## Required Fidelity Surfaces

- Fonts and typography: branch heading, subtitle, and button typography remain
  unchanged because their visible size, weight, wrapping, and hierarchy were
  close in the normalized comparison.
- Spacing and layout rhythm: mobile top padding and header-to-heading rhythm were
  corrected from measured evidence; widths, radii, and button gaps remain close.
- Colors and visual tokens: STP remains navy; MK/WS default interactions are now
  pale blue rather than incorrectly inheriting the primary fill.
- Image quality and asset fidelity: the text/CSS logo approximation was removed
  and replaced with the supplied 1624 × 527 transparent PNG.
- Copy and content: `请选择分院`, `进入后只显示该分院名单`, and the MK/STP/WS order
  match the source.

## Comparison History

### Iteration 1

- Earlier evidence: the supplied side-by-side comparison identified the P1 logo
  substitution and both P2 placement/state mismatches above.
- Fixes made: real logo asset, measured mobile branch spacing, and STP-only navy
  interaction treatment.
- Post-fix evidence: component regressions and production build are available,
  but a browser-rendered screenshot could not be captured because this Codex
  session exposed neither the in-app browser nor Chrome.

## Focused Region Evidence

The supplied comparison clearly exposes the logo, heading rhythm, and branch
button states at readable size. A post-fix focused crop could not be produced
without a browser-rendered capture.

## Verification Blocker

The local application server was started, but browser discovery returned no
available in-app-browser or Chrome surface. Console inspection, primary
interaction replay, and a same-viewport post-fix screenshot comparison therefore
remain unavailable.

final result: blocked
