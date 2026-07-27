import { expect, test } from "playwright/test";
import { appPath } from "./support/appPaths";

test("opens a grade 3 science PDF in three choices", async ({ page }) => {
  await page.goto(appPath());
  expect(new URL(page.url()).pathname).toBe(appPath());
  await page.getByRole("link", { name: "快速查答案" }).click();
  await expect(page).toHaveURL(/#\/answers$/);
  await page.getByRole("button", { name: "三年级" }).click();
  await page.getByRole("button", { name: "科学" }).click();
  const pdfHref = await page.getByRole("link", { name: "打开三年级科学 PDF" }).getAttribute("href");
  expect(decodeURIComponent(new URL(pdfHref!, page.url()).pathname))
    .toBe(appPath("pdf/3年级_科学_活动本答案影片索引.pdf"));
});
