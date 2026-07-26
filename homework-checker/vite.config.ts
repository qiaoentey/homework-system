import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "service-worker.ts",
      injectRegister: "auto",
      manifest: false,
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,pdf,webmanifest}"],
        globIgnores: ["ocr/**"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: { enabled: true, type: "module" },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
