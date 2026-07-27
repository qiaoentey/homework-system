import { describe, expect, it } from "vitest";
import {
  isPathInBase,
  normalizeBasePath,
  pathInBase,
} from "../src/pwa/deploymentPaths";

describe("deployment paths", () => {
  it.each([
    ["/", "/"],
    ["/homework-system", "/homework-system/"],
    ["/homework-system/", "/homework-system/"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeBasePath(input)).toBe(expected);
  });

  it("places resources inside the project base", () => {
    expect(pathInBase("/homework-system/", "ocr/eng.traineddata.gz"))
      .toBe("/homework-system/ocr/eng.traineddata.gz");
  });

  it("does not match another repository's OCR path", () => {
    expect(isPathInBase(
      "/other/ocr/eng.traineddata.gz",
      "/homework-system/",
      "ocr/",
    )).toBe(false);
  });
});
