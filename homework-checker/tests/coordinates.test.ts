import { describe, expect, it } from "vitest";
import { mapCropLinesToImage, pixelAlignedCrop } from "../src/scanner/coordinates";
import type { OcrLine } from "../src/scanner/ocr.types";

describe("manual OCR coordinate mapping", () => {
  it("pixel-aligns a fractional selection inside the prepared image", () => {
    expect(pixelAlignedCrop(
      { x: 100.6, y: 200.2, width: 101.1, height: 80.4 },
      { width: 800, height: 1000 },
    )).toEqual({ x: 100, y: 200, width: 102, height: 81 });
  });

  it("maps crop-local boxes through the rounded crop scale and offset", () => {
    const lines: OcrLine[] = [{
      text: "47 + 28 = 65",
      confidence: 96,
      criticalConfidence: 96,
      box: { x: 10, y: 20, width: 50, height: 30 },
    }];

    expect(mapCropLinesToImage(
      lines,
      { x: 100.5, y: 200.25, width: 101.25, height: 80.5 },
      { width: 101, height: 81 },
    )[0].box).toEqual({
      x: 100.5 + 10 * 101.25 / 101,
      y: 200.25 + 20 * 80.5 / 81,
      width: 50 * 101.25 / 101,
      height: 30 * 80.5 / 81,
    });
  });
});
