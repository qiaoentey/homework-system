import { useEffect, useMemo, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  PwaUpdateCoordinator,
  type ControlledServiceWorkerClient,
  type WaitingUpdateRegistration,
} from "./updateCoordinator";

export type RegisterServiceWorkerHook = typeof useRegisterSW;

const reloadCurrentPage = () => window.location.reload();

export function PwaUpdatePrompt({
  useRegistration = useRegisterSW,
  serviceWorkerClient = (
    typeof navigator !== "undefined" && "serviceWorker" in navigator
      ? navigator.serviceWorker as unknown as ControlledServiceWorkerClient
      : undefined
  ),
  reloadPage = reloadCurrentPage,
}: {
  useRegistration?: RegisterServiceWorkerHook;
  serviceWorkerClient?: ControlledServiceWorkerClient;
  reloadPage?: () => void;
}) {
  const registration = useRef<WaitingUpdateRegistration | undefined>(undefined);
  const coordinator = useMemo(
    () => serviceWorkerClient
      ? new PwaUpdateCoordinator(serviceWorkerClient, reloadPage)
      : undefined,
    [reloadPage, serviceWorkerClient],
  );
  useEffect(() => () => coordinator?.dispose(), [coordinator]);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
  } = useRegistration({
    onRegisteredSW: (_scriptUrl, currentRegistration) => {
      registration.current = currentRegistration;
    },
    onNeedReload: () => coordinator?.updateBecameControlling(),
  });

  if (!needRefresh) return null;

  return (
    <aside className="pwa-update" role="status" aria-live="polite">
      <p>新版本已准备好。完成当前检查后再重新载入，不会在扫描途中强制更新。</p>
      <div>
        <button
          type="button"
          className="scan-start"
          onClick={() => void coordinator?.acceptUpdate(registration.current)}
        >
          更新并重新载入
        </button>
        <button type="button" className="filter-button" onClick={() => setNeedRefresh(false)}>
          稍后
        </button>
      </div>
    </aside>
  );
}
