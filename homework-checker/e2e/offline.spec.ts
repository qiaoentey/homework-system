import { expect, test } from "playwright/test";

const sciencePdf = "/pdf/3年级_科学_活动本答案影片索引.pdf";

test("keeps the answer library and a precached PDF available offline", async ({ page, context, browserName }) => {
  await page.goto("/");
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  await context.setOffline(true);
  if (browserName === "webkit") {
    test.skip(true, "Playwright WebKit offline emulation bypasses the Service Worker fetch path (Load failed).");
  }

  await page.goto("/");
  await expect(page.getByRole("link", { name: "快速查答案" })).toBeVisible();
  await page.getByRole("link", { name: "快速查答案" }).click();
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
