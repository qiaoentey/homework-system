import type { Rect } from "../scanner/imagePipeline";
import type { QuestionRegion } from "../scanner/ocr.types";
import { checkEquation } from "./checkers";
import { parseEquation } from "./parser";

export type AnnotationSeverity = "error" | "review" | "pass";

export type Annotation = {
  id: string;
  questionId: string;
  box: Rect;
  severity: AnnotationSeverity;
  recognized: string;
  originalRecognized: string;
  expected?: string;
  reason: string;
  confidence: number;
  dismissed: boolean;
};

const OCR_CONFIDENCE_THRESHOLD = 0.85;
const REGION_CONFIDENCE_THRESHOLD = 0.8;

/** Converts Tesseract's 0-100 scores and normalized scores to one shared scale. */
export const normalizeConfidence = (confidence: number) => {
  if (!Number.isFinite(confidence)) return 0;
  const normalized = confidence > 1 ? confidence / 100 : confidence;
  return Math.max(0, Math.min(1, normalized));
};

export const recognizedTextFor = (region: Pick<QuestionRegion, "lines">) => region.lines
  .map((line) => line.text.trim())
  .filter(Boolean)
  .join(" ");

// Number labels describe the worksheet layout, not a student expression. They
// stay visible in the annotation but are excluded from deterministic parsing.
const equationTextFor = (recognized: string) =>
  recognized.replace(/^\s*\d{1,3}(?:[)、]\s*|[.，,]\s+)/, "");

const ocrConfidenceFor = (region: Pick<QuestionRegion, "criticalConfidence">) => {
  return normalizeConfidence(region.criticalConfidence);
};

type AnalysisInput = Pick<QuestionRegion, "id" | "box" | "criticalConfidence" | "locationConfidence" | "lines">;

/**
 * Analyses one recognized question with the confidence gates used for annotations.
 * An expected answer is only ever exposed after a complete student equation parsed.
 */
export function analyzeQuestion(region: AnalysisInput, recognized = recognizedTextFor(region)): Annotation {
  const ocrConfidence = ocrConfidenceFor(region);
  const regionConfidence = normalizeConfidence(region.locationConfidence);
  const parsed = parseEquation(equationTextFor(recognized));
  const base = {
    id: region.id,
    questionId: region.id,
    box: region.box,
    recognized,
    originalRecognized: recognized,
    dismissed: false,
  };

  if (!parsed.ok) {
    return {
      ...base,
      severity: "review",
      expected: undefined,
      reason: "The recognized text is not a complete equation with a student answer.",
      confidence: Math.min(ocrConfidence, regionConfidence),
    };
  }

  const result = checkEquation(parsed.value);
  const confidence = Math.min(ocrConfidence, regionConfidence, result.confidence);
  if (result.status === "uncertain") {
    return { ...base, severity: "review", expected: undefined, reason: result.reason, confidence };
  }

  if (result.status === "correct") {
    return {
      ...base,
      severity: ocrConfidence >= OCR_CONFIDENCE_THRESHOLD ? "pass" : "review",
      expected: result.expected,
      reason: result.reason,
      confidence,
    };
  }

  const hasHighConfidenceError = ocrConfidence >= OCR_CONFIDENCE_THRESHOLD
    && regionConfidence >= REGION_CONFIDENCE_THRESHOLD
    && result.confidence > 0;

  return {
    ...base,
    severity: hasHighConfidenceError ? "error" : "review",
    expected: result.expected,
    reason: result.reason,
    confidence,
  };
}

export function analyzeQuestions(regions: QuestionRegion[]): Annotation[] {
  return regions.map((region) => analyzeQuestion(region));
}
