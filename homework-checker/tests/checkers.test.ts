import { describe, expect, it } from "vitest";
import { checkEquation } from "../src/math/checkers";
import { parseEquation } from "../src/math/parser";

const check = (input: string) => {
  const parsed = parseEquation(input);
  if (!parsed.ok) throw new Error(`Expected parse success for ${input}`);
  return checkEquation(parsed.value);
};

describe("checkEquation", () => {
  it.each([
    ["carrying", "47 + 28 = 75", "47 + 28 = 74", "47 apples + 28 apples = 75 apples"],
    ["borrowing", "90 - 36 = 54", "90 - 36 = 55", "90 pencils - 36 pencils = 54 pencils"],
    ["multiplication and division", "6 × 7 ÷ 3 = 14", "6 × 7 ÷ 3 = 13", "6 widgets × 7 widgets = 42 widgets"],
    ["mixed precedence", "2 + 3 × 4 = 14", "2 + 3 × 4 = 20", "2 marbles + 3 × 4 = 14 marbles"],
    ["reduced fractions", "3/4 + 1/8 = 7/8", "3/4 + 1/8 = 6/8", "3/4 cakes + 1/8 cakes = 7/8 cakes"],
    ["decimal places", "12.50 - 3.20 = 9.30", "12.50 - 3.20 = 9.20", "1.2 grapes + 2.3 grapes = 3.5 grapes"],
    ["percentages", "25% × 80 = 20", "25% × 80 = 25", "25% × 80 tokens = 20 tokens"],
    ["currency", "RM 12.50 - RM 3.20 = RM 9.30", "RM 12.50 - RM 3.20 = RM 9.20", "RM 12.50 - 3 kg = RM 9.50"],
    ["time carrying", "1 h + 30 min = 90 min", "1 h + 30 min = 80 min", "1 h + 30 kg = 90 min"],
    ["length conversion", "1 m + 30 cm = 130 cm", "1 m + 30 cm = 120 cm", "1 m + 30 kg = 130 cm"],
    ["perimeter formula result", "2 × (8 cm + 5 cm) = 26 cm", "2 × (8 cm + 5 cm) = 13 cm", "2 × (8 cm + 5 kg) = 26 cm"],
    ["area formula result", "8 cm × 5 cm = 40 cm²", "8 cm × 5 cm = 13 cm²", "8 cm² × 5 cm² = 40 cm²"],
  ])("marks %s answers as correct, incorrect, or uncertain", (_topic, correct, incorrect, uncertain) => {
    expect(check(correct).status).toBe("correct");
    expect(check(incorrect).status).toBe("incorrect");
    expect(check(uncertain)).toMatchObject({ status: "uncertain", confidence: 0 });
  });

  it("compares unit fractions as exact ratios", () => {
    expect(check("1/3 m × 3 = 1 m")).toMatchObject({ status: "correct", expected: "1 m" });
  });

  it("uses parentheses to change precedence", () => {
    expect(check("(2 + 3) × 4 = 20")).toMatchObject({ status: "correct" });
    expect(check("(2 + 3) × 4 = 14")).toMatchObject({ status: "incorrect" });
  });

  it("does not compare incompatible unit dimensions", () => {
    expect(check("1 kg + 2 m = 3 kg")).toMatchObject({
      status: "uncertain",
      reason: expect.stringMatching(/unit/i),
    });
  });
});
