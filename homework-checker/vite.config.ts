import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,pdf}"],
      },
      manifest: {
        name: "安亲班功课检查",
        short_name: "功课检查",
        description: "安亲班老师的功课检查入口",
        theme_color: "#3056d3",
        background_color: "#f6f8fc",
        display: "standalone",
      },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
