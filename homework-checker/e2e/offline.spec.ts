import { expect, test } from "playwright/test";

const sciencePdf = "/pdf/3年级_科学_活动本答案影片索引.pdf";

test("keeps the answer library and a precached PDF available offline", async ({ page, context, browserName }) => {
  await page.goto("/");
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.getByRole("link", { name: "快速查答案" }).click();
  await page.getByRole("button", { name: "三年级" }).click();
  await page.getByRole("button", { name: "科学" }).click();
  await expect(page.getByRole("link", { name: "打开三年级科学 PDF" })).toBeVisible();

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  if (browserName === "chromium") {
    const home = await page.evaluate(async () => {
      const response = await fetch("/");
      return { ok: response.ok, html: await response.text() };
    });
    expect(home.ok).toBeTruthy();
    expect(home.html).toContain('<div id="root"></div>');
  }
  await expect(page.getByRole("link", { name: "打开三年级科学 PDF" })).toBeVisible();
  // Playwright's network emulation does not change navigator.onLine in every
  // engine, while the browser's offline event is what the UI consumes.
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByText("影片需要联网")).toBeVisible();

  // Playwright WebKit's offline emulator bypasses Service Worker (Load failed),
  // so Chromium verifies the actual offline request path; both projects verify
  // the offline-library UI state.
  if (browserName === "chromium") {
    const pdf = await page.evaluate(async (url) => {
      const response = await fetch(url);
      return { ok: response.ok, contentType: response.headers.get("content-type") };
    }, sciencePdf);
    expect(pdf.ok).toBeTruthy();
    expect(pdf.contentType).toContain("application/pdf");
  }
});
