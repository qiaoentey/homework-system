import type { Rect } from "./imagePipeline";

export type OcrLine = {
  text: string;
  confidence: number;
  /** Lowest Tesseract symbol confidence among digits and mathematical operators. */
  criticalConfidence: number;
  box: Rect;
};

export type OcrRequest = {
  type: "recognize";
  image: ImageData;
  languages: string[];
};

export type OcrProgressEvent = {
  type: "progress";
  stage: string;
  progress: number;
};

export type OcrResultEvent = {
  type: "result";
  lines: OcrLine[];
};

export type OcrErrorEvent = {
  type: "error";
  message: string;
};

export type OcrWorkerEvent = OcrProgressEvent | OcrResultEvent | OcrErrorEvent;

export type QuestionRegion = {
  id: string;
  lines: OcrLine[];
  box: Rect;
  /** Aggregate OCR confidence retained for diagnostics; it is not a location signal. */
  confidence: number;
  criticalConfidence: number;
  /** Independent geometric confidence that the lines form one located question. */
  locationConfidence: number;
};
