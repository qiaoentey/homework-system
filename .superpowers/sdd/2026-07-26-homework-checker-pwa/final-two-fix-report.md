# Final-two fix report

Date: 2026-07-27

Branch: `codex/homework-checker-pwa`

Reviewed base: `57940421a6c2c2b8526d4abe3dcd903c30d028b1`

Implementation commit: `b473448` (`fix: close final homework checker review gaps`)

Requirement source: `final-two-fix-brief.md`

## Outcome

Both residual findings are closed.

1. Production question segmentation can now produce location confidence below the unchanged `0.80` red threshold from measurable boundary and geometry evidence.
2. The PWA update cycle is covered through production coordinator and Service Worker handlers, plus a real Chromium integration using the built Service Worker.

The final independent review found no remaining Critical or Important issues. Privacy and product constraints remain unchanged: no login, backend, photo upload, analytics, paid API, or network OCR was added.

## Residual 1: genuine location confidence

### Verified defect

At base `5794042`:

- every numbered group received `0.96`;
- every unnumbered group received at least `0.82`;
- `analyzeQuestions.ts` still required only `0.80` location confidence for red;
- the only low-location analyzer tests directly injected `0.79`, a value the production segmenter could not emit.

The review feedback therefore matched the committed code.

### Implementation

`questionSegmenter.ts` now derives location confidence from independent evidence:

- explicit numbered or unnumbered boundary strength;
- normalized vertical gap strength for unnumbered questions;
- symmetric uncertainty on both sides of the four-line-height column split;
- overlap proportion between OCR fragments inside a group;
- continuation-row gaps approaching the question split threshold;
- overlap between every pair of completed group boxes, including interleaved two-column reading order.

The scoring is based on normalized geometry, not fixture names, recognized equations, or expected answers. Clear regions remain above the red gate; ambiguous geometry can fall below it. `REGION_CONFIDENCE_THRESHOLD` remains `0.80`.

Production segmenter-to-analyzer tests prove:

- a clear, high-confidence wrong equation can become red;
- overlapping fragments flow through the real segmenter and stay review/orange;
- a barely separated unnumbered boundary can fall below `0.80`;
- gutters immediately below and above the column split are both treated as ambiguous;
- vertically overlapping numbered groups stay out of red;
- same-column overlaps remain conservative even when two-column reading order interleaves the groups;
- low critical digit/operator confidence independently blocks red.

### TDD evidence

Initial production-path RED:

```text
$ npm test -- tests/questionSegmenter.test.ts
Test Files  1 failed (1)
Tests       1 failed | 12 passed (13)
expected 0.96 to be less than 0.8
```

After adding weak-boundary and column-association coverage, the corrected RED fixture produced:

```text
$ npm test -- tests/questionSegmenter.test.ts
Test Files  1 failed (1)
Tests       3 failed | 12 passed (15)
```

The three expected failures were:

- overlapping fragments still returned `0.96`;
- a barely separated unnumbered boundary stayed above the gate;
- a borderline column gutter stayed above the gate.

One intermediate weak-boundary fixture used the wrong absolute `y` coordinate and failed on group count instead of confidence. The fixture was corrected before production edits, then rerun to obtain the intended three confidence failures above.

First GREEN:

```text
$ npm test -- tests/questionSegmenter.test.ts tests/analyzeQuestions.test.ts
Test Files  2 passed (2)
Tests       27 passed (27)
```

Independent review then found discontinuity and adjacent-group blind spots. The new regression RED was:

```text
$ npm test -- tests/questionSegmenter.test.ts
Test Files  1 failed (1)
Tests       2 failed | 15 passed (17)
expected 0.94 to be less than 0.8
```

This covered a gutter just below the split and vertically overlapping numbered groups. After symmetric gutter scoring and completed-group overlap evidence:

```text
$ npm test -- tests/questionSegmenter.test.ts tests/analyzeQuestions.test.ts
Test Files  2 passed (2)
Tests       29 passed (29)
```

The correction review then reproduced interleaved two-column overlaps. RED:

```text
$ npm test -- tests/questionSegmenter.test.ts
Test Files  1 failed (1)
Tests       1 failed | 17 passed (18)
```

After comparing all intersecting group pairs rather than adjacent flattened groups, final focused GREEN was:

```text
$ npm test -- tests/questionSegmenter.test.ts tests/analyzeQuestions.test.ts
Test Files  2 passed (2)
Tests       30 passed (30)
```

