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
