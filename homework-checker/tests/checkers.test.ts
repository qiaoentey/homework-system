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
    ["carrying", "47 + 28 = 75", "47 + 28 = 74"],
    ["borrowing", "90 - 36 = 54", "90 - 36 = 55"],
    ["multiplication and division", "6 × 7 ÷ 3 = 14", "6 × 7 ÷ 3 = 13"],
    ["mixed precedence", "2 + 3 × 4 = 14", "2 + 3 × 4 = 20"],
    ["reduced fractions", "3/4 + 1/8 = 7/8", "3/4 + 1/8 = 6/8"],
    ["decimal places", "12.50 - 3.20 = 9.30", "12.50 - 3.20 = 9.20"],
    ["percentages", "25% × 80 = 20", "25% × 80 = 25"],
    ["currency", "RM 12.50 - RM 3.20 = RM 9.30", "RM 12.50 - RM 3.20 = RM 9.20"],
    ["time carrying", "1 h + 30 min = 90 min", "1 h + 30 min = 80 min"],
    ["length conversion", "1 m + 30 cm = 130 cm", "1 m + 30 cm = 120 cm"],
    ["perimeter formula result", "2 × (8 cm + 5 cm) = 26 cm", "2 × (8 cm + 5 cm) = 13 cm"],
    ["area formula result", "8 cm × 5 cm = 40 cm²", "8 cm × 5 cm = 13 cm²"],
  ])("marks %s answers as correct or incorrect", (_topic, correct, incorrect) => {
    expect(check(correct).status).toBe("correct");
    expect(check(incorrect).status).toBe("incorrect");
  });

  it.each([
    "47 apples + 28 apples = 75 apples",
    "90 pencils - 36 pencils = 54 pencils",
    "6 widgets × 7 widgets = 42 widgets",
    "3/4 cakes + 1/8 cakes = 7/8 cakes",
    "25% × 80 tokens = 20 tokens",
    "1 mystery + 30 mystery = 31 mystery",
    "8 cm² × 5 cm² = 40 cm²",
  ])("marks unknown or unsupported units as uncertain: %s", (input) => {
    expect(check(input)).toMatchObject({ status: "uncertain", confidence: 0 });
  });

  it("does not compare incompatible unit dimensions", () => {
    expect(check("1 kg + 2 m = 3 kg")).toMatchObject({
      status: "uncertain",
      reason: expect.stringMatching(/unit/i),
    });
  });
});
