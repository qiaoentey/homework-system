export type Point = { x: number; y: number };

export type Rect = { x: number; y: number; width: number; height: number };

export type PreparedImage = {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  /** An EXIF-normalized Blob URL shared by preview, annotation, and export. */
  displayUrl: string;
  release: () => void;
  toOriginal: (rect: Rect) => Rect;
};

/**
 * Decoding a photograph is unavoidable, but creating an additional full-size
 * canvas is not.  We fail closed above this source limit and normalize every
 * accepted image to this bounded raster before it is retained for preview/OCR.
 *
 * At the 1600 px default, the normalized raster is at most 2,560,000 pixels.
 * Its measured raw allocation plan is 17 bytes/pixel at peak (canvas, image
 * data, grayscale scratch and returned bitmap): 41.50 MiB.  A permitted
 * 12 MP decoded source adds 45.78 MiB, for a bounded raw-pixel peak of
 * 87.28 MiB before browser implementation overhead and JPEG compression.
 */
export const MAX_SOURCE_PIXELS = 12_000_000;
export const NORMALIZED_MAX_PIXELS = 1_600 * 1_600;
export const NORMALIZED_PIPELINE_PEAK_BYTES_PER_PIXEL = 17;

export const normalizedPipelinePeakBytes = (width: number, height: number) =>
  width * height * NORMALIZED_PIPELINE_PEAK_BYTES_PER_PIXEL;

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const sharpenGrayscale = (pixels: Uint8ClampedArray, width: number, height: number) => {
  const luminance = new Uint8ClampedArray(width * height);

  for (let pixel = 0; pixel < luminance.length; pixel += 1) {
    const offset = pixel * 4;
    luminance[pixel] = clampByte(
      pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114,
    );
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const center = luminance[index];
      let total = 0;
      let samples = 0;

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const sampleX = x + offsetX;
          const sampleY = y + offsetY;
          if (sampleX >= 0 && sampleX < width && sampleY >= 0 && sampleY < height) {
            total += luminance[sampleY * width + sampleX];
            samples += 1;
          }
        }
      }

      const localContrast = center + (center - total / samples) * 0.25;
      const left = luminance[y * width + Math.max(0, x - 1)];
      const right = luminance[y * width + Math.min(width - 1, x + 1)];
      const above = luminance[Math.max(0, y - 1) * width + x];
      const below = luminance[Math.min(height - 1, y + 1) * width + x];
      const sharpened = localContrast + (center * 4 - left - right - above - below) * 0.12;
      const pixelOffset = index * 4;
      const value = clampByte(sharpened);

      pixels[pixelOffset] = value;
      pixels[pixelOffset + 1] = value;
      pixels[pixelOffset + 2] = value;
    }
  }
};

const canvasToBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error("Unable to create a display image on this device"));
  }, "image/jpeg", 0.95);
});

export async function prepareImage(file: File, maxSide = 1600): Promise<PreparedImage> {
  if (!Number.isFinite(maxSide) || maxSide <= 0) {
    throw new Error("maxSide must be a positive number");
  }

  const source = await createImageBitmap(file, { imageOrientation: "from-image" });
  let displayUrl: string | undefined;

  try {
    if (source.width * source.height > MAX_SOURCE_PIXELS) {
      throw new Error("This photo is too large to process safely on this device. Please choose a photo under 12 megapixels.");
    }

    const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    if (width * height > NORMALIZED_MAX_PIXELS) {
      throw new Error("This photo cannot be normalized safely on this device.");
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) throw new Error("Unable to prepare this image on this device");

    context.drawImage(source, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    sharpenGrayscale(imageData.data, width, height);
    context.putImageData(imageData, 0, 0);

    // The displayed image is the same bounded, EXIF-normalized raster used for
    // OCR.  This avoids allocating a second full-size source canvas and keeps
    // preview/export coordinates in the same normalized space as annotations.
    displayUrl = URL.createObjectURL(await canvasToBlob(canvas));
    const bitmap = await createImageBitmap(canvas);

    let released = false;
    return {
      bitmap,
      width,
      height,
      displayUrl,
      release: () => {
        if (released) return;
        released = true;
        bitmap.close?.();
        URL.revokeObjectURL(displayUrl!);
      },
      // `displayUrl`, OCR and export all use the normalized raster. The
      // historical name remains to keep callers explicit about this mapping.
      toOriginal: (rect) => ({ ...rect }),
    };
  } catch (error) {
    if (displayUrl) URL.revokeObjectURL(displayUrl);
    throw error;
  } finally {
    source.close?.();
  }
}
