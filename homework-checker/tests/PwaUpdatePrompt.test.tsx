import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PwaUpdatePrompt, type RegisterServiceWorkerHook } from "../src/pwa/PwaUpdatePrompt";
import {
  installServiceWorkerUpdateLifecycle,
  OCR_CACHE_PREFIX,
  type ServiceWorkerLifecycleEvent,
  type ServiceWorkerUpdateScope,
} from "../src/pwa/cacheLifecycle";

const registration = (
  needRefresh: boolean,
  updateServiceWorker = vi.fn().mockResolvedValue(undefined),
): ReturnType<RegisterServiceWorkerHook> => ({
  needRefresh: [needRefresh, vi.fn()],
  offlineReady: [false, vi.fn()],
  updateServiceWorker,
});

describe("PwaUpdatePrompt", () => {
  it("does not interrupt a client when no update is waiting", () => {
    render(<PwaUpdatePrompt useRegistration={() => registration(false)} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("runs waiting worker activation, cache cleanup, controller change and one reload after acceptance", async () => {
    const currentOcrCache = `${OCR_CACHE_PREFIX}current`;
    const obsoleteOcrCache = `${OCR_CACHE_PREFIX}obsolete`;
    const nonOcrCache = "homework-checker-precache-app";
    const cacheNames = new Set([currentOcrCache, obsoleteOcrCache, nonOcrCache]);
    const cacheStorage = {
      keys: async () => [...cacheNames],
      delete: async (name: string) => cacheNames.delete(name),
    };
    const postedMessages: unknown[] = [];
    let reloadCount = 0;
    let cacheNamesAtReload: string[] = [];
    let notifyNeedReload = () => {};

    let workerRegistration: { waiting: { postMessage: (message: unknown) => void } | null };
    class ControlledServiceWorkerClient extends EventTarget {
      controller: unknown = { version: "existing" };

      async getRegistration() {
        return workerRegistration;
      }
    }
    const serviceWorkerClient = new ControlledServiceWorkerClient();
    const workerListeners = new Map<
      "message" | "activate",
      (event: ServiceWorkerLifecycleEvent) => void
    >();
    const dispatchWorkerEvent = async (
      type: "message" | "activate",
      data?: unknown,
    ) => {
      const work: Promise<unknown>[] = [];
      workerListeners.get(type)?.({
        data,
        waitUntil(promise) {
          work.push(promise);
        },
      });
      await Promise.all(work);
    };
    let waitingWorker: { postMessage(message: unknown): void };
    const workerScope: ServiceWorkerUpdateScope = {
      async skipWaiting() {
        await dispatchWorkerEvent("activate");
      },
      clients: {
        async claim() {
          workerRegistration.waiting = null;
          serviceWorkerClient.controller = waitingWorker;
          notifyNeedReload();
          serviceWorkerClient.dispatchEvent(new Event("controllerchange"));
        },
      },
      addEventListener(type, listener) {
        workerListeners.set(type, listener);
      },
    };
    installServiceWorkerUpdateLifecycle(workerScope, cacheStorage, currentOcrCache);
    waitingWorker = {
      postMessage(message: unknown) {
        postedMessages.push(message);
        void dispatchWorkerEvent("message", message);
      },
    };
    workerRegistration = { waiting: waitingWorker };
    const useRegistration = ((options) => {
      notifyNeedReload = options?.onNeedReload ?? (() => {});
      options?.onRegisteredSW?.(
        "/service-worker.js",
        workerRegistration as unknown as ServiceWorkerRegistration,
      );
      return registration(true);
    }) as RegisterServiceWorkerHook;

    render(
      <PwaUpdatePrompt
        useRegistration={useRegistration}
        serviceWorkerClient={serviceWorkerClient}
        reloadPage={() => {
          reloadCount += 1;
          cacheNamesAtReload = [...cacheNames];
        }}
      />,
    );

    expect(serviceWorkerClient.controller).toEqual({ version: "existing" });
    expect(workerRegistration.waiting).toBe(waitingWorker);
    expect(postedMessages).toEqual([]);
    expect(cacheNames).toEqual(new Set([currentOcrCache, obsoleteOcrCache, nonOcrCache]));

    await userEvent.setup().click(screen.getByRole("button", { name: "更新并重新载入" }));

    await waitFor(() => {
      expect(postedMessages).toEqual([{ type: "SKIP_WAITING" }]);
      expect(serviceWorkerClient.controller).toBe(waitingWorker);
      expect(reloadCount).toBe(1);
    });
    expect(cacheNames).toEqual(new Set([currentOcrCache, nonOcrCache]));
    expect(cacheNamesAtReload).toEqual([currentOcrCache, nonOcrCache]);

    serviceWorkerClient.dispatchEvent(new Event("controllerchange"));
    expect(reloadCount).toBe(1);
  });

  it("reloads a prompted stale client once when another client activates the update", () => {
    const postedMessages: unknown[] = [];
    const waitingWorker = {
      postMessage(message: unknown) {
        postedMessages.push(message);
      },
    };
    const workerRegistration = { waiting: waitingWorker };
    class ControlledServiceWorkerClient extends EventTarget {
      controller: unknown = { version: "existing" };

      async getRegistration() {
        return workerRegistration;
      }
    }
    const serviceWorkerClient = new ControlledServiceWorkerClient();
    let notifyNeedReload = () => {};
    let reloadCount = 0;
    const useRegistration = ((options) => {
      notifyNeedReload = options?.onNeedReload ?? (() => {});
      options?.onRegisteredSW?.(
        "/service-worker.js",
        workerRegistration as unknown as ServiceWorkerRegistration,
      );
      return registration(true);
    }) as RegisterServiceWorkerHook;

    render(
      <PwaUpdatePrompt
        useRegistration={useRegistration}
        serviceWorkerClient={serviceWorkerClient}
        reloadPage={() => {
          reloadCount += 1;
        }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("新版本已准备好");
    expect(reloadCount).toBe(0);
    expect(postedMessages).toEqual([]);

    serviceWorkerClient.controller = { version: "accepted-by-another-client" };
    notifyNeedReload();
    notifyNeedReload();
    serviceWorkerClient.dispatchEvent(new Event("controllerchange"));

    expect(reloadCount).toBe(1);
    expect(postedMessages).toEqual([]);
  });
});
