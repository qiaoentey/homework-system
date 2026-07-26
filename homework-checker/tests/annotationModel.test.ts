import { describe, expect, it } from "vitest";
import {
  createAnnotationState,
  dismissAnnotation,
  restoreRecognizedText,
  updateRecognizedText,
} from "../src/annotation/annotationModel";
import type { QuestionRegion } from "../src/scanner/ocr.types";

const region = (id: string, text: string): QuestionRegion => ({
  id,
  lines: [{ text, confidence: 96, box: { x: 0, y: 0, width: 200, height: 30 } }],
  box: { x: 0, y: 0, width: 200, height: 30 },
  confidence: 96,
});

describe("annotationModel", () => {
  it("rechecks only the edited annotation and keeps its original OCR text for restore", () => {
    const state = createAnnotationState([
      region("question-1", "47 + 28 = 65"),
      region("question-2", "9 + 1 = 10"),
    ]);
    const unchanged = state.annotations[1];

    const corrected = updateRecognizedText(state, "question-1", "47 + 28 = 75");

    expect(corrected.annotations[0]).toMatchObject({
      severity: "pass",
      recognized: "47 + 28 = 75",
      originalRecognized: "47 + 28 = 65",
    });
    expect(corrected.annotations[1]).toBe(unchanged);
    expect(state.annotations[0].recognized).toBe("47 + 28 = 65");

    expect(restoreRecognizedText(corrected, "question-1").annotations[0]).toMatchObject({
      severity: "error",
      recognized: "47 + 28 = 65",
      originalRecognized: "47 + 28 = 65",
    });
  });

  it("dismisses without deleting current or original annotation data", () => {
    const state = createAnnotationState([region("question-1", "47 + 28 = 65")]);
    const dismissed = dismissAnnotation(state, "question-1");

    expect(dismissed.annotations[0]).toMatchObject({
      dismissed: true,
      recognized: "47 + 28 = 65",
      originalRecognized: "47 + 28 = 65",
    });
    expect(dismissed.regionsByAnnotationId["question-1"]).toBe(state.regionsByAnnotationId["question-1"]);
  });
});
