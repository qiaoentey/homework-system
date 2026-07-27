import { defineConfig } from "@playwright/test";
import { selectE2ETestMatch } from "./tests/e2e/policy.js";

const externalBaseUrl = process.env.E2E_BASE_URL;
const baseURL = externalBaseUrl ?? "http://127.0.0.1:4173";
const mutationOptIn = process.env.E2E_DANGER_ALLOW_EXTERNAL_MUTATIONS;
const readOnlyStorageState = process.env.E2E_READ_ONLY_STORAGE_STATE;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: selectE2ETestMatch({ externalBaseUrl, mutationOptIn }),
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  use: {
    baseURL,
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    ...(externalBaseUrl && readOnlyStorageState
      ? { storageState: readOnlyStorageState }
      : {}),
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "node tests/e2e/server.js",
        url: `${baseURL}/api/health`,
        timeout: 120_000,
        reuseExistingServer: false,
      },
});
