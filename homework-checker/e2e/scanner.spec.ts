import { expect, test } from "playwright/test";
import { fileURLToPath } from "node:url";

// A generic application icon is a fixed, non-personal image fixture.
const deidentifiedWorksheet = fileURLToPath(new URL("../node_modules/playwright-core/lib/tools/dashboard/appIcon.png", import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    class FixedOcrWorker {
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onmessageerror: ((event: MessageEvent) => void) | null = null;

      postMessage() {
        this.onmessage?.({ data: { type: "progress", stage: "识别文字", progress: 0.6 } } as MessageEvent);
        window.setTimeout(() => this.onmessage?.({
          data: {
            type: "result",
            lines: [
              { text: "47 + 28 = 65", confidence: 96, criticalConfidence: 96, box: { x: 40, y: 80, width: 360, height: 60 } },
              { text: "8 + 5 =", confidence: 96, criticalConfidence: 96, box: { x: 40, y: 280, width: 260, height: 60 } },
            ],
          },
        } as MessageEvent), 120);
      }

      terminate() {}
    }
    const RoutedWorker = new Proxy(NativeWorker, {
      construct(target, args) {
        return String(args[0]).includes("imagePreprocess.worker")
          ? Reflect.construct(target, args)
          : new FixedOcrWorker();
      },
    });
    Object.defineProperty(window, "Worker", { configurable: true, value: RoutedWorker });
  });
});

test("reviews a fixed local OCR result without running a real OCR model", async ({ page }) => {
  await page.goto("/scan");
  await page.getByLabel("从相册选择").setInputFiles(deidentifiedWorksheet);
  await expect(page.getByRole("button", { name: "开始检查" })).toBeEnabled();

  await page.getByRole("button", { name: "开始检查" }).click();
  await expect(page.getByText("识别文字… 60%")).toBeVisible();
  await expect(page.getByText("发现 1 个确定错误，1 个需要复核")).toBeVisible();
  await expect(page.locator(".annotation-canvas__target--error")).toHaveCount(1);
  await expect(page.locator(".annotation-canvas__target--review")).toHaveCount(1);

  await page.getByRole("button", { name: "查看第 1 题错误" }).click();
  await page.getByLabel("识别内容").fill("47 + 28 = 75");
  await page.getByRole("button", { name: "系统读错了" }).click();
  await expect(page.getByRole("heading", { name: "答案正确" })).toBeVisible();
  await page.getByRole("button", { name: "恢复识别内容" }).click();
  await expect(page.getByRole("heading", { name: "确定错误" })).toBeVisible();
  await expect(page.getByLabel("识别内容")).toHaveValue("47 + 28 = 65");

  await page.getByRole("button", { name: "取消标记" }).click();
  await expect(page.locator(".annotation-canvas__target--error")).toHaveCount(0);
  const canceledResult = page.getByRole("button", { name: "打开第 1 题结果（已取消）" });
  const hitTarget = await canceledResult.boundingBox();
  expect(hitTarget?.height).toBeGreaterThanOrEqual(44);
  await canceledResult.click();
  await expect(page.getByRole("heading", { name: "此标记已取消" })).toBeVisible();
  await page.getByRole("button", { name: "恢复标记" }).click();
  await expect(page.locator(".annotation-canvas__target--error")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "确定错误" })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载批改图" }).click();
  expect((await download).suggestedFilename()).toMatch(/^数学批改-\d{8}-\d{4}\.jpg$/);
});
