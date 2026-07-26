import { describe, expect, it } from "vitest";
import { segmentQuestions } from "../src/scanner/questionSegmenter";
import type { OcrLine } from "../src/scanner/ocr.types";

const line = (text: string, x: number, y: number, width: number, height: number): OcrLine => ({
  text,
  confidence: 90,
  box: { x, y, width, height },
});

describe("segmentQuestions", () => {
  it("groups a numbered question and its answer line", () => {
    const lines = [
      line("1. 47 + 28 =", 0, 0, 240, 40),
      line("65", 250, 0, 70, 40),
      line("2. 90 - 36 =", 0, 80, 240, 40),
      line("54", 250, 80, 70, 40),
    ];

    expect(segmentQuestions(lines).map((question) => question.lines.map((item) => item.text))).toEqual([
      ["1. 47 + 28 =", "65"],
      ["2. 90 - 36 =", "54"],
    ]);
  });

  it("splits unnumbered lines when the vertical gap is large", () => {
    const lines = [
      line("47 + 28 =", 0, 0, 240, 40),
      line("65", 250, 0, 70, 40),
      line("90 - 36 =", 0, 130, 240, 40),
      line("54", 250, 130, 70, 40),
    ];

    expect(segmentQuestions(lines).map((question) => question.lines.map((item) => item.text))).toEqual([
      ["47 + 28 =", "65"],
      ["90 - 36 =", "54"],
    ]);
  });

  it("keeps close unnumbered visual rows together", () => {
    const lines = [
      line("47 + 28 =", 0, 0, 240, 40),
      line("65", 250, 0, 70, 40),
      line("show your work", 0, 52, 200, 40),
    ];

    expect(segmentQuestions(lines)).toHaveLength(1);
  });
});
