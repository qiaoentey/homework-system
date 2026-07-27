import { defineConfig } from "playwright/test";

const pagesBasePath = process.env.PAGES_BASE_PATH ?? "/";
const buildCommand = pagesBasePath === "/"
  ? "npm run build"
  : "npm run build:pages";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:4174",
  },
  webServer: {
    command: `${buildCommand} && ./node_modules/.bin/vite preview --host 127.0.0.1 --port 4174 --base=${pagesBasePath}`,
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "webkit-iphone",
      use: {
        browserName: "webkit",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "chromium-android",
      use: {
        browserName: "chromium",
        viewport: { width: 412, height: 915 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
