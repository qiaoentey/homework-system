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
    // Never display the raw File URL after OCR has decoded it. Some engines
    // apply EXIF orientation differently to ImageBitmap and HTMLImageElement;
    // this raster is the single coordinate space for both annotations and export.
    const displayCanvas = document.createElement("canvas");
    displayCanvas.width = source.width;
    displayCanvas.height = source.height;
    const displayContext = displayCanvas.getContext("2d");
    if (!displayContext) throw new Error("Unable to prepare this image on this device");
    displayContext.drawImage(source, 0, 0);
    displayUrl = URL.createObjectURL(await canvasToBlob(displayCanvas));

    const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) throw new Error("Unable to prepare this image on this device");

    context.drawImage(source, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    sharpenGrayscale(imageData.data, width, height);
    context.putImageData(imageData, 0, 0);

    const bitmap = await createImageBitmap(canvas);

    const originalScaleX = source.width / width;
    const originalScaleY = source.height / height;
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
      toOriginal: (rect) => ({
        x: rect.x * originalScaleX,
        y: rect.y * originalScaleY,
        width: rect.width * originalScaleX,
        height: rect.height * originalScaleY,
      }),
    };
  } catch (error) {
    if (displayUrl) URL.revokeObjectURL(displayUrl);
    throw error;
  } finally {
    source.close?.();
  }
}
