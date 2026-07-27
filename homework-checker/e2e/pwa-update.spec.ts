import { expect, test } from "playwright/test";
import { APP_BASE_PATH, appPath } from "./support/appPaths";

const OCR_CACHE_PREFIX = "homework-checker-ocr-";
const OBSOLETE_OCR_CACHE = `${OCR_CACHE_PREFIX}obsolete-update-test`;
const NON_OCR_CACHE = "update-cycle-non-ocr-cache";
const LOAD_COUNT_KEY = "homework-checker-update-cycle-loads";

test("activates the built waiting worker once and cleans only obsolete OCR caches", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "chromium", "The deterministic built-worker update cycle runs in Chromium.");

  await page.addInitScript(({ expectedOrigin, loadCountKey }) => {
    if (location.origin !== expectedOrigin) return;
    const previous = Number.parseInt(sessionStorage.getItem(loadCountKey) ?? "0", 10);
    sessionStorage.setItem(loadCountKey, String(previous + 1));
  }, {
    expectedOrigin: "http://127.0.0.1:4174",
    loadCountKey: LOAD_COUNT_KEY,
  });

  await page.goto(appPath());
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  const baselineLoadCount = await page.evaluate(
    (key) => Number.parseInt(sessionStorage.getItem(key) ?? "0", 10),
    LOAD_COUNT_KEY,
  );
  const currentOcrCache = await page.evaluate(async ({ prefix, workerUrl }) => {
    const response = await fetch(workerUrl);
    if (!response.ok) throw new Error("Unable to seed the current OCR cache");
    return (await caches.keys()).find((name) => name.startsWith(prefix));
  }, { prefix: OCR_CACHE_PREFIX, workerUrl: appPath("ocr/tesseract-worker.min.js") });
  expect(currentOcrCache).toBeTruthy();
  await page.evaluate(async ({ obsolete, unrelated }) => {
    await caches.open(obsolete);
    await caches.open(unrelated);
  }, { obsolete: OBSOLETE_OCR_CACHE, unrelated: NON_OCR_CACHE });

  const updateUrl = appPath(`service-worker.js?update-cycle=${Date.now()}`);
  const waitingScript = await page.evaluate(async ({ scriptUrl, scope }) => {
    const registration = await navigator.serviceWorker.register(scriptUrl, { scope });
    const deadline = Date.now() + 10_000;
    while (!registration.waiting && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return registration.waiting?.scriptURL;
  }, { scriptUrl: updateUrl, scope: APP_BASE_PATH });
  expect(waitingScript).toContain(updateUrl);
  await expect(page.getByRole("status")).toContainText("新版本已准备好");

  await page.getByRole("button", { name: "更新并重新载入" }).click();
  await page.waitForFunction(
    ({ key, expected }) => Number.parseInt(sessionStorage.getItem(key) ?? "0", 10) === expected,
    { key: LOAD_COUNT_KEY, expected: baselineLoadCount + 1 },
  );
  await page.waitForFunction(
    (scriptUrl) => navigator.serviceWorker.controller?.scriptURL.includes(scriptUrl),
    updateUrl,
  );

  await expect.poll(
    () => page.evaluate(() => caches.keys()),
  ).toEqual(expect.arrayContaining([currentOcrCache!, NON_OCR_CACHE]));
  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames).not.toContain(OBSOLETE_OCR_CACHE);

  await page.waitForTimeout(250);
  expect(await page.evaluate(
    (key) => Number.parseInt(sessionStorage.getItem(key) ?? "0", 10),
    LOAD_COUNT_KEY,
  )).toBe(baselineLoadCount + 1);
});
