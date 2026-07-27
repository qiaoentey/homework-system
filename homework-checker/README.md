# Homework Checker PWA

Offline-first, on-device support for checking a photographed primary-school mathematics worksheet. It is a conservative helper: clear arithmetic mismatches can be marked red, while incomplete, low-confidence, unsupported, or ambiguous recognition stays orange for adult review.

## Run locally

```bash
cd homework-checker
npm ci
npm run dev
```

For a release-quality check, run `npm test`, `npm run build`, then `npm run test:e2e`. `dist/` contains the installable PWA, 12 local PDF resources, local OCR assets, and application icons. The reproducible synthetic OCR fixtures can be regenerated with `node tests/fixtures/generateCalibrationSamples.mjs` (requires the locally installed Playwright Chromium browser).

## Privacy and network behaviour

- A chosen photo is decoded, normalized, OCRed, annotated, and exported only in this browser/device. It is never sent in an HTTP request, stored in localStorage/IndexedDB, or added to analytics.
- The app uses temporary `blob:` URLs only inside the current browser session and revokes them when the photo is replaced or cleared.
- The real-browser calibration test listens to every request after upload. It allows only GET requests to this site's static application/OCR resources; it rejects request bodies and any URL/body containing image data, `base64`, `blob:`, or recognized worksheet text. YouTube is opened only after a person explicitly selects a video from the answer library.
- OCR requires a current browser with `OffscreenCanvas` and module-worker support. It is verified on Chromium; Safari/iPhone has normal UI coverage but may show the built-in unsupported-browser recovery message if that platform lacks the required worker capability.

To keep memory bounded on phones, images over **12 megapixels** fail closed before a new canvas is created. Accepted photos are normalized to at most **1600 × 1600** pixels; preview, OCR, annotation and export share that one normalized coordinate space. The raw allocation estimate for the normalized pipeline is 17 bytes/pixel (canvas, `ImageData`, grayscale scratch, and returned bitmap), or **41.50 MiB** at 1600². With the allowed 12 MP decoded source, the bounded raw-pixel peak is **87.28 MiB**, before browser implementation overhead and compressed JPEG storage. Use a smaller photo if the device is memory constrained.

## OCR model provenance and licence

The bundled worker is [Tesseract.js](https://github.com/naptha/tesseract.js) 7.0.0 and its core, licensed Apache-2.0. The bundled English (`eng`), Malay (`msa`), and Traditional Chinese (`chi_tra`) trained-data packages are from [tesseract.js-data / tessdata](https://github.com/naptha/tessdata), version 1.0.0, licensed MIT. They are served from `/ocr/` with `cacheMethod: "none"`; no third-party OCR service is contacted.

## Scope and limitations

Supported deterministic checks are typed arithmetic expressions with whole numbers, decimals, fractions, the four arithmetic operators, and a limited set of approved primary-school units (length, mass, volume, money, time, and area). The checker does not solve word problems, infer missing work, grade handwriting, determine method marks, or verify diagrams, geometry drawings, graphs, algebra, or unlisted units. OCR is inherently fallible: an orange item needs human review, and a green-looking result is not a guarantee.

The three files in `public/samples/` are programmatically created **SYNTHETIC SAMPLE — NO PERSONAL DATA** worksheets. They contain no student, school, class, teacher, or other identity information. Their expected boxes and severity are in `tests/fixtures/expected-annotations.json`; expected equations are test data only and are never passed into scanner code.

### Chromium calibration baseline (2026-07-27)

The real Worker was measured through the production preview with `eng+msa+chi_tra`, not a mock. The three 1000×1400 synthetic pages took 1368 ms (Grade 1), 1353 ms (Grade 3), and 815 ms (Grade 6): 1179 ms/page mean. It segmented all 9 expected questions; normalized key-character accuracy was 93/94 (98.94%), with 8/9 complete equation strings exact. The known miss changed Grade 3 `1 l` to `11`, so it became orange rather than red. There were **0 red false positives** and 5 orange reviews. Launch gate: correct calibration answers must have zero red markers; ambiguous/low-confidence recognition must remain orange. The companion request audit observed 30 same-origin static GET requests (including local OCR models) and 6 browser-local `blob:` reads, with no HTTP request body, image/base64/blob payload, or OCR text leaving the browser.

## Answer-library PDFs

The 12 PDFs in `public/pdf/` are local *answer/video index* documents for Grades 1–3 and the four listed subjects. They are not OCR training data, are not represented as official textbook answer keys, and may contain links to third-party video material. Review the source and permission for each replacement before distribution.

## Install on a phone

- **Android / Chrome:** open the site, then use the browser menu → **Install app** or **Add to Home screen** → confirm.
- **iPhone / Safari:** open the site in Safari, tap **Share**, choose **Add to Home Screen**, then tap **Add**. Launch from the new icon for the standalone view.

## Add a grade or subject

1. Add a de-identified/local PDF index to `public/pdf/`; do not add student work or personal information.
2. Extend the `Grade`/`Subject` unions and `ANSWER_RESOURCES` in `src/answer-library/catalog.ts`, keeping a unique `id`, local `pdfPath`, and only deliberately selected video IDs.
3. Add catalogue tests and confirm the new PDF is in `dist/pdf/` after `npm run build`.
4. Add synthetic calibration material and annotations if the subject changes the OCR/checker assumptions. Extend the deterministic parser/checker only with tests; unsupported content must remain orange.

## Dependency audit and CI release gate

`package-lock.json` is committed and pins the currently resolved build/test toolchain (including Vite 8.1.5, Rollup 4.62.3, Playwright 1.62.0, and Tesseract.js 7.0.0). Do **not** use `npm audit fix --force`: it can make unreviewed breaking dependency changes.

The task's pre-existing audit note reported **8 high-severity findings**, but this workspace cannot make a fresh online `npm audit` request because the npm registry query would disclose the project's dependency metadata and was not granted. `npm audit --offline` has no cached advisory payload, so it cannot identify or truthfully restate individual advisories. Before release, CI with approved npm-registry access must run `npm ci && npm audit --audit-level=high`; a non-zero result blocks release and must be remediated by a reviewed, non-breaking version update or documented with its exact advisory/package/lockfile path. This is a build/CI supply-chain risk, not a runtime upload path.
