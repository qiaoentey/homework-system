# GitHub Pages Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the existing homework-checker PWA at `https://qiaoentey.github.io/homework-system/` with reliable project-subpath routing, offline OCR/PDF assets, and GitHub Actions deployment.

**Architecture:** Keep logical application routes as `/`, `/answers`, and `/scan`, but encode them in the URL hash so GitHub Pages always serves one real `index.html`. Make every public asset and Service Worker route deployment-base-aware, then build with Vite base `/homework-system/`. A Pages workflow deploys only after the existing full CI workflow succeeds on `main`.

**Tech Stack:** React 19, TypeScript, Vite 8, vite-plugin-pwa/Workbox, Vitest, Playwright, GitHub Actions, GitHub Pages, GitHub CLI.

## Global Constraints

- Public production URL is exactly `https://qiaoentey.github.io/homework-system/`.
- Repository target is the existing empty public repository `qiaoentey/homework-system`.
- Teachers never log in and never pay.
- Student photos and OCR text remain on the current device; no upload, analytics, backend, paid AI, or telemetry is added.
- The same site retains all twelve Grade 1–3 answer PDFs and Grade 1–6 local math checking.
- Local development and the existing root-path test mode remain supported at `/`.
- The Pages production base is exactly `/homework-system/`.
- Pages deployment must not occur after a failed dependency audit, unit test, build, Chromium/WebKit browser test, or privacy calibration.
- Existing user-owned untracked paths `.DS_Store`, `audit/`, `output/`, `scripts/`, and `tmp/` are never staged.
- The local backup branch and worktree `codex/homework-checker-pwa` remain untouched.

---

### Task 1: Hash router compatible with static hosting

**Files:**
- Modify: `homework-checker/src/app/routes.ts`
- Modify: `homework-checker/src/app/App.tsx`
- Modify: `homework-checker/tests/app.test.tsx`

**Interfaces:**
- Consumes: existing `AppRoute = "/" | "/answers" | "/scan"`.
- Produces: `routeFromHash(hash: string): AppRoute` and `hashForRoute(route: AppRoute): string`.

- [ ] **Step 1: Add failing route-boundary tests**

Add these assertions to `homework-checker/tests/app.test.tsx`:

```ts
import { hashForRoute, routeFromHash } from "../src/app/routes";

it.each([
  ["", "/"],
  ["#/", "/"],
  ["#/answers", "/answers"],
  ["#/scan", "/scan"],
  ["#/unknown", "/"],
] as const)("maps hash %s to route %s", (hash, route) => {
  expect(routeFromHash(hash)).toBe(route);
  expect(hashForRoute(route)).toBe(route === "/" ? "#/" : `#${route}`);
});

