import { useEffect, useRef } from "react";
import type { Annotation, AnnotationSeverity } from "../math/analyzeQuestions";
import { MAX_SOURCE_PIXELS } from "../scanner/imagePipeline";

const colorFor: Record<AnnotationSeverity, string> = {
  error: "#D92D20",
  review: "#F79009",
  pass: "#12B76A",
};

const labelFor: Record<AnnotationSeverity, string> = {
  error: "错误",
  review: "需要复核",
  pass: "正确",
};

export type AnnotationCanvasProps = {
  imageUrl: string;
  width: number;
  height: number;
  annotations: Annotation[];
  onSelect: (annotationId: string) => void;
};

/**
 * Renders annotations in the image's natural coordinate space. The browser may
 * resize the wrapper, but never the canvas drawing coordinate system.
 */
export function AnnotationCanvas({ imageUrl, width, height, annotations, onSelect }: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.clearRect(0, 0, width, height);
    for (const annotation of annotations) {
      if (annotation.dismissed) continue;
      context.save();
      context.strokeStyle = colorFor[annotation.severity];
      context.lineWidth = Math.max(3, Math.round(Math.min(width, height) / 360));
      if (annotation.severity === "pass") context.globalAlpha = 0.55;
      context.strokeRect(annotation.box.x, annotation.box.y, annotation.box.width, annotation.box.height);
      context.restore();
    }
  }, [annotations, height, width]);

  return (
    <div className="annotation-canvas" style={{ aspectRatio: `${width} / ${height}`, maxWidth: `${Math.min(width, width * 420 / height)}px` }}>
      <img src={imageUrl} alt="已识别的数学作业照片" />
      <canvas ref={canvasRef} width={width} height={height} aria-hidden="true" />
      {annotations.map((annotation, index) => {
        if (annotation.dismissed) return null;
        return (
          <button
            key={annotation.id}
            className={`annotation-canvas__target annotation-canvas__target--${annotation.severity}`}
            type="button"
            style={{
              left: `${annotation.box.x / width * 100}%`,
              top: `${annotation.box.y / height * 100}%`,
              width: `${annotation.box.width / width * 100}%`,
              height: `${annotation.box.height / height * 100}%`,
            }}
            onClick={() => onSelect(annotation.id)}
          >
            <span className="sr-only">查看第 {index + 1} 题{labelFor[annotation.severity]}</span>
          </button>
        );
      })}
    </div>
  );
}

const dimensionsFor = (image: CanvasImageSource) => {
  if (image instanceof HTMLImageElement) return { width: image.naturalWidth, height: image.naturalHeight };
  if (image instanceof HTMLVideoElement) return { width: image.videoWidth, height: image.videoHeight };
  const source = image as CanvasImageSource & { width?: number; height?: number; displayWidth?: number; displayHeight?: number };
  return { width: source.width ?? source.displayWidth ?? 0, height: source.height ?? source.displayHeight ?? 0 };
};

/** Composites only active annotations into the explicit-download normalized JPEG (maximum 1600 px side). */
export async function exportAnnotatedImage(image: CanvasImageSource, annotations: Annotation[]): Promise<Blob> {
  const { width, height } = dimensionsFor(image);
  if (!width || !height) throw new Error("照片尚未加载，无法导出批改图。");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("此浏览器无法合成批改图。");

  context.drawImage(image, 0, 0, width, height);
  for (const annotation of annotations) {
    if (annotation.dismissed) continue;
    context.save();
    context.strokeStyle = colorFor[annotation.severity];
    context.lineWidth = Math.max(3, Math.round(Math.min(width, height) / 360));
    if (annotation.severity === "pass") context.globalAlpha = 0.55;
    context.strokeRect(annotation.box.x, annotation.box.y, annotation.box.width, annotation.box.height);
    context.restore();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("无法生成批改图。")), "image/jpeg", 0.92);
  });
}

/** Decodes the unchanged color File only after explicit export and maps normalized marks once. */
export async function exportOriginalAnnotatedImage(
  file: File,
  normalized: { width: number; height: number },
  annotations: Annotation[],
  options: { signal?: AbortSignal } = {},
): Promise<Blob> {
  if (options.signal?.aborted) throw new DOMException("Image export was canceled.", "AbortError");
  const source = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    if (options.signal?.aborted) throw new DOMException("Image export was canceled.", "AbortError");
    if (source.width * source.height > MAX_SOURCE_PIXELS) {
      throw new Error("原始照片过大，无法安全导出批改图。");
    }
    const scaleX = source.width / normalized.width;
    const scaleY = source.height / normalized.height;
    const sourceAnnotations = annotations.map((annotation) => ({
      ...annotation,
      box: {
        x: annotation.box.x * scaleX,
        y: annotation.box.y * scaleY,
        width: annotation.box.width * scaleX,
        height: annotation.box.height * scaleY,
      },
    }));
    const blob = await exportAnnotatedImage(source, sourceAnnotations);
    if (options.signal?.aborted) throw new DOMException("Image export was canceled.", "AbortError");
    return blob;
  } finally {
    source.close?.();
  }
}
