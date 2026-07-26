import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareImage } from "../src/scanner/imagePipeline";

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
  afterEach(() => vi.restoreAllMocks());

  it("maps OCR coordinates back to the original image", async () => {
    const context: CanvasContextStub = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(1200 * 1600 * 4) })),
      putImageData: vi.fn(),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
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
      .toEqual({ x: 120, y: 160, width: 240, height: 80 });
  });
});
