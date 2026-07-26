import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app/App";
import { MathScanner, type OcrWorkerFactory } from "../src/scanner/MathScanner";

vi.mock("../src/scanner/imagePipeline", () => ({
  prepareImage: vi.fn(),
}));

vi.mock("../src/privacy/sessionAssets", () => ({
  createSessionAsset: vi.fn(() => ({ url: "blob:math-page", release: vi.fn() })),
}));

import { prepareImage } from "../src/scanner/imagePipeline";

const preparedImage = {
  bitmap: {} as ImageBitmap,
  width: 800,
  height: 1000,
  displayUrl: "blob:prepared",
  release: vi.fn(),
  toOriginal: (rect: { x: number; y: number; width: number; height: number }) => rect,
};

const fakeOcrWorker = (text: string): OcrWorkerFactory => () => {
  const worker = {
    onerror: null,
    onmessage: null as ((event: MessageEvent) => void) | null,
    onmessageerror: null,
    postMessage: () => queueMicrotask(() => worker.onmessage?.(new MessageEvent("message", {
      data: {
        type: "result",
        lines: [{ text, confidence: 96, box: { x: 40, y: 90, width: 360, height: 60 } }],
      },
    }))),
    terminate: vi.fn(),
  };
  return worker as unknown as Worker;
};

const selectImage = async (input: HTMLElement, name: string) => {
  await userEvent.setup().upload(input, new File(["math"], name, { type: "image/jpeg" }));
};

describe("App", () => {
  beforeEach(() => window.history.replaceState({}, "", "/"));

  it("opens grade 1 mathematics from the answer library", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("link", { name: "快速查答案" }));
    await user.click(screen.getByRole("button", { name: "一年级" }));
    await user.click(screen.getByRole("button", { name: "数学" }));
    expect(screen.getByRole("link", { name: "打开一年级数学 PDF" }))
      .toHaveAttribute("href", "/pdf/1年级_数学_活动本答案影片索引.pdf");
  });

  it("shows an editable result after local OCR finds a definite error", async () => {
    vi.mocked(prepareImage).mockResolvedValue(preparedImage);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray(800 * 1000 * 4), width: 800, height: 1000 }) as ImageData,
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      strokeRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    render(<MathScanner workerFactory={fakeOcrWorker("47 + 28 = 65")} />);
    await selectImage(screen.getByLabelText("从相册选择"), "math-page.jpg");
    await waitFor(() => expect(screen.getByRole("button", { name: "开始检查" })).toBeEnabled());
    await userEvent.setup().click(screen.getByRole("button", { name: "开始检查" }));

    expect(await screen.findByText("发现 1 个确定错误")).toBeVisible();
    expect(screen.getByRole("button", { name: "查看第 1 题错误" })).toBeVisible();
  });
});
