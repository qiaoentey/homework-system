# Final fix report

Date: 2026-07-27

Reviewed head: `c7c61ac`

Implementation commit: `9757648` (`fix homework checker final review findings`)

Branch: `codex/homework-checker-pwa`

## Outcome

All three Critical and all ten Important findings in `final-review-findings.md` are addressed in code and covered by automated tests. The privacy/product constraints remain intact: no login, no backend or hosted OCR service, no photo upload, no analytics, no paid API, and no forced dependency update.

The automated release suite is green. Production release is still deliberately blocked until the new CI audit receives approved npm-registry access and exact advisory triage, and until the documented physical iPhone/Android device gate is completed.

## Finding closure

### Critical

1. **Unified exact arithmetic — fixed**
   - `NumericValue` now uses `Fraction` for integers, finite decimals, percentages, and fractions.
   - `Decimal` is used only for formatting a rational value.
   - Mixed exact regressions include `1/3 × 3 = 1`, `1/3 ÷ 2 = 1/6`, `1/3 + 2 = 7/3`, decimals, and percentages.
   - A correct-equation table verifies supported correct forms never become incorrect.

2. **Question-number stripping — fixed**
   - `)` and `、` remain unambiguous labels.
   - `.`, `,`, and `，` require following whitespace before they are treated as labels.
   - End-to-end analysis and segmentation tests preserve `1.5 + 2.5 = 4` and `1,000 + 500 = 1,500`.

3. **Currency rounding — fixed**
   - Money is converted to its base money value, rounded half-up to sen, and only then compared and displayed.
   - `RM 10 / 3 = RM 3.33` is correct; `RM 3.32` is incorrect.
   - Repeating non-money decimals with no stated rounding precision remain review/uncertain, never red.

### Important

1. **Confidence gates — fixed**
   - OCR preserves the minimum digit/operator symbol confidence. A critical word without symbol details falls back to that word’s confidence rather than being omitted.
   - Question location confidence is derived independently from numbered boundaries and geometric row separation.
   - Production-facing tests exercise independently low/high critical-character and location confidence combinations.

2. **Manual crop coordinates — fixed**
   - Pointer coordinates use the exact rendered image frame, whose aspect ratio matches the prepared raster.
   - Crop rectangles are pixel-aligned; crop-local OCR boxes are scaled and offset into full-image coordinates before segmentation.
   - Pure mapping tests and a `MathScanner` integration test verify the final full-image annotation percentages.

3. **Offline deep routes — fixed**
   - The service worker returns the precached app shell only for exact same-origin navigation to `/`, `/scan`, and `/answers`.
   - Direct navigation and reload of all three routes pass while Chromium is offline.
   - PDF, OCR, asset, and unknown paths are explicitly excluded from HTML fallback.

4. **PWA update/cache lifecycle — fixed**
   - A new worker waits; the user chooses **Update and reload** after finishing current work.
   - `SKIP_WAITING` is handled only after that choice, and the prompt has controlled “later” behavior.
   - OCR cache names use a SHA-256-derived content version over bundled OCR files.
   - Activation deletes only obsolete `homework-checker-ocr-*` caches.
   - Prompt and navigation/cache lifecycle tests cover controlled activation and cleanup.

5. **Image responsiveness and memory — fixed**
   - The CPU 3×3 enhancement loop runs only in a focused module Worker.
   - Pixel buffers transfer to/from the Worker.
   - Replacing/clearing a photo aborts and terminates stale preparation.
   - JPEG/PNG encoded dimensions are checked before decode when possible, every decoded source is capped at 12 MP, allocation failure retries once at a 1200-pixel maximum, and retained OCR rasters remain bounded at 1600².
   - Tests cover transfer, cancellation, preflight rejection, retry, cleanup, and coordinate mapping.

6. **Mobile annotation interaction — fixed**
   - Every annotation also has a persistent result-list action with a 44 px minimum target.
   - Dismissed annotations retain their record and can be restored without losing edits.
   - Mobile E2E performs edit → recognized-text restore → cancel → reopen canceled result → restore marker, and measures the result target.

7. **Calibration matrix — fixed**
   - The de-identified synthetic matrix now covers Grades 1–6.
   - It includes clean typed, synthetic camera-angle, and handwriting-style presentation; arithmetic, units, decimals/thousands, currency, simple equations, recurring decimal review, and fractions.
   - It proves at least one deliberate wrong answer red, zero correct answers red, and two deliberately unjudgeable answers orange.
   - Current Playwright WebKit passes a real preprocessing/OCR Worker smoke.
   - Physical iPhone/Safari and Android/Chrome evidence remains an explicit production release gate in the README.