## Residual 2: real PWA update cycle

### Verified defect

At base `5794042`:

- `PwaUpdatePrompt.test.tsx` stopped after asserting a mocked `updateServiceWorker(true)` call;
- `pwaLifecycle.test.ts` checked only cache-name filtering;
- no test exercised waiting worker, teacher acceptance, `SKIP_WAITING`, activation, controller change, reload, and cache cleanup as one sequence.

The implementation behavior was partially delegated to Workbox, but the required lifecycle evidence and exact once-only coordination were absent.

### Implementation

`PwaUpdateCoordinator` is a production coordinator, not a test stub. It:

- requires an already controlled client and an actual waiting worker;
- arms the native `controllerchange` listener before posting `{ type: "SKIP_WAITING" }`;
- posts only once for repeated acceptance;
- reloads exactly once;
- converges native controller changes with Workbox `onNeedReload`;
- reloads a prompted stale tab when another tab accepted the update and Workbox confirms the new controller.

`installServiceWorkerUpdateLifecycle` installs the production worker handlers:

- message `SKIP_WAITING` is retained with `event.waitUntil(scope.skipWaiting())`;
- activation deletes only obsolete `homework-checker-ocr-*` caches;
- cleanup completes before `clients.claim()`, so reload observes the cleaned cache set;
- the current OCR cache and every non-OCR cache remain untouched.

The React lifecycle harness dispatches through those exact production message and activation handlers. Its fake objects represent browser-owned boundaries only: registration, EventTarget dispatch, cache storage, worker state, controller state, and reload.

`e2e/pwa-update.spec.ts` adds the preferred real-browser integration:

1. load and control a Chromium client with the built worker;
2. seed the current OCR cache, an obsolete OCR cache, and an unrelated cache;
3. register a query-versioned copy of the actual built `service-worker.js`;
4. observe it in `waiting`;
5. observe the real update prompt;
6. click the teacher acceptance button;
7. let the built worker handle `SKIP_WAITING`, activate, clean caches, and claim;
8. observe the new controller and exactly one reload;
9. verify current OCR and unrelated caches survive;
10. verify the obsolete OCR cache is gone.

### TDD evidence

Initial complete-sequence RED:

```text
$ npm test -- tests/PwaUpdatePrompt.test.tsx tests/pwaLifecycle.test.ts
Test Files  1 failed | 1 passed (2)
Tests       1 failed | 10 passed (11)
expected [] to deeply equal [ { type: 'SKIP_WAITING' } ]
```

The prompt still delegated to the mocked update helper, so the waiting worker received no message and no lifecycle transition occurred.

Initial coordinator GREEN:

```text
$ npm test -- tests/PwaUpdatePrompt.test.tsx tests/pwaLifecycle.test.ts
Test Files  2 passed (2)
Tests       11 passed (11)
```

Affected location/PWA integration GREEN:

```text
$ npm test -- tests/PwaUpdatePrompt.test.tsx tests/pwaLifecycle.test.ts tests/questionSegmenter.test.ts tests/analyzeQuestions.test.ts
Test Files  4 passed (4)
Tests       38 passed (38)
```

Independent review found the cross-tab stale-client case. RED:

```text
$ npm test -- tests/PwaUpdatePrompt.test.tsx
Test Files  1 failed (1)
Tests       1 failed | 2 passed (3)
expected 0 to be 1
```

After separating locally armed native control from Workbox-confirmed cross-tab control:

```text
$ npm test -- tests/PwaUpdatePrompt.test.tsx
Test Files  1 passed (1)
Tests       3 passed (3)
```

Independent review also found that the first fake worker scripted activation effects itself. A new production-handler RED was:

```text
$ npm test -- tests/serviceWorkerLifecycle.test.ts
Test Files  1 failed (1)
Tests       1 failed (1)
production service-worker lifecycle handlers are not installable in the harness
```

After extracting and using the production listener installation:

```text
$ npm test -- tests/PwaUpdatePrompt.test.tsx tests/serviceWorkerLifecycle.test.ts tests/pwaLifecycle.test.ts
Test Files  3 passed (3)
Tests       13 passed (13)
```

Real built-worker Chromium verification:

```text
$ npm run test:e2e -- e2e/pwa-update.spec.ts --project=chromium-android
Running 1 test using 1 worker
1 passed (4.4s)
```

