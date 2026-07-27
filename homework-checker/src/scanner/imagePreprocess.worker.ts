/// <reference lib="webworker" />

import {
  preprocessPixels,
  type ImagePreprocessRequest,
  type ImagePreprocessResult,
} from "./imagePreprocess";

self.onmessage = (event: MessageEvent<ImagePreprocessRequest>) => {
  if (event.data.type !== "preprocess") return;
  const pixels = new Uint8ClampedArray(event.data.pixels);
  preprocessPixels(pixels, event.data.width, event.data.height);
  const result: ImagePreprocessResult = {
    type: "result",
    width: event.data.width,
    height: event.data.height,
    pixels: pixels.buffer,
  };
  self.postMessage(result, { transfer: [pixels.buffer] });
};
