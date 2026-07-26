import { expect, test } from "playwright/test";

test("opens a grade 3 science PDF in three choices", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "快速查答案" }).click();
  await page.getByRole("button", { name: "三年级" }).click();
  await page.getByRole("button", { name: "科学" }).click();
  await expect(page.getByRole("link", { name: "打开三年级科学 PDF" }))
    .toHaveAttribute("href", "/pdf/3年级_科学_活动本答案影片索引.pdf");
});
