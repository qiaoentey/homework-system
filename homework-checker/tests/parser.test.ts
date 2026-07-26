import { describe, expect, it } from "vitest";
import { checkEquation } from "../src/math/checkers";
import { parseEquation } from "../src/math/parser";

const unwrap = <T>(result: { ok: true; value: T } | { ok: false }) => {
  if (!result.ok) throw new Error("Expected equation to parse");
  return result.value;
};

describe("parseEquation", () => {
  it.each([
    ["47 + 28 = 65", "75"],
    ["3/4 + 1/8 = 7/8", "7/8"],
    ["RM 12.50 - RM 3.20 = RM 9.30", "RM 9.30"],
  ])("parses and computes %s", (input, expected) => {
    const parsed = unwrap(parseEquation(input));
    expect(checkEquation(parsed).expected).toBe(expected);
  });

  it("preserves division separately from fraction literals", () => {
    expect(checkEquation(unwrap(parseEquation("3 / 4 = 0.75")))).toMatchObject({
      status: "correct",
      expected: "0.75",
    });
  });

  it.each([
    ["1 - 3 = -2", "-2"],
    ["0.5 - 1.25 = -0.75", "-0.75"],
    ["1/4 - 1/2 = -1/4", "-1/4"],
  ])("accepts a negative student answer in %s", (input, expected) => {
    const parsed = unwrap(parseEquation(input));
    expect(checkEquation(parsed)).toMatchObject({ status: "correct", expected });
  });

  it("normalizes supported OCR operators without converting words to operators", () => {
    expect(checkEquation(unwrap(parseEquation("6 x 7 = 42"))).status).toBe("correct");
    expect(checkEquation(unwrap(parseEquation("8 cm x 5 cm = 40 cm²"))).status).toBe("correct");
    expect(parseEquation("six x seven = 42")).toMatchObject({ ok: false });
  });

  it("rejects executable text", () => {
    expect(parseEquation("alert(1)")).toMatchObject({ ok: false });
    expect(parseEquation("1 + 1 = window.location")).toMatchObject({ ok: false });
  });

  it("returns structured errors without retaining student source text", () => {
    const result = parseEquation("1 + = 2");
    expect(result).toMatchObject({ ok: false, error: { code: expect.any(String) } });
    expect(JSON.stringify(result)).not.toContain("1 + = 2");
  });
});
