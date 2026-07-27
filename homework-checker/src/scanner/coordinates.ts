import type { Rect } from "./imagePipeline";
import type { OcrLine } from "./ocr.types";

export const pixelAlignedCrop = (
  selection: Rect,
  image: { width: number; height: number },
): Rect => {
  const left = Math.max(0, Math.min(image.width, Math.floor(selection.x)));
  const top = Math.max(0, Math.min(image.height, Math.floor(selection.y)));
  const right = Math.max(left, Math.min(image.width, Math.ceil(selection.x + selection.width)));
  const bottom = Math.max(top, Math.min(image.height, Math.ceil(selection.y + selection.height)));
  return { x: left, y: top, width: right - left, height: bottom - top };
};

export const mapCropLinesToImage = (
  lines: OcrLine[],
  crop: Rect,
  raster: { width: number; height: number },
): OcrLine[] => {
  const scaleX = crop.width / raster.width;
  const scaleY = crop.height / raster.height;
  return lines.map((line) => ({
    ...line,
    box: {
      x: crop.x + line.box.x * scaleX,
      y: crop.y + line.box.y * scaleY,
      width: line.box.width * scaleX,
      height: line.box.height * scaleY,
    },
  }));
};
