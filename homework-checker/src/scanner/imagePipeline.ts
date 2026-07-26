export type Point = { x: number; y: number };

export type Rect = { x: number; y: number; width: number; height: number };

export type PreparedImage = {
  bitmap: ImageBitmap;
  width: number;
  height: number;
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

export async function prepareImage(file: File, maxSide = 1600): Promise<PreparedImage> {
  if (!Number.isFinite(maxSide) || maxSide <= 0) {
    throw new Error("maxSide must be a positive number");
  }

  const source = await createImageBitmap(file, { imageOrientation: "from-image" });

  try {
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
    return {
      bitmap,
      width,
      height,
      toOriginal: (rect) => ({
        x: rect.x * originalScaleX,
        y: rect.y * originalScaleY,
        width: rect.width * originalScaleX,
        height: rect.height * originalScaleY,
      }),
    };
  } finally {
    source.close?.();
  }
}
