/// <reference lib="webworker" />

import { setCacheNameDetails } from "workbox-core";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import {
  installServiceWorkerUpdateLifecycle,
  isAppShellNavigation,
  OCR_CACHE_PREFIX,
  type ServiceWorkerUpdateScope,
} from "./pwa/cacheLifecycle";

const serviceWorker = self as unknown as ServiceWorkerGlobalScope;
const OCR_CACHE_NAME = `${OCR_CACHE_PREFIX}${__OCR_CACHE_VERSION__}`;

setCacheNameDetails({ prefix: "homework-checker", suffix: "app" });
precacheAndRoute((self as unknown as { __WB_MANIFEST: Array<string | { url: string; revision?: string }> }).__WB_MANIFEST);
cleanupOutdatedCaches();

// A new worker waits until the teacher explicitly accepts the update prompt.
// The shared lifecycle installs the exact message/activate handlers exercised
// by the controlled-client update test.
installServiceWorkerUpdateLifecycle(
  serviceWorker as unknown as ServiceWorkerUpdateScope,
  caches,
  OCR_CACHE_NAME,
);

registerRoute(
  ({ request, url }) => isAppShellNavigation(url, request.mode, serviceWorker.location.origin),
  createHandlerBoundToURL("index.html"),
);

// OCR resources are intentionally excluded from the install precache (~26 MB).
// They are added only after a successful first scan, and blob: photo URLs never
// match this same-origin route.
registerRoute(
  ({ url }) => url.origin === serviceWorker.location.origin && url.pathname.startsWith("/ocr/"),
  new CacheFirst({
    cacheName: OCR_CACHE_NAME,
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  }),
);
