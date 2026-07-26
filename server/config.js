const DEVELOPMENT_SESSION_SECRET = "development-session-secret";
const ENVIRONMENT_SESSION_SECRET_PLACEHOLDER = "replace-with-32-random-bytes";

export function loadConfig(env = process.env) {
  const port = Number(env.PORT ?? 3000);
  const environment = env.NODE_ENV ?? "development";
  const sessionSecret = env.SESSION_SECRET ?? DEVELOPMENT_SESSION_SECRET;
  const allowedEmails = (env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (
    environment === "production" &&
    (typeof env.SESSION_SECRET !== "string" ||
      sessionSecret.length < 32 ||
      sessionSecret === DEVELOPMENT_SESSION_SECRET ||
      sessionSecret === ENVIRONMENT_SESSION_SECRET_PLACEHOLDER)
  ) {
    throw new Error("SESSION_SECRET must be a non-placeholder value of at least 32 characters in production");
  }

  return {
    port: Number.isInteger(port) && port > 0 ? port : 3000,
    sessionSecret,
    environment,
    googleClientId: env.GOOGLE_CLIENT_ID ?? "",
    allowedEmails,
    emergencyPasswordHash: env.EMERGENCY_PASSWORD_HASH ?? "",
  };
}
