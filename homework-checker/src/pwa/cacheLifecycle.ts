const APP_ROUTES = new Set(["/", "/scan", "/answers"]);
export const OCR_CACHE_PREFIX = "homework-checker-ocr-";

export const isAppShellNavigation = (
  url: URL,
  mode: RequestMode,
  origin: string,
) => mode === "navigate" && url.origin === origin && APP_ROUTES.has(url.pathname);

export const obsoleteOcrCacheNames = (
  names: readonly string[],
  current: string,
) => names.filter((name) => name.startsWith(OCR_CACHE_PREFIX) && name !== current);

export type CacheLifecycleStorage = {
  keys(): Promise<string[]>;
  delete(name: string): Promise<boolean>;
};

export async function cleanupObsoleteOcrCaches(
  cacheStorage: CacheLifecycleStorage,
  current: string,
): Promise<void> {
  const names = await cacheStorage.keys();
  await Promise.all(
    obsoleteOcrCacheNames(names, current).map((name) => cacheStorage.delete(name)),
  );
}

export type ServiceWorkerLifecycleEvent = {
  readonly data?: unknown;
  waitUntil(promise: Promise<unknown>): void;
};

export type ServiceWorkerUpdateScope = {
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(
    type: "message" | "activate",
    listener: (event: ServiceWorkerLifecycleEvent) => void,
  ): void;
};

export function installServiceWorkerUpdateLifecycle(
  scope: ServiceWorkerUpdateScope,
  cacheStorage: CacheLifecycleStorage,
  currentOcrCache: string,
): void {
  scope.addEventListener("message", (event) => {
    if ((event.data as { type?: string } | undefined)?.type === "SKIP_WAITING") {
      event.waitUntil(scope.skipWaiting());
    }
  });

  scope.addEventListener("activate", (event) => {
    event.waitUntil(
      cleanupObsoleteOcrCaches(cacheStorage, currentOcrCache)
        .then(() => scope.clients.claim()),
    );
  });
}
