import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnnotationCanvas, exportOriginalAnnotatedImage } from "../src/annotation/AnnotationCanvas";
import type { Annotation } from "../src/math/analyzeQuestions";

const annotations: Annotation[] = [
  { id: "error", questionId: "error", box: { x: 1, y: 2, width: 30, height: 40 }, severity: "error", recognized: "", originalRecognized: "", reason: "", confidence: 1, dismissed: false },
  { id: "review", questionId: "review", box: { x: 2, y: 3, width: 30, height: 40 }, severity: "review", recognized: "", originalRecognized: "", reason: "", confidence: 1, dismissed: false },
  { id: "pass", questionId: "pass", box: { x: 3, y: 4, width: 30, height: 40 }, severity: "pass", recognized: "", originalRecognized: "", reason: "", confidence: 1, dismissed: false },
];

describe("AnnotationCanvas", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

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

  it("decodes color source only for export and scales marks to oriented source resolution", async () => {
    const source = { width: 2400, height: 3000, close: vi.fn() } as unknown as ImageBitmap;
    const createImageBitmap = vi.fn().mockResolvedValue(source);
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    const strokeRect = vi.fn();
    const drawImage = vi.fn();
    const canvas = document.createElement("canvas");
    vi.spyOn(document, "createElement").mockReturnValue(canvas);
    vi.spyOn(canvas, "getContext").mockReturnValue({
      drawImage, strokeRect, save: vi.fn(), restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(canvas, "toBlob").mockImplementation((callback) => callback(
      new Blob(["color-source-export"], { type: "image/jpeg" }),
    ));
    const file = new File(["original-color"], "worksheet.jpg", { type: "image/jpeg" });
    const sourceAnnotation: Annotation = {
      ...annotations[0],
      box: { x: 40, y: 90, width: 360, height: 60 },
    };

    await exportOriginalAnnotatedImage(
      file,
      { width: 800, height: 1000 },
      [sourceAnnotation],
    );

    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: "from-image" });
    expect(canvas).toMatchObject({ width: 2400, height: 3000 });
    expect(drawImage).toHaveBeenCalledWith(source, 0, 0, 2400, 3000);
    expect(strokeRect).toHaveBeenCalledWith(120, 270, 1080, 180);
    expect(source.close).toHaveBeenCalledOnce();
  });
});
