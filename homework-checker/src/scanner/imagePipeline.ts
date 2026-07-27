import type { ImagePreprocessResult } from "./imagePreprocess";

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export type PreparedImage = {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  /** EXIF-normalized enhanced preview URL; the source File remains unchanged. */
  displayUrl: string;
  release: () => void;
  /** Maps normalized OCR coordinates into the EXIF-oriented source raster. */
  toOriginal: (rect: Rect) => Rect;
};

export type ImagePreprocessor = (image: ImageData, signal?: AbortSignal) => Promise<ImageData>;
export type ImagePreprocessWorkerFactory = () => Worker;

export type PrepareImageOptions = {
  signal?: AbortSignal;
  preprocess?: ImagePreprocessor;
  workerFactory?: ImagePreprocessWorkerFactory;
};

/**
 * Source decode is bounded at 12MP. The retained OCR raster is at most 1600²;
 * its CPU-intensive 3×3 enhancement runs in a dedicated, cancellable Worker.
 */
export const MAX_SOURCE_PIXELS = 12_000_000;
export const NORMALIZED_MAX_PIXELS = 1_600 * 1_600;
export const NORMALIZED_PIPELINE_PEAK_BYTES_PER_PIXEL = 17;
const ALLOCATION_RETRY_MAX_SIDE = 1_200;

export const normalizedPipelinePeakBytes = (width: number, height: number) =>
  width * height * NORMALIZED_PIPELINE_PEAK_BYTES_PER_PIXEL;

const abortError = () => new DOMException("Image preparation was canceled.", "AbortError");

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw abortError();
};

const readFileBytes = async (file: File) => {
  if (typeof file.arrayBuffer === "function") return new Uint8Array(await file.arrayBuffer());
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Unable to inspect image dimensions."));
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(file);
  });
};

const jpegDimensions = (bytes: Uint8Array) => {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  for (let offset = 2; offset + 8 < bytes.length;) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) return undefined;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) return undefined;
    if (startOfFrame.has(marker) && length >= 7) {
      return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
    }
    offset += length;
  }
  return undefined;
};

const encodedImageDimensions = async (file: File, signal?: AbortSignal) => {
  if (file.type !== "image/png" && file.type !== "image/jpeg") return undefined;
  const bytes = await readFileBytes(file);
  throwIfAborted(signal);
  if (
    file.type === "image/png"
    && bytes.length >= 24
    && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  return file.type === "image/jpeg" ? jpegDimensions(bytes) : undefined;
};

const terminateOnce = (worker: Worker) => {
  let terminated = false;
  return () => {
    if (terminated) return;
    terminated = true;
    worker.terminate();
  };
};

export function runImagePreprocessing(
  image: ImageData,
  options: Pick<PrepareImageOptions, "signal" | "workerFactory"> = {},
): Promise<ImageData> {
  throwIfAborted(options.signal);
  const worker = options.workerFactory?.()
    ?? new Worker(new URL("./imagePreprocess.worker.ts", import.meta.url), { type: "module" });
  const terminate = terminateOnce(worker);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      options.signal?.removeEventListener("abort", onAbort);
      terminate();
    };
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });

    worker.onmessage = (event: MessageEvent<ImagePreprocessResult>) => {
      if (event.data.type !== "result") return;
      cleanup();
      const pixels = new Uint8ClampedArray(event.data.pixels);
      const result = typeof ImageData === "undefined"
        ? { data: pixels, width: event.data.width, height: event.data.height } as ImageData
        : new ImageData(pixels, event.data.width, event.data.height);
      resolve(result);
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error("The image preprocessing worker stopped unexpectedly."));
    };
    worker.onmessageerror = () => {
      cleanup();
      reject(new Error("The image preprocessing result could not be read."));
    };
    worker.postMessage({
      type: "preprocess",
      width: image.width,
      height: image.height,
      pixels: image.data.buffer,
    }, [image.data.buffer as ArrayBuffer]);
  });
}

const canvasToBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error("Unable to create a display image on this device"));
  }, "image/jpeg", 0.95);
});

const isAllocationFailure = (error: unknown) =>
  error instanceof RangeError
  || (error instanceof DOMException && ["IndexSizeError", "InvalidStateError", "QuotaExceededError"].includes(error.name));

const dimensionsFor = (sourceWidth: number, sourceHeight: number, maxSide: number) => {
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
};

const prepareRaster = async (
  source: ImageBitmap,
  maxSide: number,
  options: PrepareImageOptions,
) => {
  const { width, height } = dimensionsFor(source.width, source.height, maxSide);
  if (width * height > NORMALIZED_MAX_PIXELS) {
    throw new Error("This photo cannot be normalized safely on this device.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to prepare this image on this device");

  context.drawImage(source, 0, 0, width, height);
  throwIfAborted(options.signal);
  const imageData = context.getImageData(0, 0, width, height);
  const preprocess = options.preprocess
    ?? ((image: ImageData, signal?: AbortSignal) => runImagePreprocessing(
      image,
      { signal, workerFactory: options.workerFactory },
    ));
  const enhanced = await preprocess(imageData, options.signal);
  throwIfAborted(options.signal);
  context.putImageData(enhanced, 0, 0);
  const blob = await canvasToBlob(canvas);
  throwIfAborted(options.signal);
  const bitmap = await createImageBitmap(canvas);
  throwIfAborted(options.signal);
  return { bitmap, blob, width, height };
};

export async function prepareImage(
  file: File,
  maxSide = 1600,
  options: PrepareImageOptions = {},
): Promise<PreparedImage> {
  if (!Number.isFinite(maxSide) || maxSide <= 0) {
    throw new Error("maxSide must be a positive number");
  }
  throwIfAborted(options.signal);

  const encodedDimensions = await encodedImageDimensions(file, options.signal);
  if (encodedDimensions && encodedDimensions.width * encodedDimensions.height > MAX_SOURCE_PIXELS) {
    throw new Error("This photo is too large to process safely on this device. Please choose a photo under 12 megapixels.");
  }
  const source = await createImageBitmap(file, { imageOrientation: "from-image" });
  let displayUrl: string | undefined;
  let retainedBitmap: ImageBitmap | undefined;

  try {
    throwIfAborted(options.signal);
    if (source.width * source.height > MAX_SOURCE_PIXELS) {
      throw new Error("This photo is too large to process safely on this device. Please choose a photo under 12 megapixels.");
    }

    let raster;
    try {
      raster = await prepareRaster(source, maxSide, options);
    } catch (error) {
      if (!isAllocationFailure(error) || maxSide <= ALLOCATION_RETRY_MAX_SIDE) throw error;
      throwIfAborted(options.signal);
      raster = await prepareRaster(source, ALLOCATION_RETRY_MAX_SIDE, options);
    }
    retainedBitmap = raster.bitmap;
    displayUrl = URL.createObjectURL(raster.blob);
    const scaleX = source.width / raster.width;
    const scaleY = source.height / raster.height;
    let released = false;

    return {
      bitmap: retainedBitmap,
      width: raster.width,
      height: raster.height,
      sourceWidth: source.width,
      sourceHeight: source.height,
      displayUrl,
      release: () => {
        if (released) return;
        released = true;
        retainedBitmap?.close?.();
        URL.revokeObjectURL(displayUrl!);
      },
      toOriginal: (rect) => ({
        x: rect.x * scaleX,
        y: rect.y * scaleY,
        width: rect.width * scaleX,
        height: rect.height * scaleY,
      }),
    };
  } catch (error) {
    retainedBitmap?.close?.();
    if (displayUrl) URL.revokeObjectURL(displayUrl);
    throw error;
  } finally {
    source.close?.();
  }
}
