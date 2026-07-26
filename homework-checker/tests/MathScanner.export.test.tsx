import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MathScanner, type OcrWorkerFactory } from "../src/scanner/MathScanner";

vi.mock("../src/scanner/imagePipeline", () => ({ prepareImage: vi.fn() }));
vi.mock("../src/privacy/sessionAssets", () => ({
  createSessionAsset: vi.fn(() => ({ url: "blob:worksheet", release: vi.fn() })),
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

type DeferredImage = {
  onload: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  src: string;
  width: number;
  height: number;
};

const images: DeferredImage[] = [];

class FakeImage implements DeferredImage {
  onload: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  src = "";
  width = 800;
  height = 1000;

  constructor() {
    images.push(this);
  }
}

const fakeWorker: OcrWorkerFactory = () => {
  const worker = {
    onerror: null,
    onmessage: null as ((event: MessageEvent) => void) | null,
    onmessageerror: null,
    postMessage: () => queueMicrotask(() => worker.onmessage?.(new MessageEvent("message", {
      data: {
        type: "result",
        lines: [{ text: "47 + 28 = 65", confidence: 96, box: { x: 40, y: 90, width: 360, height: 60 } }],
      },
    }))),
    terminate: vi.fn(),
  };
  return worker as unknown as Worker;
};

const prepareScanner = async () => {
  const view = render(<MathScanner workerFactory={fakeWorker} />);
  fireEvent.change(screen.getByLabelText("从相册选择"), {
    target: { files: [new File(["math"], "worksheet.jpg", { type: "image/jpeg" })] },
  });
  await waitFor(() => expect(screen.getByRole("button", { name: "开始检查" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "开始检查" }));
  await screen.findByRole("button", { name: "下载批改图" });
  return view;
};

describe("MathScanner export lifecycle", () => {
  const objectUrl = vi.fn(() => "blob:annotated");
  const revokeObjectUrl = vi.fn();
  const anchorClick = vi.fn();

  beforeEach(() => {
    images.length = 0;
    objectUrl.mockClear();
    revokeObjectUrl.mockClear();
    anchorClick.mockClear();
    vi.mocked(prepareImage).mockResolvedValue(preparedImage);
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("URL", { createObjectURL: objectUrl, revokeObjectURL: revokeObjectUrl });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(anchorClick);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray(800 * 1000 * 4), width: 800, height: 1000 }),
      clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), strokeRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["jpeg"], { type: "image/jpeg" })));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not download or report an old export after its photo is cleared", async () => {
    await prepareScanner();
    fireEvent.click(screen.getByRole("button", { name: "下载批改图" }));
    expect(images).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "清除照片" }));
    await images[0].onload?.(new Event("load"));
    images[0].onerror?.(new Event("error"));
    await act(async () => undefined);

    expect(anchorClick).not.toHaveBeenCalled();
    expect(objectUrl).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not download or write an error from an old export after its photo is replaced", async () => {
    await prepareScanner();
    fireEvent.click(screen.getByRole("button", { name: "下载批改图" }));
    expect(images).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("从相册选择"), {
      target: { files: [new File(["new math"], "replacement.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "开始检查" })).toBeEnabled());
    await images[0].onload?.(new Event("load"));
    images[0].onerror?.(new Event("error"));
    fireEvent.click(screen.getByRole("button", { name: "开始检查" }));
    await screen.findByRole("button", { name: "下载批改图" });

    expect(anchorClick).not.toHaveBeenCalled();
    expect(objectUrl).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a successful download URL alive briefly before revoking it", async () => {
    await prepareScanner();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "下载批改图" }));

    await act(async () => { await images[0].onload?.(new Event("load")); });

    expect(anchorClick).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1_000); });
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:annotated");
  });

  it("revokes a pending download URL when the scanner unmounts", async () => {
    const view = await prepareScanner();
    fireEvent.click(screen.getByRole("button", { name: "下载批改图" }));
    await act(async () => { await images[0].onload?.(new Event("load")); });

    expect(revokeObjectUrl).not.toHaveBeenCalled();
    view.unmount();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:annotated");
  });
});