The first browser-test authoring run used a DOM matcher from the unit-test library. Playwright reported `toHaveTextContent is not a function`; it was corrected to Playwright's `toContainText` before the successful run above. This was a test API error, not a product failure.

## Files changed

### Location confidence

- `homework-checker/src/scanner/questionSegmenter.ts`
- `homework-checker/tests/questionSegmenter.test.ts`

### PWA update and cache lifecycle

- `homework-checker/src/pwa/updateCoordinator.ts` — new
- `homework-checker/src/pwa/PwaUpdatePrompt.tsx`
- `homework-checker/src/pwa/cacheLifecycle.ts`
- `homework-checker/src/service-worker.ts`
- `homework-checker/tests/PwaUpdatePrompt.test.tsx`
- `homework-checker/tests/serviceWorkerLifecycle.test.ts` — new
- `homework-checker/e2e/pwa-update.spec.ts` — new

## Final verification

All final commands were run after the last review correction from `homework-checker/`.

### Unit suite

```text
$ npm test
Test Files  17 passed (17)
Tests       119 passed (119)
Duration    4.68s
```

### Production build

```text
$ npm run build
client: 39 modules transformed
service worker: 86 modules transformed
precache: 23 entries (1044.97 KiB)
files generated: dist/service-worker.js
exit code: 0
```

The build retains the pre-existing upstream warning:

```text
WARN  inlineDynamicImports option is deprecated, please use codeSplitting: false instead.
```

### Full browser suite

```text
$ npm run test:e2e
Running 20 tests using 3 workers
5 skipped
15 passed (22.1s)
```

The five skips are intentional project-capability splits:

- the built-worker update cycle runs in Chromium;
- full six-sample calibration runs in Chromium;
- two true-offline Service Worker tests skip Playwright WebKit;
- the real WebKit OCR-worker smoke skips Chromium.

Final Chromium calibration remained conservative:

- 18 questions over Grades 1–6;
- 1 deliberate wrong answer and 1 true red;
- 0 false reds;
- 2 deliberately unjudgeable orange reviews;
- 17/18 exact normalized equations;
- 174/175 normalized key characters (99.43%);
- 78 same-origin HTTP requests and 12 local `blob:` reads;
- no upload or cross-origin OCR/photo egress.

Current WebKit real preprocessing/OCR worker smoke passed.

### Repository checks and review

```text
$ git diff --check
exit code: 0
```

Final independent focused re-review:

```text
No remaining Critical or Important issues.
Focused segmenter/analyzer verification passed 30/30.
Verdict: implementation is ready to commit.
```

## Self-review

- The `0.80` red location threshold was not changed.
- No sample filename, expected equation, recognized answer, or calibration fixture is used by production scoring.
- Clear numbered and well-separated regions remain eligible for red.
- Weak vertical boundaries, near-threshold gutters, fragmented overlaps, and intersecting groups can independently block red.
- Critical symbol confidence remains an independent gate.
- All-pairs group overlap is quadratic in detected question count, but worksheet question counts are small and boxes are computed once; this avoids flattened multi-column blind spots.
- The coordinator is production code used by the UI; tests do not replace it with `onUpdate`.
- The Service Worker tests dispatch through the production message and activation handlers.
- The browser test executes the actual built Service Worker, not a synthetic worker script.
- Cache deletion is prefix-scoped and preserves the content-versioned current OCR cache and unrelated caches.
- No backend, account, upload, telemetry, payment, or external OCR path was introduced.

## Remaining concerns and external gates

No Critical or Important implementation finding remains from this cycle.

The pre-existing release gates still apply:

1. Run the blocking online `npm audit --audit-level=high` job with approved registry access and triage exact advisories before production release.
2. Complete and record the physical iPhone/Safari and Android/Chrome device checklist, including a controlled update on real devices.
3. Revisit the upstream `inlineDynamicImports` deprecation warning when the PWA plugin/toolchain supports the replacement.
4. The deterministic built-worker update-cycle integration runs in Chromium; Safari update behavior remains part of the physical-device release gate. The current WebKit real OCR-worker smoke is green.

Location scoring is deliberately conservative. Future de-identified real-photo calibration may tune the geometry curves, but such tuning must retain the `0.80` threshold and production-path no-false-red regressions.

## Commits

- `b473448` — implementation, unit/integration tests, and built-worker Chromium E2E.
- The report itself is added by the following documentation commit.