8. **Simple equations — fixed**
   - The allow-listed parser accepts only explicit `x … = …, x = …` answer form.
   - Exact affine reduction checks one-variable linear equations.
   - Nonlinear, division-by-variable/zero, non-unique, unit-bearing, missing-answer, and other unsupported forms return review.
   - The input boundary is capped at 160 characters and 64 tokens.

9. **Original image export — fixed**
   - The unchanged source `File` is retained only in session.
   - Explicit export decodes it with EXIF orientation, preserves source color/resolution, maps normalized annotations to source dimensions, omits dismissed annotations, and closes the decoded bitmap.
   - Export uses the same 12 MP safety cap, AbortSignal/stale-request protection, and tested cleanup.
   - E2E verifies EXIF-decoded/display/annotation coordinate alignment in Chromium and WebKit.

10. **Production dependency gate — fixed**
    - `.github/workflows/homework-checker-ci.yml` runs locked install, unit tests, production build, blocking `npm audit --audit-level=high`, installs Chromium/WebKit, and runs the full browser suite.
    - There is no `continue-on-error` and no `audit fix --force`.

### Minor findings closed

- All 12 production-built local PDF assets are fetched and validated as non-empty `%PDF-` responses.
- The exact 34-entry video inventory is asserted. Each entry has `external-unverified` status and a catalog-review date, so inclusion cannot be mistaken for a live-link claim.
- Scanner UI explains that the first OCR-model download needs a connection and later OCR can run offline.
- `--pass-with-no-tests` was removed.
- README now records successful current WebKit real-worker smoke and keeps physical Safari testing as the production gate rather than claiming automatic incompatibility.

## Privacy and calibration evidence

The final Chromium calibration produced 18/18 question targets over six samples:

- 1 deliberate wrong answer: 1 red;
- correct answers: 0 false red;
- deliberately unjudgeable answers: 2 orange;
- normalized full-equation matches: 17/18;
- normalized key characters: 174/175 (99.43%);
- aggregate annotation outcomes: 14 green, 3 orange, 1 red.

The network audit observed 78 same-origin static HTTP requests plus 12 local `blob:` reads over six isolated scanner page runs. It found:

- no cross-origin request;
- no non-GET or request body;
- no query/hash data;
- no WebSocket;
- no image/base64/blob payload in an HTTP URL/body;
- no recognized or fixture equation text leaving the browser.

The actual source `File` is decoded again only after the explicit export click. Model cache storage contains only same-origin OCR runtime files, never worksheet photos.

## Verification

Final commands run from `homework-checker/`:

| Command | Result |
| --- | --- |
| `npm test` | PASS — 16 files, 109 tests |
| `npm run build` | PASS — TypeScript, client, focused preprocessing Worker, OCR Worker, and injected service worker |
| `npm run test:e2e` | PASS — 14 passed, 4 intentional project-capability skips, 0 failed |
| `git diff --check` | PASS |
| `npm audit --audit-level=high` | Not executed: environment policy rejected sending dependency metadata to the public registry |

The four E2E skips are intentional and paired with coverage in the other project:

- full six-page calibration runs only in Chromium;
- real-worker compatibility smoke runs only in WebKit;
- two service-worker offline-emulation tests skip WebKit because Playwright WebKit bypasses that fetch path.

All shared UI, PDF, EXIF, annotation, and catalog flows still run in both projects.

## TDD and review evidence

- Baseline before final fixes: 12 files / 59 tests green.
- Exact-arithmetic/label/currency/simple-equation regressions were added first and produced 14 failures before implementation; the focused math suite then passed.
- Confidence, worker cancellation/memory, crop mapping, export lifecycle, PWA lifecycle, calibration, restore interaction, first-use UI/catalog, and parser-bound tests were added or strengthened alongside each implementation.
- The final first-use/catalog red run showed 3 failures before implementation; the parser-bound test showed 1 failure before its bound was added.
- Final self-review found and corrected a partial-symbol OCR fallback edge, followed by impacted tests, a production build, the complete unit suite, and the complete E2E suite.

## Remaining external release gates

1. **Dependency advisories:** local audit could not be authorized. A pre-existing review note reported eight high-severity findings. The new CI audit must run with approved registry access, and exact advisory/package/lockfile paths must be triaged before release.
2. **Physical devices:** record the README checklist on a current physical iPhone/Safari and Android/Chrome device, including first model download, airplane-mode relaunch, camera/gallery photos, manual crop, source-color EXIF export, large-photo behavior, and controlled update.
3. **Tooling warning:** the PWA build currently prints an upstream `inlineDynamicImports` deprecation warning; it does not fail the build or affect the verified output, but should be revisited when the PWA plugin updates.

No unresolved Critical or Important implementation finding remains.

## Commits

- `9757648` — implementation, tests, fixtures, CI, and README.
- The report itself is added by the following documentation commit.
