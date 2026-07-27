import { useRegisterSW } from "virtual:pwa-register/react";

export type RegisterServiceWorkerHook = typeof useRegisterSW;

export function PwaUpdatePrompt({
  useRegistration = useRegisterSW,
}: {
  useRegistration?: RegisterServiceWorkerHook;
}) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegistration();

  if (!needRefresh) return null;

  return (
    <aside className="pwa-update" role="status" aria-live="polite">
      <p>新版本已准备好。完成当前检查后再重新载入，不会在扫描途中强制更新。</p>
      <div>
        <button type="button" className="scan-start" onClick={() => void updateServiceWorker(true)}>
          更新并重新载入
        </button>
        <button type="button" className="filter-button" onClick={() => setNeedRefresh(false)}>
          稍后
        </button>
      </div>
    </aside>
  );
}
