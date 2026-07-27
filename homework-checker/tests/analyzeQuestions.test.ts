import { describe, expect, it } from "vitest";
import { analyzeQuestions } from "../src/math/analyzeQuestions";
import type { QuestionRegion } from "../src/scanner/ocr.types";

const region = (
  text: string,
  criticalConfidence: number,
  locationConfidence = 0.95,
): QuestionRegion => ({
  id: "question-1",
  lines: [{ text, confidence: 96, criticalConfidence, box: { x: 12, y: 16, width: 260, height: 32 } }],
  box: { x: 12, y: 16, width: 260, height: 32 },
  confidence: 96,
  criticalConfidence,
  locationConfidence,
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
    const lowRegionIncorrect = region("47 + 28 = 65", 0.96, 0.79);
    const lowRegionCorrect = region("47 + 28 = 75", 0.96, 0.79);

    expect(analyzeQuestions([lowRegionIncorrect])[0].severity).toBe("review");
    expect(analyzeQuestions([lowRegionCorrect])[0].severity).toBe("pass");
  });

  it("uses feasible independent critical-character and location confidence combinations", () => {
    expect(analyzeQuestions([region("47 + 28 = 65", 0.84, 0.96)])[0].severity).toBe("review");
    expect(analyzeQuestions([region("47 + 28 = 65", 0.96, 0.79)])[0].severity).toBe("review");
    expect(analyzeQuestions([region("47 + 28 = 65", 0.96, 0.96)])[0].severity).toBe("error");
  });

  it("sends uncertain units to review without an expected answer", () => {
    expect(analyzeQuestions([region("2 mystery + 3 mystery = 5 mystery", 96)])[0])
      .toMatchObject({ severity: "review", expected: undefined });
  });

  it("parses a visual question number without making it part of the equation", () => {
    expect(analyzeQuestions([region("1) 47 + 28 = 75", 96)])[0])
      .toMatchObject({ severity: "pass", expected: "75" });
  });

  it.each([
    ["1.5 + 2.5 = 4", "4"],
    ["1,000 + 500 = 1,500", "1500"],
  ])("does not strip a leading number from %s", (recognized, expected) => {
    expect(analyzeQuestions([region(recognized, 96)])[0])
      .toMatchObject({ severity: "pass", expected });
  });

  it.each([
    "1. 47 + 28 = 75",
    "2, 90 - 36 = 54",
    "3) 8 + 5 = 13",
    "4、9 + 6 = 15",
  ])("strips an unambiguous or separated visual label in %s", (recognized) => {
    expect(analyzeQuestions([region(recognized, 96)])[0].severity).toBe("pass");
  });
});
