import { describe, expect, it } from "vitest";
import { analyzeQuestions } from "../src/math/analyzeQuestions";
import { segmentQuestions } from "../src/scanner/questionSegmenter";
import type { OcrLine } from "../src/scanner/ocr.types";

const line = (text: string, x: number, y: number, width: number, height: number): OcrLine => ({
  text,
  confidence: 90,
  criticalConfidence: 90,
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

  it("recognizes )、and OCR-confused comma question numbers", () => {
    const lines = [
      line("1) 8 + 5 = 13", 0, 0, 260, 40),
      line("2、 18 - 9 = 9", 0, 70, 260, 40),
      line("3， 6 × 7 = 42", 0, 140, 260, 40),
      line("4, 3 + 9 = 12", 0, 210, 260, 40),
    ];

    expect(segmentQuestions(lines).map((question) => question.lines[0].text)).toEqual(lines.map((item) => item.text));
  });

  it("does not mistake leading decimals or thousands separators for question labels", () => {
    const lines = [
      line("1.5 + 2.5 = 4", 0, 0, 260, 40),
      line("1,000 + 500 = 1,500", 0, 130, 340, 40),
    ];

    expect(segmentQuestions(lines).map((question) => question.lines[0].text)).toEqual(lines.map((item) => item.text));
  });

  it("keeps critical OCR and geometric location confidence as independent signals", () => {
    const lowLineConfidence = line("1) 47 + 28 = 65", 20, 40, 300, 40);
    lowLineConfidence.confidence = 40;
    lowLineConfidence.criticalConfidence = 96;

    expect(segmentQuestions([lowLineConfidence])[0]).toMatchObject({
      confidence: 40,
      criticalConfidence: 96,
      locationConfidence: expect.any(Number),
    });
    expect(segmentQuestions([lowLineConfidence])[0].locationConfidence).toBeGreaterThanOrEqual(0.8);
  });

  it("lets a clear high-confidence incorrect region become red through production segmentation", () => {
    const questions = segmentQuestions([
      line("1. 47 + 28 = 65", 20, 40, 300, 40),
    ]);

    expect(questions[0].locationConfidence).toBeGreaterThanOrEqual(0.8);
    expect(analyzeQuestions(questions)[0].severity).toBe("error");
  });

  it("keeps an overlapping fragmented region out of red through production segmentation", () => {
    const questions = segmentQuestions([
      line("1. 47 + 28 =", 20, 40, 260, 40),
      line("65", 240, 45, 70, 40),
    ]);

    expect(questions[0].locationConfidence).toBeLessThan(0.8);
    expect(analyzeQuestions(questions)[0].severity).toBe("review");
  });

  it("scores a barely separated unnumbered boundary below the location gate", () => {
    const questions = segmentQuestions([
      line("47 + 28 = 75", 20, 40, 260, 40),
      line("90 - 36 = 54", 20, 153, 260, 40),
    ]);

    expect(questions).toHaveLength(2);
    expect(questions.every((question) => question.locationConfidence < 0.8)).toBe(true);
  });

  it("scores a borderline horizontal gutter as uncertain column association", () => {
    const questions = segmentQuestions([
      line("1. 47 + 28 = 75", 20, 40, 220, 40),
      line("2. 90 - 36 = 54", 402, 40, 220, 40),
    ]);

    expect(questions).toHaveLength(2);
    expect(questions.every((question) => question.locationConfidence < 0.8)).toBe(true);
  });

  it("scores a gutter just below the column split as ambiguous grouping", () => {
    const questions = segmentQuestions([
      line("1. 47 + 28 =", 20, 40, 220, 40),
      line("65", 399, 40, 70, 40),
    ]);

    expect(questions).toHaveLength(1);
    expect(questions[0].locationConfidence).toBeLessThan(0.8);
    expect(analyzeQuestions(questions)[0].severity).toBe("review");
  });

  it("keeps vertically overlapping numbered groups out of red", () => {
    const questions = segmentQuestions([
      line("1. 47 + 28 = 65", 20, 40, 300, 40),
      line("2. 90 - 36 = 44", 20, 68, 300, 40),
    ]);

    expect(questions).toHaveLength(2);
    expect(questions.every((question) => question.locationConfidence < 0.8)).toBe(true);
    expect(analyzeQuestions(questions).every((annotation) => annotation.severity === "review")).toBe(true);
  });

  it("keeps same-column overlaps out of red in a two-column reading order", () => {
    const questions = segmentQuestions([
      line("1. 47 + 28 = 65", 0, 0, 220, 40),
      line("2. 90 - 36 = 44", 500, 0, 220, 40),
      line("3. 18 + 17 = 25", 0, 28, 220, 40),
      line("4. 81 - 29 = 42", 500, 28, 220, 40),
    ]);

    expect(questions).toHaveLength(4);
    expect(questions.every((question) => question.locationConfidence < 0.8)).toBe(true);
    expect(analyzeQuestions(questions).every((annotation) => annotation.severity === "review")).toBe(true);
  });

  it("keeps critical digit and operator confidence as an independent red gate after segmentation", () => {
    const uncertainCriticalLine = line("1. 47 + 28 = 65", 20, 40, 300, 40);
    uncertainCriticalLine.criticalConfidence = 84;
    const questions = segmentQuestions([uncertainCriticalLine]);

    expect(questions[0].locationConfidence).toBeGreaterThanOrEqual(0.8);
    expect(analyzeQuestions(questions)[0].severity).toBe("review");
  });

  it("uses a horizontal gutter as a column boundary", () => {
    const lines = [
      line("1. 8 + 5 = 13", 0, 0, 250, 40),
      line("2. 9 + 6 = 15", 500, 0, 250, 40),
      line("3. 7 + 4 = 11", 0, 75, 250, 40),
      line("4. 12 - 3 = 9", 500, 75, 250, 40),
    ];

    expect(segmentQuestions(lines).map((question) => question.lines[0].text)).toEqual(lines.map((item) => item.text));
    expect(segmentQuestions(lines).every((question) => question.locationConfidence >= 0.8)).toBe(true);
  });

  it("treats an OCR empty line as an unnumbered question boundary", () => {
    const lines = [
      line("8 + 5 = 13", 0, 0, 250, 40),
      line("", 0, 60, 1, 20),
      line("18 - 9 = 9", 0, 150, 250, 40),
    ];

    expect(segmentQuestions(lines)).toHaveLength(2);
  });

  it("keeps a multi-line numbered question with its working", () => {
    const lines = [
      line("1. 125 + 48 =", 0, 0, 260, 40),
      line("173", 20, 48, 80, 40),
      line("2. 24 ÷ 6 = 4", 0, 125, 260, 40),
    ];

    expect(segmentQuestions(lines).map((question) => question.lines.map((item) => item.text))).toEqual([
      ["1. 125 + 48 =", "173"],
      ["2. 24 ÷ 6 = 4"],
    ]);
  });

  it("does not attach a numbered worksheet header or distant footer", () => {
    const lines = [
      line("SYNTHETIC SAMPLE", 0, 0, 260, 30),
      line("1) 8 + 5 = 13", 0, 80, 260, 40),
      line("2) 9 + 6 = 15", 0, 150, 260, 40),
      line("No personal data", 0, 260, 260, 30),
    ];

    expect(segmentQuestions(lines).map((question) => question.lines.map((item) => item.text))).toEqual([
      ["1) 8 + 5 = 13"],
      ["2) 9 + 6 = 15"],
    ]);
  });
});
