export type ImagePreprocessRequest = {
  type: "preprocess";
  width: number;
  height: number;
  pixels: ArrayBuffer;
};

export type ImagePreprocessResult = {
  type: "result";
  width: number;
  height: number;
  pixels: ArrayBuffer;
};

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

/** CPU-only enhancement used exclusively by the focused preprocessing Worker. */
export function preprocessPixels(pixels: Uint8ClampedArray, width: number, height: number) {
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
}
