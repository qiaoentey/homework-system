import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type CalibrationSample = {
  file: string;
  expectedQuestionCount: number;
};

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
)) as { samples: Array<{ file: string; expectedAnnotations: Array<{ question: string }> }> };

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

const isStaticLocalRequest = (url: string) => {
  const parsed = new URL(url);
  return parsed.origin === "http://127.0.0.1:4174" && (
    parsed.pathname === "/" || parsed.pathname === "/scan" || parsed.pathname === "/manifest.webmanifest"
    || parsed.pathname.startsWith("/assets/") || parsed.pathname.startsWith("/icons/")
    || parsed.pathname.startsWith("/ocr/") || parsed.pathname === "/registerSW.js"
    || parsed.pathname === "/service-worker.js" || parsed.pathname === "/favicon.ico"
  );
};

test.describe("offline OCR calibration and privacy network audit", () => {
  test.setTimeout(180_000);

  test("uses the actual Chromium worker, marks no correct synthetic answer red, and uploads nothing", async ({ browserName, page }) => {
    test.skip(browserName !== "chromium", "OffscreenCanvas OCR calibration is measured on Chromium; the iPhone project remains covered by its normal UI E2E suite.");
    const requests: Array<{ url: string; method: string; postData: string | null }> = [];
    const browserErrors: string[] = [];
    page.on("request", (request) => {
      requests.push({ url: request.url(), method: request.method(), postData: request.postData() });
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
      await Promise.race([
        expect(page.locator(".annotation-canvas__target").first()).toBeVisible({ timeout: 150_000 }),
        expect(page.getByRole("alert")).toBeVisible({ timeout: 150_000 }).then(async () => {
          throw new Error(`Actual OCR worker failed: ${await page.getByRole("alert").textContent()}\n${browserErrors.join("\n")}`);
        }),
      ]);
      const elapsedMs = performance.now() - started;
      const targets = page.locator(".annotation-canvas__target");
      const questionCount = await targets.count();
      const recognized: string[] = [];
      for (let index = 0; index < questionCount; index += 1) {
        await targets.nth(index).click();
        recognized.push(await page.getByLabel("识别内容").inputValue());
      }
      const redCount = await page.locator(".annotation-canvas__target--error").count();
      const reviewCount = await page.locator(".annotation-canvas__target--review").count();
      const expected = expectedAnnotations.samples.find((item) => item.file.endsWith(sample.file))!.expectedAnnotations
        .map((item) => normalizedEquation(item.question));
      const actual = recognized.map(normalizedEquation);
      const distances = expected.map((equation) => Math.min(...actual.map((candidate) => levenshteinDistance(equation, candidate))));
      const exactEquationCount = distances.filter((distance) => distance === 0).length;
      const keyCharacterAccuracy = (expected.join("").length - distances.reduce((sum, distance) => sum + distance, 0))
        / expected.join("").length;

      // This is deliberately conservative: if real OCR is uncertain, its
      // orange review marker is acceptable; a correct calibration answer must
      // never become a red error. Expected equations remain test data only and
      // are not passed to application code.
      expect(redCount, `${sample.file} must have no red false positive`).toBe(0);
      expect(questionCount, `${sample.file} should yield recognizable questions`).toBeGreaterThanOrEqual(sample.expectedQuestionCount);
      calibration.push({
        file: sample.file, elapsedMs: Math.round(elapsedMs), questionCount, redCount, reviewCount,
        exactEquationCount, expectedEquationCount: expected.length, keyCharacterAccuracy, recognized,
      });
    }

    const networkRequests = requests.filter(({ url }) => {
      const protocol = new URL(url).protocol;
      return protocol === "http:" || protocol === "https:";
    });
    const requestAudit = requests.map(({ url, method, postData }) => ({
      url,
      method,
      hasBody: Boolean(postData),
      protocol: new URL(url).protocol,
    }));
    expect(networkRequests.every((request) => request.method === "GET" && !request.postData)).toBe(true);
    expect(networkRequests.filter((request) => !isStaticLocalRequest(request.url)).map((request) => request.url)).toEqual([]);
    expect(networkRequests.some((request) => /base64|blob:|8 \+ 5|synthetic/i.test(`${request.url}\n${request.postData ?? ""}`))).toBe(false);
    console.log(JSON.stringify({ calibration, networkRequestCount: networkRequests.length, localBlobRequestCount: requests.length - networkRequests.length }));
    await test.info().attach("ocr-calibration-and-network-audit.json", {
      body: JSON.stringify({ calibration, requestAudit }, null, 2),
      contentType: "application/json",
    });
  });
});
