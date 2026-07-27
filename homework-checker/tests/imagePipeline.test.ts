import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_SOURCE_PIXELS,
  NORMALIZED_PIPELINE_PEAK_BYTES_PER_PIXEL,
  normalizedPipelinePeakBytes,
  prepareImage,
} from "../src/scanner/imagePipeline";

type CanvasContextStub = {
  drawImage: ReturnType<typeof vi.fn>;
  getImageData: ReturnType<typeof vi.fn>;
  putImageData: ReturnType<typeof vi.fn>;
};

const identityPreprocessor = async (image: ImageData) => image;

const testImageFile = (width: number, height: number) => Object.assign(
  new File(["image"], "worksheet.jpg", { type: "image/jpeg" }),
  { __dimensions: { width, height } },
);

describe("prepareImage", () => {
  beforeEach(() => vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:prepared"), revokeObjectURL: vi.fn() }));
  afterEach(() => vi.restoreAllMocks());

  it("keeps OCR, preview and export coordinates in one normalized raster", async () => {
    const context: CanvasContextStub = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(1200 * 1600 * 4) })),
      putImageData: vi.fn(),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: (callback: BlobCallback) => callback(new Blob(["normalized"], { type: "image/jpeg" })),
    };
    const file = testImageFile(2400, 3200);
    vi.spyOn(document, "createElement").mockReturnValue(canvas as unknown as HTMLCanvasElement);
    vi.stubGlobal("createImageBitmap", vi.fn(async (source) => {
      if (source === file) return file.__dimensions!;
      return { width: canvas.width, height: canvas.height };
    }));

    const prepared = await prepareImage(file, 1600, { preprocess: identityPreprocessor });

    expect(prepared.width).toBe(1200);
    expect(prepared.height).toBe(1600);
    expect(prepared.toOriginal({ x: 60, y: 80, width: 120, height: 40 }))
      .toEqual({ x: 120, y: 160, width: 240, height: 80 });
  });

  it("uses the bounded normalized dimensions for a wide image", async () => {
    const context: CanvasContextStub = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(100 * 33 * 4) })),
      putImageData: vi.fn(),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: (callback: BlobCallback) => callback(new Blob(["normalized"], { type: "image/jpeg" })),
    };
    const file = testImageFile(1000, 333);
    vi.spyOn(document, "createElement").mockReturnValue(canvas as unknown as HTMLCanvasElement);
    vi.stubGlobal("createImageBitmap", vi.fn(async (source) => {
      if (source === file) return file.__dimensions!;
      return { width: canvas.width, height: canvas.height };
    }));

    const prepared = await prepareImage(file, 100, { preprocess: identityPreprocessor });

    expect(prepared).toMatchObject({ width: 100, height: 33 });
    const mapped = prepared.toOriginal({ x: 10, y: 10, width: 20, height: 10 });
    expect(mapped).toMatchObject({ x: 100, width: 200 });
    expect(mapped.y).toBeCloseTo(3330 / 33);
    expect(mapped.height).toBeCloseTo(3330 / 33);
  });

  it("creates one normalized display source for EXIF-decoded bitmap and annotation coordinates", async () => {
    const context: CanvasContextStub = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(3 * 2 * 4) })),
      putImageData: vi.fn(),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: (callback: BlobCallback) => callback(new Blob(["normalized"], { type: "image/jpeg" })),
    };
    const file = testImageFile(3, 2);
    vi.spyOn(document, "createElement").mockReturnValue(canvas as unknown as HTMLCanvasElement);
    vi.stubGlobal("createImageBitmap", vi.fn(async (source) => {
      if (source === file) return file.__dimensions!;
      return { width: canvas.width, height: canvas.height };
    }));
    const createObjectURL = vi.fn(() => "blob:normalized-photo");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });

    const prepared = await prepareImage(file, 1600, { preprocess: identityPreprocessor });

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(prepared).toMatchObject({ displayUrl: "blob:normalized-photo" });
    expect(prepared.toOriginal({ x: 0, y: 0, width: prepared.width, height: prepared.height }))
      .toEqual({ x: 0, y: 0, width: 3, height: 2 });
  });

  it("fails closed before creating a normalized canvas for oversized sources", async () => {
    const context: CanvasContextStub = {
      drawImage: vi.fn(), getImageData: vi.fn(), putImageData: vi.fn(),
    };
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => context) };
    const file = testImageFile(4_001, 3_000);
    vi.spyOn(document, "createElement").mockReturnValue(canvas as unknown as HTMLCanvasElement);
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 4_001, height: 3_000 })));

    await expect(prepareImage(file, 1600, { preprocess: identityPreprocessor })).rejects.toThrow("too large");
    expect(MAX_SOURCE_PIXELS).toBe(12_000_000);
    expect(canvas.getContext).not.toHaveBeenCalled();
  });

  it("rejects an oversized PNG from encoded dimensions before bitmap decode", async () => {
    const bytes = new Uint8Array(24);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 4_001);
    view.setUint32(20, 3_000);
    const file = new File([bytes], "oversized.png", { type: "image/png" });
    const createBitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", createBitmap);

    await expect(prepareImage(file, 1600, { preprocess: identityPreprocessor })).rejects.toThrow("too large");

    expect(createBitmap).not.toHaveBeenCalled();
  });

  it("retries once at a smaller raster after an allocation failure", async () => {
    const canvases: Array<{
      width: number;
      height: number;
      getContext: ReturnType<typeof vi.fn>;
      toBlob: (callback: BlobCallback) => void;
    }> = [];
    vi.spyOn(document, "createElement").mockImplementation(() => {
      const attempt = canvases.length;
      const canvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({
          drawImage: vi.fn(),
          getImageData: () => {
            if (attempt === 0) throw new RangeError("allocation failed");
            return {
              data: new Uint8ClampedArray(canvas.width * canvas.height * 4),
              width: canvas.width,
              height: canvas.height,
            } as ImageData;
          },
          putImageData: vi.fn(),
        })),
        toBlob: (callback: BlobCallback) => callback(new Blob(["retry"], { type: "image/jpeg" })),
      };
      canvases.push(canvas);
      return canvas as unknown as HTMLElement;
    });
    const file = testImageFile(2400, 3200);
    vi.stubGlobal("createImageBitmap", vi.fn(async (source) => {
      if (source === file) return file.__dimensions!;
      const canvas = source as unknown as { width: number; height: number };
      return { width: canvas.width, height: canvas.height };
    }));

    const prepared = await prepareImage(file, 1600, { preprocess: identityPreprocessor });

    expect(canvases.map(({ width, height }) => ({ width, height }))).toEqual([
      { width: 1200, height: 1600 },
      { width: 900, height: 1200 },
    ]);
    expect(prepared).toMatchObject({ width: 900, height: 1200 });
  });

  it("documents the normalized raw-pixel memory calculation", () => {
    expect(normalizedPipelinePeakBytes(1_600, 1_600)).toBe(
      1_600 * 1_600 * NORMALIZED_PIPELINE_PEAK_BYTES_PER_PIXEL,
    );
  });
});
