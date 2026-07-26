import express from "express";
import cookieSession from "cookie-session";
import { loadConfig } from "./config.js";
import { createCatalogRouter } from "./routes/catalog.js";
import { createSessionRouter } from "./routes/session.js";

export function createApp({ config = loadConfig(), googleVerifier } = {}) {
  const app = express();
  app.set("trust proxy", config.environment === "production" ? 1 : false);
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieSession({
    name: "daycare_session",
    keys: [config.sessionSecret],
    httpOnly: true,
    sameSite: "lax",
    secure: config.environment === "production",
    signed: true,
  }));

  app.get("/api/health", (_request, response) => response.json({ ok: true }));
  app.use("/api/session", createSessionRouter({ config, googleVerifier }));
  app.use("/api/catalog", createCatalogRouter());
  return app;
}
