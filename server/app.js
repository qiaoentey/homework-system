import express from "express";
import cookieSession from "cookie-session";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { createCatalogRouter } from "./routes/catalog.js";
import { createAttendanceRouter } from "./routes/attendance.js";
import { createMessagesRouter } from "./routes/messages.js";
import { createSessionRouter } from "./routes/session.js";
import { createStudentsRouter } from "./routes/students.js";

export function createApp({
  config = loadConfig(),
  googleVerifier,
  emergencyPasswordVerifier,
  emergencyThrottle,
  emergencyThrottleOptions,
  pool,
} = {}) {
  const app = express();
  const databasePool = pool === undefined
    ? createPool(config.databaseUrl ?? process.env.DATABASE_URL)
    : pool;
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
  app.use("/api/session", createSessionRouter({
    config,
    googleVerifier,
    emergencyPasswordVerifier,
    emergencyThrottle,
    emergencyThrottleOptions,
  }));
  app.use("/api/catalog", createCatalogRouter({
    dashboardAllowedEmails: config.dashboardAllowedEmails,
  }));
  app.use("/api", createAttendanceRouter({
    pool: databasePool,
    dashboardAllowedEmails: config.dashboardAllowedEmails,
  }));
  app.use("/api", createMessagesRouter({ pool: databasePool }));
  app.use("/api/students", createStudentsRouter({ pool: databasePool }));
  return app;
}
