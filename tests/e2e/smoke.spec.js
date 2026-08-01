import { expect, test } from "@playwright/test";
import { isReadOnlyHttpMethod } from "./policy.js";

test.beforeEach(async ({ baseURL, page }) => {
  const targetOrigin = new URL(baseURL).origin;
  await page.route("**/*", async (route) => {
    const request = route.request();
    const requestOrigin = new URL(request.url()).origin;
    if (
      requestOrigin === targetOrigin &&
      !isReadOnlyHttpMethod(request.method())
    ) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
});

test("external health endpoint is readable without mutation", async ({ page }) => {
  const response = await page.goto("/api/health");
  expect(response?.status()).toBe(200);
  await expect(page.locator("body")).toHaveText('{"ok":true}');
});

test("external entrance is reachable using GET requests only", async ({ page }) => {
  await page.goto("/");
  const login = page.getByRole("heading", { name: "登录点名系统" });
  const branches = page.getByRole("heading", { name: "请选择分院" });
  await expect(login.or(branches)).toBeVisible();

  if (await branches.isVisible()) {
    await expect(page.getByRole("group", { name: "分院选择" }).getByRole("button"))
      .toHaveText(["MK", "STP", "WS"]);
  } else {
    await expect(page.getByLabel("Google 登录")).toBeVisible();
    await expect(page.getByLabel("系统密码")).toHaveCount(0);
  }
});

test("external smoke guard blocks unsafe methods before dispatch", async ({ page }) => {
  await page.goto("/");
  const results = await page.evaluate(async () => Promise.all(
    ["POST", "PUT", "PATCH", "DELETE"].map(async (method) => {
      try {
        await fetch("/api/e2e-read-only-guard", { method });
        return "dispatched";
      } catch {
        return "blocked";
      }
    }),
  ));
  expect(results).toEqual(["blocked", "blocked", "blocked", "blocked"]);
});
