import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { createSessionAsset, type SessionAsset } from "../privacy/sessionAssets";
import { prepareImage, type PreparedImage } from "./imagePipeline";

const closeBitmap = (prepared: PreparedImage | null) => prepared?.bitmap.close?.();

export function MathScanner() {
  const cameraInput = useRef<HTMLInputElement>(null);
  const assetRef = useRef<SessionAsset | null>(null);
  const preparedRef = useRef<PreparedImage | null>(null);
  const requestId = useRef(0);
  const [asset, setAsset] = useState<SessionAsset | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasStartedCheck, setHasStartedCheck] = useState(false);

  const releaseCurrent = useCallback(() => {
    requestId.current += 1;
    assetRef.current?.release();
    closeBitmap(preparedRef.current);
    assetRef.current = null;
    preparedRef.current = null;
  }, []);

  useEffect(() => releaseCurrent, [releaseCurrent]);

  const selectFile = useCallback(async (file: File) => {
    releaseCurrent();
    setError(null);
    setHasStartedCheck(false);
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
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={onFileChange} />
        </label>
        <label className="secondary-action scanner__input-action">
          <span aria-hidden="true">🖼️</span>
          <span>从相册选择</span>
          <small>选择已有照片</small>
          <input type="file" accept="image/*" onChange={onFileChange} />
        </label>
      </div>

      {asset && (
        <section className="scanner__preview" aria-label="照片预览">
          <img src={asset.url} alt="待检查的数学作业照片" />
          <div>
            <p>{isPreparing ? "正在安全准备照片…" : "照片已准备好，可以开始检查。"}</p>
            <div className="scanner__controls">
              <button className="filter-button" type="button" onClick={() => cameraInput.current?.click()}>重新拍摄</button>
              <button className="filter-button" type="button" onClick={clearPhoto}>清除照片</button>
              <button className="scan-start" type="button" disabled={isPreparing} onClick={() => setHasStartedCheck(true)}>开始检查</button>
            </div>
            {hasStartedCheck && <p role="status">照片已准备，下一步将识别题目和答案。</p>}
          </div>
        </section>
      )}
      {error && <p className="scanner__error" role="alert">{error}</p>}
      <p className="scanner__privacy">照片只在此手机处理，不会上传、记录或保存在浏览器中。</p>
    </section>
  );
}
