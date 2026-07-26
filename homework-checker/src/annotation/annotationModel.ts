import { analyzeQuestion, analyzeQuestions, type Annotation } from "../math/analyzeQuestions";
import type { QuestionRegion } from "../scanner/ocr.types";

export type AnnotationState = {
  annotations: Annotation[];
  regionsByAnnotationId: Record<string, QuestionRegion>;
};

/** Creates the session state needed to recompute an edited annotation in isolation. */
export function createAnnotationState(regions: QuestionRegion[]): AnnotationState {
  const annotations = analyzeQuestions(regions);
  return {
    annotations,
    regionsByAnnotationId: Object.fromEntries(annotations.map((annotation, index) => [annotation.id, regions[index]])),
  };
}

/** Rechecks exactly one teacher-edited OCR value while retaining its initial OCR text. */
export function updateRecognizedText(state: AnnotationState, id: string, text: string): AnnotationState {
  const index = state.annotations.findIndex((annotation) => annotation.id === id);
  const region = state.regionsByAnnotationId[id];
  if (index < 0 || !region) return state;

  const previous = state.annotations[index];
  const recalculated = analyzeQuestion(region, text);
  const updated: Annotation = {
    ...recalculated,
    originalRecognized: previous.originalRecognized,
    dismissed: previous.dismissed,
  };
  const annotations = [...state.annotations];
  annotations[index] = updated;
  return { ...state, annotations };
}

/** Restores the original OCR text through the same single-annotation recheck path. */
export function restoreRecognizedText(state: AnnotationState, id: string): AnnotationState {
  const annotation = state.annotations.find((candidate) => candidate.id === id);
  return annotation ? updateRecognizedText(state, id, annotation.originalRecognized) : state;
}

/** Marks an annotation as hidden without removing its audit information. */
export function dismissAnnotation(state: AnnotationState, id: string): AnnotationState {
  const index = state.annotations.findIndex((annotation) => annotation.id === id);
  if (index < 0) return state;

  const annotations = [...state.annotations];
  annotations[index] = { ...annotations[index], dismissed: true };
  return { ...state, annotations };
}
