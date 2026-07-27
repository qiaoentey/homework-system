# Homework Checker PWA

Offline-first, on-device support for checking a photographed primary-school mathematics worksheet. It is a conservative helper: only a clear, fully parsed mismatch with confident OCR and question location becomes red. Incomplete, low-confidence, unsupported, ambiguous, or unstated-rounding work stays orange for adult review.

The app needs no login, hosted backend, analytics account, paid API, or remote OCR service. It is published as a static PWA on GitHub Pages.

## Use the published app

Open [Homework Checker](https://qiaoentey.github.io/homework-system/). The two feature pages use static-host-safe hash links:

- [Answer library](https://qiaoentey.github.io/homework-system/#/answers)
- [Mathematics checker](https://qiaoentey.github.io/homework-system/#/scan)

The first scan must be online so the browser can download and cache the local OCR model. After that first-use download, the installed app, all three routes, the bundled answer-library PDFs, and scanning work offline on the same device.

Student worksheet photos remain local to the browser/device: they are never uploaded to GitHub Pages, GitHub Actions, an application server, an analytics service, or a remote OCR service.

Publishing is gated by `.github/workflows/homework-checker-ci.yml`. A push to `main` first runs **Homework checker CI**, including the dependency audit and browser suite. Only a successful completed CI run for a `main` push can trigger **Homework checker Pages**, which repeats the unit tests, builds and verifies the `/homework-system/` production output, uploads the Pages artifact, and deploys it. Failed CI, pull-request runs, and non-`main` branches cannot deploy.

## Run locally

```bash
cd homework-checker
npm ci
npm run dev
```

The release checks are:

```bash
npm test
npm run build
npm audit --audit-level=high
npm run test:e2e
```

`dist/` contains the installable PWA, 12 local PDF resources, local OCR runtime, and application icons. The six synthetic OCR fixtures can be regenerated with `node tests/fixtures/generateCalibrationSamples.mjs` when the local Playwright Chromium browser is installed.

## Privacy, offline use, and updates

- A selected photo is decoded, enhanced, OCRed, annotated, and exported only in the current browser/device. It is never sent in an HTTP request, written to localStorage/IndexedDB, or added to analytics.
- Temporary photo `blob:` URLs and decoded bitmaps live only for the current session. They are released when the photo is replaced, cleared, or the page closes.
- The OCR raster and preview are enhanced grayscale at no more than 1600 pixels per side. Only an explicit **Download annotated image** action decodes the unchanged color source file again and maps active annotations onto its EXIF-oriented source-resolution raster.
- CPU-intensive 3×3 enhancement runs in a dedicated Worker. Replacing a photo aborts and terminates stale preparation; allocation failure retries once at a 1200-pixel maximum.
- JPEG/PNG encoded dimensions are checked before decode when possible, and every decoded source is capped at 12 megapixels before a working canvas is allocated. Export applies the same 12-megapixel cap. Browser decode overhead varies, so low-memory physical devices remain a release test rather than relying on a theoretical peak-memory claim.
- The approximately 26 MB OCR model is intentionally absent from the install precache. The first scan needs a connection; after the model is cached, scanning and all three app routes work offline.
- New application workers wait. The user sees an update prompt and chooses when to activate/reload, so an in-progress scan is not silently moved onto a new asset set. OCR cache names are derived from bundled OCR content, and activation removes only obsolete Homework Checker OCR caches.

The browser privacy calibration listens to every request after upload. It permits only body-free GETs to same-origin static application/OCR resources, rejects unexpected paths and WebSockets, and checks URLs/bodies for image encodings and recognized worksheet text. YouTube opens only after a person deliberately chooses an external video.

## OCR provenance and licence

The bundled worker is [Tesseract.js](https://github.com/naptha/tesseract.js) 7.0.0 and its core, licensed Apache-2.0. Bundled English (`eng`), Malay (`msa`), and Traditional Chinese (`chi_tra`) trained-data packages come from [tesseract.js-data / tessdata](https://github.com/naptha/tessdata), version 1.0.0, licensed MIT. They are served from `/ocr/`; no third-party OCR endpoint is contacted.

The real preprocessing and OCR worker stack passes the current Playwright WebKit/iPhone smoke test as well as Chromium calibration. This automated result does not replace testing on physical Safari/iPhone and Chrome/Android devices.

## Deterministic checking scope

Supported checks use one exact rational-number domain across whole numbers, finite decimals, percentages, and fractions. They cover the four arithmetic operators, parentheses, a limited approved unit set (length, mass, volume, money, time, and area), and an explicit bounded `x … = …, x = …` one-variable linear-equation form. Money is compared after half-up quantization to sen. A repeating result written as a decimal without stated rounding precision is reviewed, never marked red.

The parser is allow-listed and bounded to 160 source characters and 64 tokens. It never executes recognized text. It does not solve word problems, infer missing work, award method marks, grade handwriting quality, or verify diagrams, geometry drawings, graphs, nonlinear/non-unique algebra, unlisted units, or unspecified rounding. OCR is inherently fallible: orange needs human review, and green is assistance rather than a guarantee.

## Calibration baseline (2026-07-27)

All six 1000×1400 fixtures are programmatically created, visibly labelled **SYNTHETIC SAMPLE — NO PERSONAL DATA**, and contain no student, school, class, teacher, or identity information. They cover Grades 1–6, clean typed work, a camera-angle page, handwriting-style text, decimals, thousands, currency, units, simple equations, fractions, one deliberate wrong answer, and deliberately unjudgeable work. Expected boxes/outcomes live only in `tests/fixtures/expected-annotations.json`; the app never receives them.

The production Chromium Workers processed the six pages in 888–928 ms each (901 ms mean). They segmented all 18 questions, matched 17/18 complete normalized equation strings exactly, and achieved 174/175 normalized key characters (99.43%). The known Grade 3 OCR substitution stayed orange. The result gate recorded:

- 1/1 deliberate wrong answer red;
- 0 correct answers red;
- 2/2 deliberately unjudgeable answers orange;
- 14 green, 3 orange, and 1 red annotation overall.

The companion audit observed 78 same-origin static HTTP requests and 12 browser-local `blob:` reads across the six isolated page runs, with no request body, WebSocket, cross-origin request, image/base64/blob payload, or recognized worksheet text leaving the browser. Current WebKit also completed a real-worker Grade 2 smoke with all three targets.

## Answer-library assets

The 12 files in `public/pdf/` are local answer/video-index documents for Grades 1–3 and four listed subjects. Tests fetch every production-built asset and require a non-empty `%PDF-` response. They are not OCR training data and are not represented as official textbook answer keys.

The complete 34-video inventory is asserted in `tests/catalog.test.ts`. Every entry is labelled `external-unverified` with a catalog review date; inclusion does not assert that a third-party video is still available or licensed for redistribution. Review source, permission, and link status before replacing or releasing any entry.

## Install on a phone

- **Android / Chrome:** while online, open the site and use the browser menu → **Install app** or **Add to Home screen** → confirm. Complete one scan to cache the local OCR model.
- **iPhone / Safari:** while online, open the site in Safari, tap **Share** → **Add to Home Screen** → **Add**. Launch from the icon and complete one scan before relying on offline OCR.

## Add a grade or subject

1. Add a de-identified local PDF index to `public/pdf/`; never add student work or personal information.
2. Extend the `Grade`/`Subject` unions and `ANSWER_RESOURCES` in `src/answer-library/catalog.ts`, keeping a unique ID, local path, deliberate video inventory, and explicit link-status metadata.
3. Update the exact catalog/PDF tests and confirm the asset is present in `dist/pdf/` after `npm run build`.
4. Add synthetic calibration material if the content changes OCR/checker assumptions. Extend deterministic parsing only with tests; unsupported content must remain orange.

## Production release gates

Before any production deployment, complete the automated CI job and record physical-device evidence on at least one current iPhone/Safari and Android/Chrome device:

1. first install online, first OCR-model download, airplane-mode relaunch, and direct `/`, `/scan`, and `/answers` loads;
2. camera and gallery photos across the supported worksheet styles, including a deliberate wrong answer and an unjudgeable answer;
3. manual crop alignment, annotation edit/cancel/restore, and source-color/source-resolution EXIF-correct export;
4. replacement of a photo during preparation/export, a memory-constrained large-photo attempt, and accepting an update only after a scan finishes;
5. zero red false positives in the approved calibration set.

## Dependency audit and CI

`.github/workflows/homework-checker-ci.yml` uses the lockfile to run `npm ci`, unit/component tests, the production build, blocking `npm audit --audit-level=high`, and the full Chromium/WebKit browser suite. It never invokes `npm audit fix --force`.

This environment did not receive permission to send dependency metadata to the public npm advisory service, so no fresh local audit result is claimed. A pre-existing review note reported eight high-severity findings; the CI audit therefore remains a deliberate production blocker until an approved registry run identifies the exact advisories and each lockfile path is upgraded or explicitly reviewed. Do not release based only on green offline tests.
