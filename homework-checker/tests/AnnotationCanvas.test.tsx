import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnnotationCanvas } from "../src/annotation/AnnotationCanvas";
import type { Annotation } from "../src/math/analyzeQuestions";

const annotations: Annotation[] = [
  { id: "error", questionId: "error", box: { x: 1, y: 2, width: 30, height: 40 }, severity: "error", recognized: "", originalRecognized: "", reason: "", confidence: 1, dismissed: false },
  { id: "review", questionId: "review", box: { x: 2, y: 3, width: 30, height: 40 }, severity: "review", recognized: "", originalRecognized: "", reason: "", confidence: 1, dismissed: false },
  { id: "pass", questionId: "pass", box: { x: 3, y: 4, width: 30, height: 40 }, severity: "pass", recognized: "", originalRecognized: "", reason: "", confidence: 1, dismissed: false },
];

describe("AnnotationCanvas", () => {
  afterEach(() => vi.restoreAllMocks());

  it("draws error, review and pass boxes with their distinct required colors", () => {
    const strokeColors: string[] = [];
    const context = {
      clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), strokeRect: vi.fn(),
      set strokeStyle(value: string) { strokeColors.push(value); },
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);

    render(<AnnotationCanvas imageUrl="blob:worksheet" width={100} height={120} annotations={annotations} onSelect={vi.fn()} />);

    expect(strokeColors).toEqual(["#D92D20", "#F79009", "#12B76A"]);
  });
});
