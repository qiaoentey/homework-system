import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: "worker/index.js",
      formats: ["es"],
      fileName: () => "index.js",
    },
    outDir: "dist/server",
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    target: "es2022",
  },
});
