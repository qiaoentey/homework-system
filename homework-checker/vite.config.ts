import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ocrDirectory = fileURLToPath(new URL("./public/ocr/", import.meta.url));
const ocrContentVersion = readdirSync(ocrDirectory)
  .sort()
  .reduce((hash, name) => hash.update(name).update(readFileSync(`${ocrDirectory}/${name}`)), createHash("sha256"))
  .digest("hex")
  .slice(0, 16);

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "service-worker.ts",
      injectRegister: false,
      registerType: "prompt",
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
  define: {
    __OCR_CACHE_VERSION__: JSON.stringify(ocrContentVersion),
  },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
