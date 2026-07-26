/// <reference lib="webworker" />

import { clientsClaim, setCacheNameDetails } from "workbox-core";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";

const APP_VERSION = "0.1.0";
const serviceWorker = self as unknown as ServiceWorkerGlobalScope;

setCacheNameDetails({ prefix: "homework-checker", suffix: `v${APP_VERSION}` });
precacheAndRoute((self as unknown as { __WB_MANIFEST: Array<string | { url: string; revision?: string }> }).__WB_MANIFEST);
cleanupOutdatedCaches();
serviceWorker.skipWaiting();
clientsClaim();

// OCR resources are intentionally excluded from the install precache (~26 MB).
// They are added only after a successful first scan, and blob: photo URLs never
// match this same-origin route.
registerRoute(
  ({ url }) => url.origin === serviceWorker.location.origin && url.pathname.startsWith("/ocr/"),
  new CacheFirst({
    cacheName: `homework-checker-ocr-v${APP_VERSION}`,
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  }),
);
