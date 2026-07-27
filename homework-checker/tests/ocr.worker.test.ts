import { describe, expect, it, vi } from "vitest";
import { terminateFailedOcrWorker, toOcrLine } from "../src/scanner/ocr.worker";

describe("terminateFailedOcrWorker", () => {
  it("terminates a created Tesseract worker before clearing failed recognition state", async () => {
    const worker = { terminate: vi.fn().mockResolvedValue(undefined) };

    await terminateFailedOcrWorker(worker);

    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("preserves the weakest critical digit or operator symbol confidence", () => {
    const line = {
      text: "47 + 28 = 65",
      confidence: 96,
      bbox: { x0: 10, y0: 20, x1: 210, y1: 50 },
      words: [
        {
          text: "47",
          confidence: 95,
          symbols: [
            { text: "4", confidence: 94 },
            { text: "7", confidence: 91 },
          ],
        },
        {
          text: "+",
          confidence: 93,
          symbols: [{ text: "+", confidence: 72 }],
        },
        {
          text: "28",
          confidence: 95,
          symbols: [
            { text: "2", confidence: 95 },
            { text: "8", confidence: 96 },
          ],
        },
        {
          text: "=",
          confidence: 92,
          symbols: [{ text: "=", confidence: 90 }],
        },
        {
          text: "6",
          confidence: 65,
          symbols: undefined,
        },
        {
          text: "5",
          confidence: 95,
          symbols: [{ text: "5", confidence: 94 }],
        },
      ],
    } as unknown as Tesseract.Line;

    expect(toOcrLine(line)).toMatchObject({
      confidence: 96,
      criticalConfidence: 65,
      box: { x: 10, y: 20, width: 200, height: 30 },
    });
  });
});
