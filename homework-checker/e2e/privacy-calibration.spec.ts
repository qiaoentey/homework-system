import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type CalibrationSample = {
  file: string;
  expectedQuestionCount: number;
};

type Box = { x: number; y: number; width: number; height: number };
type ExpectedAnnotation = { question: string; severity: "error" | "review" | "pass"; box: Box };

const samples: CalibrationSample[] = [
  { file: "grade1-addition.jpg", expectedQuestionCount: 3 },
  { file: "grade3-units.jpg", expectedQuestionCount: 3 },
  { file: "grade6-fractions.jpg", expectedQuestionCount: 3 },
];

const samplePath = (file: string) =>
  fileURLToPath(new URL(`../public/samples/${file}`, import.meta.url));

const expectedAnnotations = JSON.parse(readFileSync(
  fileURLToPath(new URL("../tests/fixtures/expected-annotations.json", import.meta.url)),
  "utf8",
)) as { samples: Array<{ file: string; expectedAnnotations: ExpectedAnnotation[] }> };

const normalizedEquation = (text: string) => text
  .replace(/^\s*\d{1,3}[.)、，,]\s*/, "")
  .replaceAll(/\s/g, "")
  .replaceAll("×", "x");

const levenshteinDistance = (left: string, right: string) => {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const previous = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        diagonal + Number(left[leftIndex - 1] !== right[rightIndex - 1]),
      );
      diagonal = previous;
    }
  }
  return row[right.length];
};

const EXPECTED_ORIGIN = "http://127.0.0.1:4174";
const STATIC_PATHS = new Set(["/", "/scan", "/manifest.webmanifest", "/registerSW.js", "/service-worker.js", "/favicon.ico"]);
const STATIC_PREFIXES = ["/assets/", "/icons/", "/ocr/", "/pdf/"];

const isStaticLocalPath = (path: string) => STATIC_PATHS.has(path) || STATIC_PREFIXES.some((prefix) => path.startsWith(prefix));

const targetDetails = async (target: import("playwright/test").Locator) => target.evaluate((button) => {
  const canvas = button.parentElement?.querySelector("canvas");
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Annotation target has no coordinate canvas");
  const percentage = (value: string) => Number.parseFloat(value) / 100;
  const style = button.style;
  const severity = ["error", "review", "pass"].find((value) => button.classList.contains(`annotation-canvas__target--${value}`));
  if (!severity) throw new Error("Annotation target has no severity class");
  return {
    severity,
    box: {
      x: percentage(style.left) * canvas.width,
      y: percentage(style.top) * canvas.height,
      width: percentage(style.width) * canvas.width,
      height: percentage(style.height) * canvas.height,
    },
  };
});

const waitForOcrResult = async (page: import("playwright/test").Page, browserErrors: string[]) => {
  await expect.poll(async () => {
    if (await page.locator(".annotation-canvas__target").count()) return "result";
    if (await page.getByRole("alert").count()) return "error";
    return "waiting";
  }, { timeout: 45_000, message: "Local OCR must finish or report a recoverable error within 45 seconds." }).not.toBe("waiting");

  if (await page.getByRole("alert").count()) {
    throw new Error(`Actual OCR worker failed: ${await page.getByRole("alert").textContent()}\n${browserErrors.join("\n")}`);
  }
};

