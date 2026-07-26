/// <reference lib="webworker" />

import { createWorker, OEM } from "tesseract.js";
import type { OcrLine, OcrRequest, OcrWorkerEvent } from "./ocr.types";

const OFFLINE_LANGUAGES = ["eng", "msa", "chi_tra"];

const send = (event: OcrWorkerEvent) => self.postMessage(event);

const toLine = (line: Tesseract.Line): OcrLine => ({
  text: line.text,
  confidence: line.confidence,
  box: {
    x: line.bbox.x0,
    y: line.bbox.y0,
    width: line.bbox.x1 - line.bbox.x0,
    height: line.bbox.y1 - line.bbox.y0,
  },
});

let initializedWorker: Promise<Tesseract.Worker> | undefined;

const getWorker = () => {
  if (!initializedWorker) {
    initializedWorker = createWorker(OFFLINE_LANGUAGES, OEM.LSTM_ONLY, {
      langPath: "/ocr",
      workerPath: "/ocr/tesseract-worker.min.js",
      corePath: "/ocr",
      cacheMethod: "none",
      logger: ({ status, progress }) => {
        const isRecognizing = status.toLowerCase().includes("recognizing");
        send({
          type: "progress",
          stage: isRecognizing ? "识别文字" : "读取模型",
          progress: isRecognizing ? 0.6 + progress * 0.4 : progress * 0.6,
        });
      },
    });
  }
  return initializedWorker;
};

const recognize = async ({ image }: OcrRequest) => {
  if (typeof OffscreenCanvas === "undefined") {
    throw new Error("此浏览器不支持本机文字识别，请改用较新的浏览器。");
  }

  send({ type: "progress", stage: "读取模型", progress: 0 });
  const canvas = new OffscreenCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法在此装置上准备识别图片。");
  context.putImageData(image, 0, 0);

  const worker = await getWorker();
  send({ type: "progress", stage: "识别文字", progress: 0.6 });
  const result = await worker.recognize(canvas, {}, { blocks: true });
  const lines = result.data.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines))
    .map(toLine)
    .filter((line) => line.text.trim()) ?? [];
  send({ type: "result", lines });
};

self.onmessage = (event: MessageEvent<OcrRequest>) => {
  if (event.data.type !== "recognize") return;
  void recognize(event.data).catch((error: unknown) => {
    initializedWorker = undefined;
    send({
      type: "error",
      message: error instanceof Error ? error.message : "本机文字识别失败，请重新拍摄清晰的作业页。",
    });
  });
};
