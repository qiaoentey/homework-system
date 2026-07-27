import { expect, test } from "playwright/test";
import { fileURLToPath } from "node:url";
import { appPath } from "./support/appPaths";

const exifRotatedFixture = fileURLToPath(new URL("./fixtures/exif-orientation-6.jpg", import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const nativeCreateImageBitmap = window.createImageBitmap.bind(window);
    const NativeWorker = window.Worker;
    const decodedBitmaps: Array<{ width: number; height: number }> = [];
    Object.defineProperty(window, "createImageBitmap", {
      configurable: true,
      value: async (...args: Parameters<typeof createImageBitmap>) => {
        const bitmap = await nativeCreateImageBitmap(...args);
        if (args[0] instanceof File) decodedBitmaps.push({ width: bitmap.width, height: bitmap.height });
        return bitmap;
      },
    });
    Object.defineProperty(window, "__decodedBitmaps", { configurable: true, value: decodedBitmaps });

    class FixedOcrWorker {
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onmessageerror: ((event: MessageEvent) => void) | null = null;

      postMessage() {
        this.onmessage?.({
          data: {
            type: "result",
            lines: [{ text: "1 + 1 = 3", confidence: 96, criticalConfidence: 96, box: { x: 0, y: 0, width: 1, height: 1 } }],
          },
        } as MessageEvent);
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

test("keeps EXIF-decoded bitmap, display and PreparedImage original coordinates aligned", async ({ page }) => {
  await page.goto(appPath());
  await page.getByRole("link", { name: "拍照检查数学" }).click();
  await expect(page).toHaveURL(/#\/scan$/);
  await page.getByLabel("从相册选择").setInputFiles(exifRotatedFixture);
  await expect(page.getByRole("button", { name: "开始检查" })).toBeEnabled();
  await page.getByRole("button", { name: "开始检查" }).click();

  const dimensions = await page.locator(".annotation-canvas").evaluate((canvas) => {
    const image = canvas.querySelector("img")!;
    const overlay = canvas.querySelector("canvas")!;
    return {
      display: { width: image.naturalWidth, height: image.naturalHeight },
      original: { width: overlay.width, height: overlay.height },
      bitmap: (window as Window & { __decodedBitmaps: Array<{ width: number; height: number }> }).__decodedBitmaps[0],
    };
  });

  expect(dimensions.display).toEqual(dimensions.bitmap);
  expect(dimensions.original).toEqual(dimensions.bitmap);
});
