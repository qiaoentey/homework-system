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

    const prepared = await prepareImage(file, 1600);

    expect(prepared.width).toBe(1200);
    expect(prepared.height).toBe(1600);
    expect(prepared.toOriginal({ x: 60, y: 80, width: 120, height: 40 }))
      .toEqual({ x: 60, y: 80, width: 120, height: 40 });
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

    const prepared = await prepareImage(file, 100);

    expect(prepared).toMatchObject({ width: 100, height: 33 });
    expect(prepared.toOriginal({ x: 10, y: 10, width: 20, height: 10 })).toEqual({
      x: 10, y: 10, width: 20, height: 10,
    });
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

    const prepared = await prepareImage(file);

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(prepared).toMatchObject({ displayUrl: "blob:normalized-photo" });
    expect(prepared.toOriginal({ x: 0, y: 0, width: prepared.width, height: prepared.height }))
      .toEqual({ x: 0, y: 0, width: prepared.width, height: prepared.height });
  });

  it("fails closed before creating a normalized canvas for oversized sources", async () => {
    const context: CanvasContextStub = {
      drawImage: vi.fn(), getImageData: vi.fn(), putImageData: vi.fn(),
    };
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => context) };
    const file = testImageFile(4_001, 3_000);
    vi.spyOn(document, "createElement").mockReturnValue(canvas as unknown as HTMLCanvasElement);
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 4_001, height: 3_000 })));

    await expect(prepareImage(file)).rejects.toThrow("too large");
    expect(MAX_SOURCE_PIXELS).toBe(12_000_000);
    expect(canvas.getContext).not.toHaveBeenCalled();
  });

  it("documents the normalized raw-pixel memory calculation", () => {
    expect(normalizedPipelinePeakBytes(1_600, 1_600)).toBe(
      1_600 * 1_600 * NORMALIZED_PIPELINE_PEAK_BYTES_PER_PIXEL,
    );
  });
});
