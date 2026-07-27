import { describe, expect, it, vi } from "vitest";
import { preprocessPixels } from "../src/scanner/imagePreprocess";
import { runImagePreprocessing } from "../src/scanner/imagePipeline";

type FakeWorker = {
  onerror: ((event: ErrorEvent) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
};

const workerHarness = () => {
  const worker: FakeWorker = {
    onerror: null,
    onmessage: null,
    onmessageerror: null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
  };
  return { worker, factory: () => worker as unknown as Worker };
};

describe("focused image preprocessing worker", () => {
  it("converts color pixels to enhanced grayscale without changing alpha", () => {
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 31,
      0, 255, 0, 63,
      0, 0, 255, 127,
      255, 255, 255, 255,
    ]);

    preprocessPixels(pixels, 2, 2);

    for (let offset = 0; offset < pixels.length; offset += 4) {
      expect(pixels[offset]).toBe(pixels[offset + 1]);
      expect(pixels[offset + 1]).toBe(pixels[offset + 2]);
    }
    expect([pixels[3], pixels[7], pixels[11], pixels[15]]).toEqual([31, 63, 127, 255]);
  });

  it("transfers pixels to a dedicated worker and terminates it after completion", async () => {
    const { worker, factory } = workerHarness();
    const pixels = new Uint8ClampedArray(4 * 3 * 2);
    const promise = runImagePreprocessing(
      { data: pixels, width: 3, height: 2 } as ImageData,
      { workerFactory: factory },
    );
    expect(worker.postMessage).toHaveBeenCalledWith(
      { type: "preprocess", width: 3, height: 2, pixels: pixels.buffer },
      [pixels.buffer],
    );

    worker.onmessage?.(new MessageEvent("message", {
      data: { type: "result", width: 3, height: 2, pixels: new Uint8ClampedArray(24).buffer },
    }));

    await expect(promise).resolves.toMatchObject({ width: 3, height: 2 });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("terminates immediately at the cancellation boundary and rejects with AbortError", async () => {
    const { worker, factory } = workerHarness();
    const controller = new AbortController();
    const promise = runImagePreprocessing(
      { data: new Uint8ClampedArray(16), width: 2, height: 2 } as ImageData,
      { workerFactory: factory, signal: controller.signal },
    );

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
