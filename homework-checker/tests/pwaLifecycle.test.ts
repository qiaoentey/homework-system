import { describe, expect, it } from "vitest";
import {
  isAppShellNavigation,
  obsoleteOcrCacheNames,
} from "../src/pwa/cacheLifecycle";

describe("PWA navigation and OCR cache lifecycle", () => {
  it("uses the app shell for the application root", () => {
    expect(isAppShellNavigation(new URL("https://example.test/"), "navigate", "https://example.test", "/")).toBe(true);
  });

  it.each([
    "/scan",
    "/answers",
    "/pdf/answer.pdf",
    "/ocr/eng.traineddata.gz",
    "/assets/app.js",
    "/not-an-app-route",
  ])("does not return HTML for the resource path %s", (path) => {
    expect(isAppShellNavigation(new URL(`https://example.test${path}`), "navigate", "https://example.test", "/")).toBe(false);
  });

  it("does not intercept cross-origin or non-navigation requests", () => {
    expect(isAppShellNavigation(new URL("https://other.test/scan"), "navigate", "https://example.test", "/")).toBe(false);
    expect(isAppShellNavigation(new URL("https://example.test/scan"), "cors", "https://example.test", "/")).toBe(false);
  });

  it("matches only the normalized project root", () => {
    expect(isAppShellNavigation(
      new URL("https://example.test/homework-system/"),
      "navigate",
      "https://example.test",
      "/homework-system/",
    )).toBe(true);

    expect(isAppShellNavigation(
      new URL("https://example.test/"),
      "navigate",
      "https://example.test",
      "/homework-system/",
    )).toBe(false);
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
