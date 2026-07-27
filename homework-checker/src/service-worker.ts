/// <reference lib="webworker" />

import { clientsClaim, setCacheNameDetails } from "workbox-core";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import {
  isAppShellNavigation,
  obsoleteOcrCacheNames,
  OCR_CACHE_PREFIX,
} from "./pwa/cacheLifecycle";

const serviceWorker = self as unknown as ServiceWorkerGlobalScope;
const OCR_CACHE_NAME = `${OCR_CACHE_PREFIX}${__OCR_CACHE_VERSION__}`;

setCacheNameDetails({ prefix: "homework-checker", suffix: "app" });
precacheAndRoute((self as unknown as { __WB_MANIFEST: Array<string | { url: string; revision?: string }> }).__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

// A new worker waits until the teacher explicitly accepts the update prompt.
// Workbox Window sends this message, then reloads as soon as this worker controls.
serviceWorker.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | undefined)?.type === "SKIP_WAITING") {
    void serviceWorker.skipWaiting();
  }
});

registerRoute(
  ({ request, url }) => isAppShellNavigation(url, request.mode, serviceWorker.location.origin),
  createHandlerBoundToURL("index.html"),
);

serviceWorker.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      obsoleteOcrCacheNames(names, OCR_CACHE_NAME).map((name) => caches.delete(name)),
    )).then(() => undefined),
  );
});

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
