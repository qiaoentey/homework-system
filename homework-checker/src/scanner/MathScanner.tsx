import { useCallback, useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from "react";
import { AnnotationCanvas, exportAnnotatedImage } from "../annotation/AnnotationCanvas";
import {
  createAnnotationState,
  dismissAnnotation,
  restoreRecognizedText,
  updateRecognizedText,
  type AnnotationState,
} from "../annotation/annotationModel";
import { createSessionAsset, type SessionAsset } from "../privacy/sessionAssets";
import { prepareImage, type PreparedImage, type Rect } from "./imagePipeline";
import type { OcrWorkerEvent, QuestionRegion } from "./ocr.types";
import { segmentQuestions } from "./questionSegmenter";

const closeBitmap = (prepared: PreparedImage | null) => prepared?.bitmap.close?.();
const DOWNLOAD_URL_REVOKE_DELAY_MS = 1_000;

export type OcrWorkerFactory = () => Worker;

export function MathScanner({ workerFactory }: { workerFactory?: OcrWorkerFactory }) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const assetRef = useRef<SessionAsset | null>(null);
  const preparedRef = useRef<PreparedImage | null>(null);
  const ocrWorkerRef = useRef<Worker | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const requestId = useRef(0);
  const exportRequestId = useRef(0);
  const downloadUrlTimers = useRef(new Map<string, ReturnType<typeof window.setTimeout>>());
  const [asset, setAsset] = useState<SessionAsset | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasStartedCheck, setHasStartedCheck] = useState(false);
  const [ocrStage, setOcrStage] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionRegion[]>([]);
  const [annotationState, setAnnotationState] = useState<AnnotationState | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [manualSelection, setManualSelection] = useState(false);
  const [selection, setSelection] = useState<Rect | null>(null);

  const releaseCurrent = useCallback(() => {
    requestId.current += 1;
    exportRequestId.current += 1;
    for (const [url, timer] of downloadUrlTimers.current) {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
    }
    downloadUrlTimers.current.clear();
    assetRef.current?.release();
    closeBitmap(preparedRef.current);
    ocrWorkerRef.current?.terminate();
    assetRef.current = null;
    preparedRef.current = null;
    ocrWorkerRef.current = null;
  }, []);

  useEffect(() => releaseCurrent, [releaseCurrent]);

  const selectFile = useCallback(async (file: File) => {
    releaseCurrent();
    setError(null);
    setHasStartedCheck(false);
    setOcrStage(null);
    setQuestions([]);
    setAnnotationState(null);
    setSelectedAnnotationId(null);
    setEditedText("");
    setExportError(null);
    setManualSelection(false);
    setSelection(null);
    const nextAsset = createSessionAsset(file);
    const activeRequest = requestId.current;
    assetRef.current = nextAsset;
    setAsset(nextAsset);
    setIsPreparing(true);

    try {
      const prepared = await prepareImage(file);
      if (requestId.current !== activeRequest || assetRef.current !== nextAsset) {
        closeBitmap(prepared);
        return;
      }
      preparedRef.current = prepared;
    } catch {
      if (requestId.current === activeRequest) {
        nextAsset.release();
        assetRef.current = null;
        setAsset(null);
        setError("无法处理这张照片，请重新拍摄或选择另一张图片。");
      }
    } finally {
      if (requestId.current === activeRequest) setIsPreparing(false);
    }
  }, [releaseCurrent]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (file) void selectFile(file);
  };

  const clearPhoto = () => {
    releaseCurrent();
    setAsset(null);
    setIsPreparing(false);
    setError(null);
    setHasStartedCheck(false);
    setOcrStage(null);
    setQuestions([]);
    setAnnotationState(null);
    setSelectedAnnotationId(null);
    setEditedText("");
    setExportError(null);
    setManualSelection(false);
    setSelection(null);
  };

  const failOcrWorker = (worker: Worker | null, message: string) => {
    if (worker && ocrWorkerRef.current === worker) {
      worker.terminate();
      ocrWorkerRef.current = null;
    }
    setOcrStage(null);
    setManualSelection(false);
    setError(message);
  };

  const imageDataFor = (prepared: PreparedImage, region?: Rect) => {
    const source = region ?? { x: 0, y: 0, width: prepared.width, height: prepared.height };
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.width));
    canvas.height = Math.max(1, Math.round(source.height));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("无法在此装置上准备识别图片。");
    context.drawImage(
      prepared.bitmap,
      source.x,
      source.y,
      source.width,
      source.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return context.getImageData(0, 0, canvas.width, canvas.height);
  };

  const recognize = useCallback((region?: Rect) => {
    const prepared = preparedRef.current;
    if (!prepared) return;

    setError(null);
    setQuestions([]);
    setOcrStage("读取模型…");
    let worker = ocrWorkerRef.current;

    try {
      if (!worker) {
        worker = workerFactory?.() ?? new Worker(new URL("./ocr.worker.ts", import.meta.url), { type: "module" });
        ocrWorkerRef.current = worker;
      }

      worker.onmessage = (event: MessageEvent<OcrWorkerEvent>) => {
        const message = event.data;
        if (message.type === "progress") {
          setOcrStage(`${message.stage}… ${Math.round(message.progress * 100)}%`);
        } else if (message.type === "result") {
          const regions = segmentQuestions(message.lines);
          setOcrStage(null);
          setQuestions(regions);
          setAnnotationState(regions.length ? createAnnotationState(regions) : null);
          setSelectedAnnotationId(null);
          if (!regions.length) {
            setManualSelection(true);
            setError("无法自动分题。请在照片上拖出一题的范围，再进行本机识别。");
          } else {
            setManualSelection(false);
          }
        } else {
          failOcrWorker(worker, `本机文字识别未能完成：${message.message}`);
        }
      };
      worker.onerror = () => failOcrWorker(worker, "本机文字识别进程已停止，请重试。");
      worker.onmessageerror = () => failOcrWorker(worker, "本机识别数据无法读取，请重新开始检查。");

      const image = imageDataFor(prepared, region);
      worker.postMessage({
        type: "recognize",
        image,
        languages: ["eng", "msa", "chi_tra"],
      }, [image.data.buffer as ArrayBuffer]);
    } catch (reason) {
      failOcrWorker(worker, reason instanceof Error
        ? `无法启动本机文字识别：${reason.message}`
        : "无法启动本机文字识别，请确认浏览器允许本机识别。");
    }
  }, [workerFactory]);

  const originalAnnotations = annotationState?.annotations ?? [];
  const imageSize = preparedRef.current
    ? preparedRef.current.toOriginal({ x: 0, y: 0, width: preparedRef.current.width, height: preparedRef.current.height })
    : null;
  const annotations = preparedRef.current
    ? originalAnnotations.map((annotation) => ({ ...annotation, box: preparedRef.current!.toOriginal(annotation.box) }))
    : [];
  const selectedIndex = originalAnnotations.findIndex((annotation) => annotation.id === selectedAnnotationId);
  const selectedAnnotation = selectedIndex < 0 ? null : originalAnnotations[selectedIndex];
  const activeErrors = originalAnnotations.filter((annotation) => !annotation.dismissed && annotation.severity === "error");
  const activeReviews = originalAnnotations.filter((annotation) => !annotation.dismissed && annotation.severity === "review");

  const selectAnnotation = (id: string) => {
    const annotation = originalAnnotations.find((candidate) => candidate.id === id);
    if (!annotation) return;
    setSelectedAnnotationId(id);
    setEditedText(annotation.recognized);
  };

  const saveRecognizedText = () => {
    if (!annotationState || !selectedAnnotationId) return;
    const next = updateRecognizedText(annotationState, selectedAnnotationId, editedText);
    setAnnotationState(next);
    setEditedText(next.annotations.find((annotation) => annotation.id === selectedAnnotationId)?.recognized ?? editedText);
  };

  const restoreRecognized = () => {
    if (!annotationState || !selectedAnnotationId) return;
    const next = restoreRecognizedText(annotationState, selectedAnnotationId);
    setAnnotationState(next);
    setEditedText(next.annotations.find((annotation) => annotation.id === selectedAnnotationId)?.recognized ?? "");
  };

  const cancelAnnotation = () => {
    if (!annotationState || !selectedAnnotationId) return;
    setAnnotationState(dismissAnnotation(annotationState, selectedAnnotationId));
  };

  const downloadAnnotatedImage = async () => {
    if (!asset || !imageSize) return;
    const requestedAsset = asset;
    const exportRequest = ++exportRequestId.current;
    const isCurrentExport = () => exportRequestId.current === exportRequest && assetRef.current === requestedAsset;
    setExportError(null);
    const image = new Image();
    image.onload = async () => {
      if (!isCurrentExport()) return;
      try {
        const blob = await exportAnnotatedImage(image, annotations);
        if (!isCurrentExport()) return;
        const url = URL.createObjectURL(blob);
        const timestamp = new Date();
        const stamp = `${timestamp.getFullYear()}${String(timestamp.getMonth() + 1).padStart(2, "0")}${String(timestamp.getDate()).padStart(2, "0")}-${String(timestamp.getHours()).padStart(2, "0")}${String(timestamp.getMinutes()).padStart(2, "0")}`;
        const link = document.createElement("a");
        const revokeDownloadUrl = () => {
          const timer = downloadUrlTimers.current.get(url);
          if (timer !== undefined) window.clearTimeout(timer);
          downloadUrlTimers.current.delete(url);
          URL.revokeObjectURL(url);
        };
        const timer = window.setTimeout(revokeDownloadUrl, DOWNLOAD_URL_REVOKE_DELAY_MS);
        downloadUrlTimers.current.set(url, timer);
        link.href = url;
        link.download = `数学批改-${stamp}.jpg`;
        try {
          link.click();
        } catch (reason) {
          revokeDownloadUrl();
          throw reason;
        }
      } catch (reason) {
        if (isCurrentExport()) setExportError(reason instanceof Error ? reason.message : "无法导出批改图。");
      }
    };
    image.onerror = () => {
      if (isCurrentExport()) setExportError("照片无法加载，无法导出批改图。");
    };
    image.src = asset.url;
  };

  const pointInImage = (event: PointerEvent<HTMLDivElement>) => {
    const prepared = preparedRef.current;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!prepared || !bounds.width || !bounds.height) return null;
    return {
      x: Math.max(0, Math.min(prepared.width, (event.clientX - bounds.left) * prepared.width / bounds.width)),
      y: Math.max(0, Math.min(prepared.height, (event.clientY - bounds.top) * prepared.height / bounds.height)),
    };
  };

  const onSelectionStart = (event: PointerEvent<HTMLDivElement>) => {
    if (!manualSelection || ocrStage) return;
    const point = pointInImage(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = point;
    setSelection({ x: point.x, y: point.y, width: 0, height: 0 });
  };

  const onSelectionMove = (event: PointerEvent<HTMLDivElement>) => {
    const point = pointInImage(event);
    const start = dragStart.current;
    if (!start || !point) return;
    setSelection({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    });
  };

  const onSelectionEnd = (event: PointerEvent<HTMLDivElement>) => {
    const point = pointInImage(event);
    const start = dragStart.current;
    dragStart.current = null;
    if (!start || !point) return;
    const region = {
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    };
    if (region.width < 12 || region.height < 12) {
      setError("请选择完整的一题范围后再识别。");
      return;
    }
    setSelection(region);
    recognize(region);
  };

  return (
    <section className="scanner" aria-labelledby="scan-title">
      <p className="eyebrow">数学功课检查</p>
      <h1 id="scan-title">拍照检查数学</h1>
      <p>拍下完整、光线充足的作业页；我们会在本机调整图片，方便接下来的检查。</p>

      <div className="scanner__actions">
        <label className="primary-action scanner__input-action">
          <span aria-hidden="true">📷</span>
          <span>拍照</span>
          <small>使用后置相机</small>
          <input ref={cameraInput} aria-label="拍照" type="file" accept="image/*" capture="environment" onChange={onFileChange} />
        </label>
        <label className="secondary-action scanner__input-action">
          <span aria-hidden="true">🖼️</span>
          <span>从相册选择</span>
          <small>选择已有照片</small>
          <input aria-label="从相册选择" type="file" accept="image/*" onChange={onFileChange} />
        </label>
      </div>

      {asset && (
        <section className="scanner__preview" aria-label="照片预览">
          <div
            className={`scanner__image-frame${manualSelection ? " scanner__image-frame--selecting" : ""}`}
            onPointerDown={onSelectionStart}
            onPointerMove={onSelectionMove}
            onPointerUp={onSelectionEnd}
          >
            {imageSize && annotations.length ? (
              <AnnotationCanvas imageUrl={asset.url} width={imageSize.width} height={imageSize.height} annotations={annotations} onSelect={selectAnnotation} />
            ) : <img src={asset.url} alt="待检查的数学作业照片" />}
            {selection && preparedRef.current && (
              <span
                className="scanner__selection"
                aria-hidden="true"
                style={{
                  left: `${selection.x / preparedRef.current.width * 100}%`, top: `${selection.y / preparedRef.current.height * 100}%`,
                  width: `${selection.width / preparedRef.current.width * 100}%`, height: `${selection.height / preparedRef.current.height * 100}%`,
                }}
              />
            )}
          </div>
          <div>
            <p>{isPreparing ? "正在安全准备照片…" : ocrStage ?? "照片已准备好，可以开始检查。"}</p>
            <div className="scanner__controls">
              <button className="filter-button" type="button" onClick={() => cameraInput.current?.click()}>重新拍摄</button>
              <button className="filter-button" type="button" onClick={clearPhoto}>清除照片</button>
              <button className="scan-start" type="button" disabled={isPreparing || Boolean(ocrStage)} onClick={() => { setHasStartedCheck(true); recognize(); }}>开始检查</button>
            </div>
            {hasStartedCheck && !ocrStage && !questions.length && !manualSelection && <p role="status">照片已准备，正在等待开始识别。</p>}
            {questions.length > 0 && <p role="status">已在本机找到 {questions.length} 题。</p>}
            {manualSelection && <p role="status">请在照片上拖出一题范围；只会重新识别所选区域。</p>}
          </div>
        </section>
      )}
      {originalAnnotations.length > 0 && (
        <section className="scanner__results" aria-labelledby="annotation-results-title">
          <h2 id="annotation-results-title">检查结果</h2>
          <p className="scanner__result-summary">发现 {activeErrors.length} 个确定错误{activeReviews.length ? `，${activeReviews.length} 个需要复核` : ""}</p>
          <button type="button" className="scan-start" onClick={() => void downloadAnnotatedImage()}>下载批改图</button>
          {exportError && <p role="alert" className="scanner__error">{exportError}</p>}
        </section>
      )}
      {selectedAnnotation && (
        <aside className="annotation-drawer" aria-labelledby="annotation-drawer-title">
          <div>
            <p className="eyebrow">第 {selectedIndex + 1} 题</p>
            <h2 id="annotation-drawer-title">{selectedAnnotation.dismissed ? "此标记已取消" : selectedAnnotation.severity === "error" ? "确定错误" : selectedAnnotation.severity === "review" ? "需要复核" : "答案正确"}</h2>
          </div>
          <label>
            识别内容
            <input value={editedText} onChange={(event) => setEditedText(event.target.value)} aria-label="识别内容" />
          </label>
          <p>原因：{selectedAnnotation.reason}</p>
          {selectedAnnotation.expected && <p>建议答案：{selectedAnnotation.expected}</p>}
          <div className="annotation-drawer__actions">
            <button type="button" className="scan-start" onClick={saveRecognizedText}>系统读错了</button>
            <button type="button" className="filter-button" onClick={restoreRecognized}>恢复</button>
            <button type="button" className="filter-button" onClick={cancelAnnotation} disabled={selectedAnnotation.dismissed}>取消标记</button>
          </div>
        </aside>
      )}
      {error && <p className="scanner__error" role="alert">{error}</p>}
      <p className="scanner__privacy">照片只在此手机处理，不会上传、记录或保存在浏览器中。</p>
    </section>
  );
}
