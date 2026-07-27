import { describe, expect, it } from "vitest";
import {
  isAppShellNavigation,
  obsoleteOcrCacheNames,
} from "../src/pwa/cacheLifecycle";

describe("PWA navigation and OCR cache lifecycle", () => {
  it.each(["/", "/scan", "/answers"])("uses the app shell only for the application route %s", (path) => {
    expect(isAppShellNavigation(new URL(`https://example.test${path}`), "navigate", "https://example.test")).toBe(true);
  });

  it.each([
    "/pdf/answer.pdf",
    "/ocr/eng.traineddata.gz",
    "/assets/app.js",
    "/not-an-app-route",
  ])("does not return HTML for the resource path %s", (path) => {
    expect(isAppShellNavigation(new URL(`https://example.test${path}`), "navigate", "https://example.test")).toBe(false);
  });

  it("does not intercept cross-origin or non-navigation requests", () => {
    expect(isAppShellNavigation(new URL("https://other.test/scan"), "navigate", "https://example.test")).toBe(false);
    expect(isAppShellNavigation(new URL("https://example.test/scan"), "cors", "https://example.test")).toBe(false);
  });

  it("deletes only obsolete homework-checker OCR caches", () => {
    expect(obsoleteOcrCacheNames([
      "homework-checker-ocr-a1",
      "homework-checker-ocr-b2",
      "homework-checker-precache-app",
      "another-app-ocr-a1",
    ], "homework-checker-ocr-b2")).toEqual(["homework-checker-ocr-a1"]);
  });
});
