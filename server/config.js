export function loadConfig(env = process.env) {
  const port = Number(env.PORT ?? 3000);
  const allowedEmails = (env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return {
    port: Number.isInteger(port) && port > 0 ? port : 3000,
    sessionSecret: env.SESSION_SECRET ?? "development-session-secret",
    environment: env.NODE_ENV ?? "development",
    googleClientId: env.GOOGLE_CLIENT_ID ?? "",
    allowedEmails,
    emergencyPasswordHash: env.EMERGENCY_PASSWORD_HASH ?? "",
  };
}
