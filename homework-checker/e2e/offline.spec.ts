import { expect, test } from "playwright/test";
import { ANSWER_RESOURCES } from "../src/answer-library/catalog";
import { appPath } from "./support/appPaths";

const sciencePdf = appPath("pdf/3年级_科学_活动本答案影片索引.pdf");

test("serves every catalogued local answer asset as a non-empty PDF", async ({ page }) => {
  await page.goto(appPath());
  for (const resource of ANSWER_RESOURCES) {
    const asset = await page.evaluate(async (path) => {
      const response = await fetch(path);
      const bytes = new Uint8Array(await response.arrayBuffer());
      return {
        ok: response.ok,
        contentType: response.headers.get("content-type"),
        prefix: String.fromCharCode(...bytes.slice(0, 5)),
        byteLength: bytes.byteLength,
      };
    }, appPath(resource.pdfPath));
    expect(asset.ok, resource.pdfPath).toBe(true);
    expect(asset.contentType, resource.pdfPath).toContain("application/pdf");
    expect(asset.prefix, resource.pdfPath).toBe("%PDF-");
    expect(asset.byteLength, resource.pdfPath).toBeGreaterThan(100);
  }
});

test("keeps the answer library and a precached PDF available offline", async ({ page, context, browserName }) => {
  await page.goto(appPath());
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  await context.setOffline(true);
  if (browserName === "webkit") {
    test.skip(true, "Playwright WebKit offline emulation bypasses the Service Worker fetch path (Load failed).");
  }

  await page.goto(appPath());
  await expect(page.getByRole("link", { name: "快速查答案" })).toBeVisible();
  await page.getByRole("link", { name: "快速查答案" }).click();
  await expect(page).toHaveURL(/#\/answers$/);
  await page.getByRole("button", { name: "三年级" }).click();
  await page.getByRole("button", { name: "科学" }).click();
  await expect(page.getByRole("link", { name: "打开三年级科学 PDF" })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByText("影片需要联网")).toBeVisible();

  const pdf = await page.evaluate(async (url) => {
    const response = await fetch(url);
    return { ok: response.ok, contentType: response.headers.get("content-type") };
  }, sciencePdf);
  expect(pdf.ok).toBeTruthy();
  expect(pdf.contentType).toContain("application/pdf");
});

test("loads every application route directly from the app shell while offline", async ({ page, context, browserName }) => {
  test.skip(browserName === "webkit", "Playwright WebKit offline emulation bypasses the Service Worker fetch path (Load failed).");
  await page.goto(appPath());
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);

  await expect(page.getByRole("heading", { name: "功课检查更轻松" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "功课检查更轻松" })).toBeVisible();

  await page.getByRole("link", { name: "快速查答案" }).click();
  await expect(page).toHaveURL(/#\/answers$/);
  await expect(page.getByRole("heading", { name: "快速查答案" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "快速查答案" })).toBeVisible();

  await page.getByRole("button", { name: "返回首页" }).click();
  await page.getByRole("link", { name: "拍照检查数学" }).click();
  await expect(page).toHaveURL(/#\/scan$/);
  await expect(page.getByRole("heading", { name: "拍照检查数学" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "拍照检查数学" })).toBeVisible();
});
