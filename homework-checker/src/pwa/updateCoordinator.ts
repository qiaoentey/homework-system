export type WaitingUpdateWorker = {
  postMessage(message: unknown): void;
};

export type WaitingUpdateRegistration = {
  readonly waiting: WaitingUpdateWorker | null;
};

export type ControlledServiceWorkerClient = {
  readonly controller: unknown | null;
  getRegistration(): Promise<WaitingUpdateRegistration | undefined>;
  addEventListener(
    type: "controllerchange",
    listener: EventListener,
    options?: AddEventListenerOptions,
  ): void;
  removeEventListener(type: "controllerchange", listener: EventListener): void;
};

/**
 * Coordinates a teacher-approved update for an already controlled client.
 * Browser-owned registration and navigation effects stay behind narrow
 * dependencies so the complete waiting-worker lifecycle remains testable.
 */
export class PwaUpdateCoordinator {
  private activationRequested = false;

  private listeningForController = false;

  private reloaded = false;

  constructor(
    private readonly serviceWorkers: ControlledServiceWorkerClient,
    private readonly reloadPage: () => void,
  ) {}

  async acceptUpdate(registration?: WaitingUpdateRegistration): Promise<boolean> {
    if (this.activationRequested) return true;

    const currentRegistration = registration ?? await this.serviceWorkers.getRegistration();
    const waitingWorker = currentRegistration?.waiting;
    if (!this.serviceWorkers.controller || !waitingWorker) return false;

    this.activationRequested = true;
    this.listeningForController = true;
    this.serviceWorkers.addEventListener("controllerchange", this.controllerChanged);
    try {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } catch (error) {
      this.activationRequested = false;
      this.stopListening();
      throw error;
    }
    return true;
  }

  /**
   * A native controllerchange is relevant only after this client requested
   * activation. Workbox separately confirms cross-client update transitions.
   */
  readonly controllerChanged = () => {
    if (!this.activationRequested) return;
    this.reloadOnce();
  };

  /**
   * Workbox invokes onNeedReload only for an update that has taken control,
   * including when another tab accepted it. That stale client must reload too.
   */
  readonly updateBecameControlling = () => {
    this.reloadOnce();
  };

  dispose() {
    this.stopListening();
  }

  private reloadOnce() {
    if (this.reloaded) return;
    this.reloaded = true;
    this.stopListening();
    this.reloadPage();
  }

  private stopListening() {
    if (!this.listeningForController) return;
    this.serviceWorkers.removeEventListener("controllerchange", this.controllerChanged);
    this.listeningForController = false;
  }
}
