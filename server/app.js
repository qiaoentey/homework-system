import express from "express";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.get("/api/health", (_request, response) => response.json({ ok: true }));
  return app;
}
