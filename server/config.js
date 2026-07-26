export function loadConfig(env = process.env) {
  const port = Number(env.PORT ?? 3000);

  return {
    port: Number.isInteger(port) && port > 0 ? port : 3000,
    sessionSecret: env.SESSION_SECRET ?? "development-session-secret",
    environment: env.NODE_ENV ?? "development",
  };
}