test.describe("offline OCR calibration and privacy network audit", () => {
  test.setTimeout(180_000);

  test("uses the actual Chromium worker, marks no correct synthetic answer red, and uploads nothing", async ({ browserName, page }) => {
    test.skip(browserName !== "chromium", "OffscreenCanvas OCR calibration is measured on Chromium; the iPhone project remains covered by its normal UI E2E suite.");
    const requests: Array<{ url: string; method: string; postData: string | null }> = [];
    const webSocketActivity: string[] = [];
    const browserErrors: string[] = [];
    page.on("request", (request) => {
      requests.push({ url: request.url(), method: request.method(), postData: request.postData() });
    });
    page.on("websocket", (socket) => {
      webSocketActivity.push(`created:${socket.url()}`);
      socket.on("framesent", (event) => webSocketActivity.push(`sent:${JSON.stringify(event.payload)}`));
      socket.on("framereceived", (event) => webSocketActivity.push(`received:${JSON.stringify(event.payload)}`));
    });
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));
    const calibration: Array<{
      file: string; elapsedMs: number; questionCount: number; redCount: number; reviewCount: number;
      exactEquationCount: number; expectedEquationCount: number; keyCharacterAccuracy: number; recognized: string[];
    }> = [];

    for (const sample of samples) {
      await page.goto("/scan");
      await page.getByLabel("从相册选择").setInputFiles(samplePath(sample.file));
      await expect(page.getByRole("button", { name: "开始检查" })).toBeEnabled();
      const started = performance.now();
      await page.getByRole("button", { name: "开始检查" }).click();
      await waitForOcrResult(page, browserErrors);
      const elapsedMs = performance.now() - started;
      const targets = page.locator(".annotation-canvas__target");
      const questionCount = await targets.count();
      const actualAnnotations: Array<{ recognized: string; severity: "error" | "review" | "pass"; box: Box }> = [];
      for (let index = 0; index < questionCount; index += 1) {
        const target = targets.nth(index);
        const details = await targetDetails(target);
        await target.click();
        actualAnnotations.push({
          recognized: await page.getByLabel("识别内容").inputValue(),
          severity: details.severity as "error" | "review" | "pass",
          box: details.box,
        });
      }
      const redCount = actualAnnotations.filter((item) => item.severity === "error").length;
      const reviewCount = actualAnnotations.filter((item) => item.severity === "review").length;
      const fixture = expectedAnnotations.samples.find((item) => item.file.endsWith(sample.file))!;
      const expected = fixture.expectedAnnotations;
      const expectedEquations = expected.map((item) => normalizedEquation(item.question));
      const actual = actualAnnotations.map((item) => normalizedEquation(item.recognized));
      const distances = expectedEquations.map((equation) => Math.min(...actual.map((candidate) => levenshteinDistance(equation, candidate))));
      const exactEquationCount = distances.filter((distance) => distance === 0).length;
      const keyCharacterAccuracy = (expectedEquations.join("").length - distances.reduce((sum, distance) => sum + distance, 0))
        / expectedEquations.join("").length;

      const unmatched = new Set(actualAnnotations.keys());
      for (const expectedAnnotation of expected) {
        const expectedText = normalizedEquation(expectedAnnotation.question);
        const match = [...unmatched]
          .map((index) => ({ index, distance: levenshteinDistance(expectedText, normalizedEquation(actualAnnotations[index].recognized)) }))
          .sort((left, right) => left.distance - right.distance)[0];
        expect(match, `${sample.file} must have a one-to-one target for ${expectedAnnotation.question}`).toBeDefined();
        expect(match!.distance, `${sample.file} OCR target must correspond to ${expectedAnnotation.question}`).toBeLessThanOrEqual(1);
        unmatched.delete(match!.index);
        const actualAnnotation = actualAnnotations[match!.index];
        expect(actualAnnotation.severity, `${sample.file} severity for ${expectedAnnotation.question}`).toBe(expectedAnnotation.severity);
        for (const coordinate of ["x", "y", "width", "height"] as const) {
          expect(
            Math.abs(actualAnnotation.box[coordinate] - expectedAnnotation.box[coordinate]),
            `${sample.file} ${expectedAnnotation.question} ${coordinate}`,
          ).toBeLessThanOrEqual(48);
        }
      }
      expect(unmatched, `${sample.file} should have no extra annotation targets`).toEqual(new Set());

      // This is deliberately conservative: if real OCR is uncertain, its
      // orange review marker is acceptable; a correct calibration answer must
      // never become a red error. Expected equations remain test data only and
      // are not passed to application code.
      expect(redCount, `${sample.file} must have no red false positive`).toBe(0);
      expect(questionCount, `${sample.file} should yield recognizable questions`).toBeGreaterThanOrEqual(sample.expectedQuestionCount);
      calibration.push({
        file: sample.file, elapsedMs: Math.round(elapsedMs), questionCount, redCount, reviewCount,
        exactEquationCount, expectedEquationCount: expected.length, keyCharacterAccuracy,
        recognized: actualAnnotations.map((item) => item.recognized),
      });
    }

    const networkRequests = requests.filter(({ url }) => ["http:", "https:"].includes(new URL(url).protocol));
    const sensitiveText = new Set([
      "SYNTHETIC SAMPLE — NO PERSONAL DATA",
      ...expectedAnnotations.samples.flatMap((sample) => sample.expectedAnnotations.map((annotation) => annotation.question)),
    ]);
    const requestAudit = requests.map(({ url, method, postData }) => ({
      url,
      method,
      hasBody: Boolean(postData),
      protocol: new URL(url).protocol,
    }));
    expect(webSocketActivity).toEqual([]);
    for (const request of networkRequests) {
      const parsed = new URL(request.url);
      const decoded = decodeURIComponent(request.url);
      expect(parsed.origin, `same-origin request: ${request.url}`).toBe(EXPECTED_ORIGIN);
      expect(request.method, `GET-only request: ${request.url}`).toBe("GET");
      expect(request.postData, `body-free request: ${request.url}`).toBeNull();
      expect(parsed.search, `query-free request: ${request.url}`).toBe("");
      expect(parsed.hash, `hash-free request: ${request.url}`).toBe("");
      expect(isStaticLocalPath(parsed.pathname), `allow-listed static path: ${request.url}`).toBe(true);
      for (const text of sensitiveText) expect(decoded.includes(text), `OCR text must not leave: ${text}`).toBe(false);
      expect(/base64|blob:/i.test(decoded), `encoded image/blob must not leave: ${request.url}`).toBe(false);
    }
    console.log(JSON.stringify({ calibration, networkRequestCount: networkRequests.length, localBlobRequestCount: requests.length - networkRequests.length }));
    await test.info().attach("ocr-calibration-and-network-audit.json", {
      body: JSON.stringify({ calibration, requestAudit }, null, 2),
      contentType: "application/json",
    });
  });
});