it("keeps the project pathname while navigating through hash routes", async () => {
  window.history.replaceState({}, "", "/homework-system/#/");
  render(<App />);
  await userEvent.setup().click(screen.getByRole("link", { name: "快速查答案" }));
  expect(window.location.pathname).toBe("/homework-system/");
  expect(window.location.hash).toBe("#/answers");
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
cd homework-checker
npm test -- tests/app.test.tsx
```

Expected: FAIL because `routeFromHash` and `hashForRoute` do not exist and `App` still uses `window.location.pathname`.

- [ ] **Step 3: Implement the minimal hash boundary**

Add to `homework-checker/src/app/routes.ts`:

```ts
export const routeFromHash = (hash: string): AppRoute => {
  const candidate = hash.startsWith("#") ? hash.slice(1) : hash;
  return isAppRoute(candidate) ? candidate : "/";
};

export const hashForRoute = (route: AppRoute) => `#${route}`;
```

In `homework-checker/src/app/App.tsx`:

- derive the current route from `window.location.hash`;
- listen for `hashchange`;
- navigate with `window.location.hash = hashForRoute(nextRoute)`;
- render relative link targets `#/`, `#/answers`, and `#/scan`.

Do not call `pushState` with `/answers` or `/scan`.

- [ ] **Step 4: Run focused and full unit tests**

Run:

```bash
npm test -- tests/app.test.tsx
npm test
```

Expected: both commands PASS; the full suite still reports zero failures.

- [ ] **Step 5: Commit Task 1**

```bash
git add homework-checker/src/app/routes.ts homework-checker/src/app/App.tsx homework-checker/tests/app.test.tsx
git commit -m "feat: use static-safe hash routes"
```

---

### Task 2: Base-aware PDF, OCR, manifest, and Service Worker paths

**Files:**
- Create: `homework-checker/src/pwa/deploymentPaths.ts`
- Create: `homework-checker/tests/deploymentPaths.test.ts`
- Modify: `homework-checker/src/answer-library/catalog.ts`
- Modify: `homework-checker/src/scanner/ocr.worker.ts`
- Modify: `homework-checker/src/pwa/cacheLifecycle.ts`
- Modify: `homework-checker/src/service-worker.ts`
- Modify: `homework-checker/index.html`
- Modify: `homework-checker/public/manifest.webmanifest`
- Modify: `homework-checker/tests/catalog.test.ts`
- Modify: `homework-checker/tests/pwaLifecycle.test.ts`

**Interfaces:**
- Produces:
  - `normalizeBasePath(basePath: string): string`
  - `pathInBase(basePath: string, relativePath: string): string`
  - `isPathInBase(pathname: string, basePath: string, relativePrefix: string): boolean`
- `isAppShellNavigation(url, mode, origin, basePath)` consumes the normalized deployment base.

- [ ] **Step 1: Write failing deployment-path tests**

Create `homework-checker/tests/deploymentPaths.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  isPathInBase,
  normalizeBasePath,
  pathInBase,
} from "../src/pwa/deploymentPaths";

describe("deployment paths", () => {
  it.each([
    ["/", "/"],
    ["/homework-system", "/homework-system/"],
    ["/homework-system/", "/homework-system/"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeBasePath(input)).toBe(expected);
  });

  it("places resources inside the project base", () => {
    expect(pathInBase("/homework-system/", "ocr/eng.traineddata.gz"))
      .toBe("/homework-system/ocr/eng.traineddata.gz");
  });

  it("does not match another repository's OCR path", () => {
    expect(isPathInBase(
      "/other/ocr/eng.traineddata.gz",
      "/homework-system/",
      "ocr/",
    )).toBe(false);
  });
});
```

Extend `homework-checker/tests/pwaLifecycle.test.ts`:

```ts
expect(isAppShellNavigation(
  new URL("https://example.test/homework-system/"),
  "navigate",
  "https://example.test",
  "/homework-system/",
)).toBe(true);

expect(isAppShellNavigation(
  new URL("https://example.test/"),
  "navigate",
  "https://example.test",
  "/homework-system/",
)).toBe(false);
```

Change catalog expectations so every `pdfPath` is relative and begins with `pdf/`, never `/pdf/`.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```bash
npm test -- tests/deploymentPaths.test.ts tests/pwaLifecycle.test.ts tests/catalog.test.ts
```

Expected: FAIL because deployment path functions do not exist and catalog paths are root-absolute.

- [ ] **Step 3: Implement deployment path primitives**

Create `homework-checker/src/pwa/deploymentPaths.ts`:

```ts
export const normalizeBasePath = (basePath: string) => {
  const withLeadingSlash = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
};

export const pathInBase = (basePath: string, relativePath: string) =>
  `${normalizeBasePath(basePath)}${relativePath.replace(/^\/+/, "")}`;

export const isPathInBase = (
  pathname: string,
  basePath: string,
  relativePrefix: string,
) => pathname.startsWith(pathInBase(basePath, relativePrefix));
```

Use these primitives as follows:

- `catalog.ts`: store `pdf/${grade}年级_...pdf`.
- `ocr.worker.ts`: derive `const OCR_ROOT = pathInBase(import.meta.env.BASE_URL, "ocr")`, then use it for `langPath`, `corePath`, and `workerPath`.
- `cacheLifecycle.ts`: accept `basePath` in `isAppShellNavigation` and match only the normalized project root.
- `service-worker.ts`: derive the base from `import.meta.env.BASE_URL`; use `pathInBase` for `index.html` and `ocr/`.
- `index.html`: use `href="./manifest.webmanifest"`.
- `manifest.webmanifest`: use `"start_url": "./"`, `"scope": "./"`, and relative `icons/...` sources.

- [ ] **Step 4: Run focused and full unit tests**

Run:

```bash
npm test -- tests/deploymentPaths.test.ts tests/pwaLifecycle.test.ts tests/catalog.test.ts tests/ocr.worker.test.ts
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add homework-checker/src/pwa/deploymentPaths.ts homework-checker/tests/deploymentPaths.test.ts homework-checker/src/answer-library/catalog.ts homework-checker/src/scanner/ocr.worker.ts homework-checker/src/pwa/cacheLifecycle.ts homework-checker/src/service-worker.ts homework-checker/index.html homework-checker/public/manifest.webmanifest homework-checker/tests/catalog.test.ts homework-checker/tests/pwaLifecycle.test.ts
git commit -m "feat: support project-base assets"
```

---

### Task 3: Production Pages build contract

**Files:**
- Create: `homework-checker/scripts/verify-pages-build.mjs`
- Create: `homework-checker/tests/pagesBuildContract.test.ts`
- Modify: `homework-checker/package.json`
- Modify: `homework-checker/vite.config.ts`

**Interfaces:**
- Produces npm commands:
  - `npm run build:pages`
  - `npm run verify:pages`
- `dist/` must be deployable under `/homework-system/`.

- [ ] **Step 1: Write the failing build-contract test**

Create `homework-checker/tests/pagesBuildContract.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Pages build contract", () => {
  it("declares the fixed public base and verifier", () => {
    const packageJson = JSON.parse(readFileSync(
      new URL("../package.json", import.meta.url),
      "utf8",
    ));
    expect(packageJson.scripts["build:pages"]).toContain("/homework-system/");
    expect(packageJson.scripts["verify:pages"]).toContain("verify-pages-build.mjs");
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
npm test -- tests/pagesBuildContract.test.ts
```

Expected: FAIL because both scripts are absent.

- [ ] **Step 3: Add exact build and verification commands**

Add to `homework-checker/package.json`:

```json
"build:pages": "tsc --noEmit && vite build --base=/homework-system/",
"verify:pages": "node scripts/verify-pages-build.mjs"
```

Ensure `vite.config.ts` does not hard-code a conflicting `base`.

Create `homework-checker/scripts/verify-pages-build.mjs`. It must:

- read `dist/index.html`, `dist/manifest.webmanifest`, and `dist/service-worker.js`;
- require `/homework-system/assets/` in built HTML;
- require a relative manifest link;
- require manifest `start_url` and `scope` to be `./`;
- require the Service Worker to contain `/homework-system/index.html` and `/homework-system/ocr/`;
- reject root-absolute `"/ocr/`, `"/pdf/`, `"/icons/`, and `"/assets/` references;
- exit non-zero with a precise message for any violation.

- [ ] **Step 4: Run RED-to-GREEN build evidence**

Run:

```bash
npm test -- tests/pagesBuildContract.test.ts
npm run build:pages
npm run verify:pages
```

Expected: all three commands PASS. Record the generated precache count and confirm the twelve PDFs are present in the Service Worker manifest.

- [ ] **Step 5: Commit Task 3**

```bash
git add homework-checker/package.json homework-checker/package-lock.json homework-checker/vite.config.ts homework-checker/scripts/verify-pages-build.mjs homework-checker/tests/pagesBuildContract.test.ts
git commit -m "build: add Pages production contract"
```

---

### Task 4: Run the browser suite at both root and project base

**Files:**
- Create: `homework-checker/e2e/support/appPaths.ts`
- Modify: `homework-checker/playwright.config.ts`
- Modify: `homework-checker/package.json`
- Modify: `homework-checker/e2e/answer-library.spec.ts`
- Modify: `homework-checker/e2e/image-orientation.spec.ts`
- Modify: `homework-checker/e2e/offline.spec.ts`
- Modify: `homework-checker/e2e/privacy-calibration.spec.ts`
- Modify: `homework-checker/e2e/pwa-update.spec.ts`
- Modify: `homework-checker/e2e/scanner.spec.ts`

**Interfaces:**
- Produces:
  - `APP_BASE_PATH`
  - `appPath(relativePath?: string): string`
  - `stripAppBase(pathname: string): string`
- Produces npm command `npm run test:e2e:pages`.

- [ ] **Step 1: Add the failing Pages browser command**

Add to `package.json`:

```json
"test:e2e:pages": "PAGES_BASE_PATH=/homework-system/ playwright test"
```

Create `e2e/support/appPaths.ts`:

```ts
const configured = process.env.PAGES_BASE_PATH ?? "/";
export const APP_BASE_PATH = configured.endsWith("/") ? configured : `${configured}/`;

export const appPath = (relativePath = "") =>
  `${APP_BASE_PATH}${relativePath.replace(/^\/+/, "")}`;

export const stripAppBase = (pathname: string) =>
  pathname.startsWith(APP_BASE_PATH)
    ? `/${pathname.slice(APP_BASE_PATH.length)}`
    : pathname;
```

Add a small assertion in `answer-library.spec.ts` that the loaded URL pathname equals `appPath()`.

- [ ] **Step 2: Run Pages E2E and confirm RED**

Run:

```bash
npm run test:e2e:pages -- e2e/answer-library.spec.ts --project=chromium-android
```

Expected: FAIL because Playwright still builds the root version and tests navigate to `/`.

- [ ] **Step 3: Make Playwright and all E2E resources base-aware**

In `playwright.config.ts`:

```ts
const pagesBasePath = process.env.PAGES_BASE_PATH ?? "/";
const buildCommand = pagesBasePath === "/"
  ? "npm run build"
  : "npm run build:pages";
```

Use `buildCommand` in `webServer.command`.

Across every E2E file:

- replace `page.goto("/")` with `page.goto(appPath())`;
- replace root-absolute PDF, OCR, Service Worker, manifest, and route paths with `appPath(...)`;
- normalize audited request pathnames with `stripAppBase`;
- keep YouTube as the only permitted external navigation;
- preserve the exact true-red, zero-false-red, orange-review, and no-upload assertions.

Hash route checks must click the UI and expect `#/answers` or `#/scan`; do not request a nonexistent `/homework-system/scan` server path.

- [ ] **Step 4: Run focused, root, and Pages browser suites**

Run:

```bash
npm run test:e2e -- e2e/answer-library.spec.ts e2e/offline.spec.ts --project=chromium-android
npm run test:e2e:pages -- e2e/answer-library.spec.ts e2e/offline.spec.ts --project=chromium-android
npm run test:e2e
npm run test:e2e:pages
```

Expected:

- focused root and Pages commands PASS;
- full root and Pages suites each report zero failures;
- Chromium calibration remains at least one true red, exactly zero false reds, and at least one orange review;
- WebKit real-worker smoke passes in both modes.

- [ ] **Step 5: Commit Task 4**

```bash
git add homework-checker/e2e homework-checker/playwright.config.ts homework-checker/package.json homework-checker/package-lock.json
git commit -m "test: verify Pages project base"
```

---

### Task 5: Gate GitHub Pages deployment on successful CI

**Files:**
- Create: `.github/workflows/homework-checker-pages.yml`
- Create: `homework-checker/tests/pagesWorkflow.test.ts`
- Modify: `homework-checker/README.md`

**Interfaces:**
- Consumes successful workflow `Homework checker CI`.
- Produces GitHub Pages artifact and deployment URL.

- [ ] **Step 1: Write a failing workflow-structure test**

Create `homework-checker/tests/pagesWorkflow.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Pages workflow", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/homework-checker-pages.yml", import.meta.url),
    "utf8",
  );

  it("waits for the complete CI workflow on main", () => {
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain('workflows: ["Homework checker CI"]');
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'");
  });

  it("uses the official Pages artifact and deployment actions", () => {
    expect(workflow).toContain("actions/configure-pages@v5");
    expect(workflow).toContain("actions/upload-pages-artifact@v4");
    expect(workflow).toContain("actions/deploy-pages@v4");
    expect(workflow).toContain("pages: write");
    expect(workflow).toContain("id-token: write");
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
npm test -- tests/pagesWorkflow.test.ts
```

Expected: FAIL because the workflow file does not exist.

- [ ] **Step 3: Implement the gated Pages workflow**

Create `.github/workflows/homework-checker-pages.yml` with:

```yaml
name: Homework checker Pages

on:
  workflow_run:
    workflows: ["Homework checker CI"]
    types: [completed]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: homework-checker-pages
  cancel-in-progress: true

jobs:
  deploy:
    if: >-
      github.event.workflow_run.conclusion == 'success' &&
      github.event.workflow_run.event == 'push' &&
      github.event.workflow_run.head_branch == 'main'
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    defaults:
      run:
        working-directory: homework-checker
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha }}
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: homework-checker/package-lock.json
      - run: npm ci
      - run: npm test
      - run: npm run build:pages
      - run: npm run verify:pages
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v4
        with:
          path: homework-checker/dist
      - uses: actions/deploy-pages@v4
        id: deployment
```

Update `README.md` with the public URL, deployment flow, hash links, first-use OCR download, offline behavior, and explicit local-photo privacy statement.

- [ ] **Step 4: Run workflow and full repository checks**

Run:

```bash
npm test -- tests/pagesWorkflow.test.ts
npm test
npm run build
npm run build:pages
npm run verify:pages
git diff --check
```

Expected: every command exits zero.

- [ ] **Step 5: Commit Task 5**

```bash
git add .github/workflows/homework-checker-pages.yml homework-checker/tests/pagesWorkflow.test.ts homework-checker/README.md
git commit -m "ci: deploy homework checker to Pages"
```

---

### Task 6: Publish, monitor, and verify the public site

**Files:**
- Modify only if verification finds a real defect in Task 1–5 files.
- Do not stage `.DS_Store`, `audit/`, `output/`, `scripts/`, or `tmp/`.

**Interfaces:**
- GitHub repository: `qiaoentey/homework-system`.
- GitHub Pages URL: `https://qiaoentey.github.io/homework-system/`.

- [ ] **Step 1: Run the online dependency gate before publishing**

Run from `homework-checker/`:

```bash
npm audit --audit-level=high
```

Expected: exit zero. If exact advisories exist, inspect and fix them without `npm audit fix --force`, then rerun all affected tests.

- [ ] **Step 2: Run final local verification from current HEAD**

Run:

```bash
npm test
npm run build
npm run build:pages
npm run verify:pages
npm run test:e2e
npm run test:e2e:pages
```

Expected: zero failures in both root and Pages modes.

- [ ] **Step 3: Connect the existing empty GitHub repository**

From the repository root:

```bash
git remote add origin https://github.com/qiaoentey/homework-system.git
git remote -v
```

Expected: `origin` fetch and push URLs both point to `qiaoentey/homework-system`.

- [ ] **Step 4: Push `main` and enable workflow-based Pages**

Run with authenticated GitHub CLI:

```bash
git push -u origin main
gh api --method POST repos/qiaoentey/homework-system/pages -f build_type=workflow
```

The initial push establishes the remote default branch before Pages is configured. If the Pages API reports that a site already exists, inspect it and update `build_type` to `workflow` rather than recreating the repository.

- [ ] **Step 5: Monitor CI and Pages deployment**

Run:

```bash
gh run list --repo qiaoentey/homework-system --limit 10
gh run watch --repo qiaoentey/homework-system <ci-run-id> --exit-status
gh run watch --repo qiaoentey/homework-system <pages-run-id> --exit-status
gh api repos/qiaoentey/homework-system/pages
```

Expected:

- `Homework checker CI` succeeds;
- `Homework checker Pages` succeeds afterward;
- Pages API reports `status: built`;
- reported URL is `https://qiaoentey.github.io/homework-system/`.

- [ ] **Step 6: Verify the live site and privacy boundary**

Use the public URL and confirm:

```text
GET /homework-system/                         -> 200
GET /homework-system/manifest.webmanifest     -> 200
GET /homework-system/service-worker.js        -> 200
GET /homework-system/pdf/<one catalog PDF>    -> 200 application/pdf
GET /homework-system/ocr/eng.traineddata.gz   -> 200
```

In a mobile Chromium session:

- open the root URL;
- enter `#/answers` and open one PDF;
- enter `#/scan`;
- load the Grade 1–6 calibration samples;
- confirm at least one true red, zero false reds, and at least one orange review;
- confirm every photo/OCR request remains same-origin or local `blob:`;
- confirm no student image, OCR line, analytics event, credential, or payment data is sent externally.

- [ ] **Step 7: Record the deployment**

Add a short deployment record to:

`docs/superpowers/plans/2026-07-27-github-pages-publishing.md`

Include:

- final Git commit SHA;
- CI and Pages run URLs;
- public site URL;
- root and Pages test counts;
- dependency-audit result;
- live HTTP and privacy verification result;
- remaining physical iPhone/Safari and Android/Chrome checklist items.

Commit only that plan file:

```bash
git add docs/superpowers/plans/2026-07-27-github-pages-publishing.md
git commit -m "docs: record Pages deployment"
git push origin main
```
