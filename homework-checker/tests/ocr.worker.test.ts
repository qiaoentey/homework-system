import { describe, expect, it, vi } from "vitest";
import { terminateFailedOcrWorker } from "../src/scanner/ocr.worker";

describe("terminateFailedOcrWorker", () => {
  it("terminates a created Tesseract worker before clearing failed recognition state", async () => {
    const worker = { terminate: vi.fn().mockResolvedValue(undefined) };

    await terminateFailedOcrWorker(worker);

    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
