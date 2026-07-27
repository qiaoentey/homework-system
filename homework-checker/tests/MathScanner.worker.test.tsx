import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MathScanner } from "../src/scanner/MathScanner";
import { prepareImage } from "../src/scanner/imagePipeline";

vi.mock("../src/scanner/imagePipeline", () => ({
  prepareImage: vi.fn(),
  MAX_SOURCE_PIXELS: 12_000_000,
}));

vi.mock("../src/privacy/sessionAssets", () => ({
  createSessionAsset: vi.fn(() => ({ url: "blob:worksheet", release: vi.fn() })),
}));

type MockWorkerInstance = {
  onerror: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
};

const workers: MockWorkerInstance[] = [];
const prepared = {
  bitmap: {} as ImageBitmap,
  width: 8,
  height: 6,
  sourceWidth: 8,
  sourceHeight: 6,
  displayUrl: "blob:prepared",
  release: vi.fn(),
  toOriginal: vi.fn(),
};
const imageData = {
  data: new Uint8ClampedArray(8 * 6 * 4),
  width: 8,
  height: 6,
} as ImageData;

const installWorker = () => {
  class MockWorker implements MockWorkerInstance {
    onerror: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onmessageerror: ((event: MessageEvent) => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();

    constructor() {
      workers.push(this);
    }
  }
  vi.stubGlobal("Worker", MockWorker);
};

const uploadPreparedPhoto = async () => {
  const user = userEvent.setup();
  render(<MathScanner />);
  const albumInput = document.querySelectorAll<HTMLInputElement>('input[type="file"]')[1];
  await user.upload(albumInput, new File(["photo"], "worksheet.jpg", { type: "image/jpeg" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "开始检查" })).toBeEnabled());
};

describe("MathScanner OCR worker failures", () => {
  beforeEach(() => {
    workers.length = 0;
    vi.mocked(prepareImage).mockResolvedValue(prepared);
    installWorker();
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName !== "canvas") return createElement(tagName);
      const canvas = createElement(tagName);
      vi.spyOn(canvas, "getContext").mockReturnValue({
        drawImage: vi.fn(),
        getImageData: () => imageData,
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        strokeRect: vi.fn(),
      } as unknown as CanvasRenderingContext2D);
      return canvas;
    }) as typeof document.createElement);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows a recoverable message when the module worker cannot be created", async () => {
    class ThrowingWorker {
      constructor() {
        throw new Error("blocked by CSP");
      }
    }
    vi.stubGlobal("Worker", ThrowingWorker);
    await uploadPreparedPhoto();

    await userEvent.setup().click(screen.getByRole("button", { name: "开始检查" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("无法启动本机文字识别");
    expect(screen.getByRole("button", { name: "开始检查" })).toBeEnabled();
  });

  it("cleans up and recovers when the module worker raises an error", async () => {
    await uploadPreparedPhoto();
    await userEvent.setup().click(screen.getByRole("button", { name: "开始检查" }));

    workers[0].onerror?.(new Event("error"));

    expect(await screen.findByRole("alert")).toHaveTextContent("本机文字识别进程已停止");
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "开始检查" })).toBeEnabled();
  });

  it("cleans up and recovers when worker messages cannot be deserialized", async () => {
    await uploadPreparedPhoto();
    await userEvent.setup().click(screen.getByRole("button", { name: "开始检查" }));

    workers[0].onmessageerror?.(new MessageEvent("messageerror"));

    expect(await screen.findByRole("alert")).toHaveTextContent("本机识别数据无法读取");
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "开始检查" })).toBeEnabled();
  });

  it("transfers the OCR pixel buffer to the module worker", async () => {
    await uploadPreparedPhoto();
    await userEvent.setup().click(screen.getByRole("button", { name: "开始检查" }));

    expect(workers[0].postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "recognize", image: imageData }),
      [imageData.data.buffer],
    );
  });

  it("maps a manual crop result back into full-image annotation coordinates", async () => {
    vi.mocked(prepareImage).mockResolvedValue({ ...prepared, width: 800, height: 1000 });
    await uploadPreparedPhoto();
    await userEvent.setup().click(screen.getByRole("button", { name: "开始检查" }));
    act(() => workers[0].onmessage?.(new MessageEvent("message", {
      data: { type: "result", lines: [] },
    })));
    expect(await screen.findByRole("alert")).toHaveTextContent("拖出一题");

    const frame = document.querySelector<HTMLElement>(".scanner__image-frame")!;
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue({
      x: 100, y: 50, left: 100, top: 50, right: 500, bottom: 550,
      width: 400, height: 500, toJSON: () => ({}),
    });
    Object.defineProperty(frame, "setPointerCapture", { configurable: true, value: vi.fn() });
    fireEvent.pointerDown(frame, { pointerId: 1, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 250, clientY: 250 });
    fireEvent.pointerUp(frame, { pointerId: 1, clientX: 250, clientY: 250 });
    expect(workers[0].postMessage).toHaveBeenCalledTimes(2);

    act(() => workers[0].onmessage?.(new MessageEvent("message", {
      data: {
        type: "result",
        lines: [{
          text: "1) 47 + 28 = 65",
          confidence: 96,
          criticalConfidence: 96,
          box: { x: 50, y: 40, width: 100, height: 80 },
        }],
      },
    })));

    const target = await screen.findByRole("button", { name: "查看第 1 题错误" });
    expect(target).toHaveStyle({
      left: "18.75%",
      top: "24%",
      width: "12.5%",
      height: "8%",
    });
  });

  it("aborts stale image preparation before starting the replacement", async () => {
    const pending: Array<{
      signal: AbortSignal;
      resolve: (value: typeof prepared) => void;
    }> = [];
    vi.mocked(prepareImage).mockImplementation((_file, _maxSide, options) => new Promise((resolve) => {
      pending.push({ signal: options!.signal!, resolve });
    }));
    render(<MathScanner />);
    const albumInput = screen.getByLabelText("从相册选择");

    fireEvent.change(albumInput, {
      target: { files: [new File(["a"], "a.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent.change(albumInput, {
      target: { files: [new File(["b"], "b.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => expect(pending).toHaveLength(2));

    expect(pending[0].signal.aborted).toBe(true);
    expect(pending[1].signal.aborted).toBe(false);
    pending[1].resolve(prepared);
    await waitFor(() => expect(screen.getByRole("button", { name: "开始检查" })).toBeEnabled());
  });
});
