import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MathScanner } from "../src/scanner/MathScanner";
import { prepareImage } from "../src/scanner/imagePipeline";

vi.mock("../src/scanner/imagePipeline", () => ({
  prepareImage: vi.fn(),
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
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn(), getImageData: () => imageData }),
      } as unknown as HTMLCanvasElement;
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
});
