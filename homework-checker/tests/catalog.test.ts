import { describe, expect, it } from "vitest";
import { ANSWER_RESOURCES, getResources } from "../src/answer-library/catalog";

describe("answer catalog", () => {
  it("contains exactly 12 grade-subject PDFs", () => {
    expect(ANSWER_RESOURCES).toHaveLength(12);
    expect(new Set(ANSWER_RESOURCES.map((item) => item.pdfPath)).size).toBe(12);
  });

  it("filters grade 2 mathematics to one resource", () => {
    expect(getResources({ grade: 2, subject: "数学" })).toMatchObject([
      { grade: 2, subject: "数学" },
    ]);
  });
});
