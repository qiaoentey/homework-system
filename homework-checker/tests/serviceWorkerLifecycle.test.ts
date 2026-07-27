import { describe, expect, it } from "vitest";
import * as cacheLifecycle from "../src/pwa/cacheLifecycle";

type LifecycleEvent = {
  waitUntil(promise: Promise<unknown>): void;
};

type UpdateWorkerScope = {
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(
    type: "message" | "activate",
    listener: (event: LifecycleEvent & { data?: unknown }) => void,
  ): void;
};

type LifecycleInstaller = (
  scope: UpdateWorkerScope,
  cacheStorage: cacheLifecycle.CacheLifecycleStorage,
  currentOcrCache: string,
) => void;

describe("production service worker update lifecycle", () => {
  it("wires SKIP_WAITING, activation cleanup and client claiming through production handlers", async () => {
    const installLifecycle = (
      cacheLifecycle as typeof cacheLifecycle & {
        installServiceWorkerUpdateLifecycle?: LifecycleInstaller;
      }
    ).installServiceWorkerUpdateLifecycle;
    if (!installLifecycle) {
      expect.fail("production service-worker lifecycle handlers are not installable in the harness");
    }

    const listeners = new Map<
      "message" | "activate",
      (event: LifecycleEvent & { data?: unknown }) => void
    >();
    let skipWaitingCount = 0;
    let claimCount = 0;
    const scope: UpdateWorkerScope = {
      async skipWaiting() {
        skipWaitingCount += 1;
      },
      clients: {
        async claim() {
          claimCount += 1;
        },
      },
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
    };
    const currentOcrCache = `${cacheLifecycle.OCR_CACHE_PREFIX}current`;
    const obsoleteOcrCache = `${cacheLifecycle.OCR_CACHE_PREFIX}obsolete`;
    const nonOcrCache = "homework-checker-precache-app";
    const cacheNames = new Set([currentOcrCache, obsoleteOcrCache, nonOcrCache]);
    const cacheStorage = {
      keys: async () => [...cacheNames],
      delete: async (name: string) => cacheNames.delete(name),
    };
    installLifecycle(scope, cacheStorage, currentOcrCache);

    const dispatch = async (
      type: "message" | "activate",
      event: { data?: unknown } = {},
    ) => {
      const work: Promise<unknown>[] = [];
      listeners.get(type)?.({
        ...event,
        waitUntil(promise) {
          work.push(promise);
        },
      });
      await Promise.all(work);
    };

    await dispatch("message", { data: { type: "SKIP_WAITING" } });
    expect(skipWaitingCount).toBe(1);

    await dispatch("activate");
    expect(claimCount).toBe(1);
    expect(cacheNames).toEqual(new Set([currentOcrCache, nonOcrCache]));
  });
});
