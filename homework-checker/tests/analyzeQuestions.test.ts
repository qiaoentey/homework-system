import { describe, expect, it } from "vitest";
import { analyzeQuestions } from "../src/math/analyzeQuestions";
import type { QuestionRegion } from "../src/scanner/ocr.types";

const region = (text: string, confidence: number): QuestionRegion => ({
  id: "question-1",
  lines: [{ text, confidence, box: { x: 12, y: 16, width: 260, height: 32 } }],
  box: { x: 12, y: 16, width: 260, height: 32 },
  confidence,
});

describe("analyzeQuestions", () => {
  it("uses red only when OCR, parsing and math are all confident", () => {
    expect(analyzeQuestions([region("47 + 28 = 65", 0.96)])[0].severity).toBe("error");
    expect(analyzeQuestions([region("47 + 28 = 65", 0.61)])[0].severity).toBe("review");
  });

  it("does not guess an application problem without a student equation", () => {
    expect(analyzeQuestions([region("小明有 47 粒糖，又买 28 粒。", 0.95)])[0])
      .toMatchObject({ severity: "review", expected: undefined });
  });

  it("requires region confidence for an error but not for a high-confidence pass", () => {
    const lowRegionIncorrect = region("47 + 28 = 65", 0.96);
    lowRegionIncorrect.confidence = 0.79;
    const lowRegionCorrect = region("47 + 28 = 75", 0.96);
    lowRegionCorrect.confidence = 0.79;

    expect(analyzeQuestions([lowRegionIncorrect])[0].severity).toBe("review");
    expect(analyzeQuestions([lowRegionCorrect])[0].severity).toBe("pass");
  });

  it("sends uncertain units to review without an expected answer", () => {
    expect(analyzeQuestions([region("2 mystery + 3 mystery = 5 mystery", 96)])[0])
      .toMatchObject({ severity: "review", expected: undefined });
  });
});
