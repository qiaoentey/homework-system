const DEVELOPMENT_SESSION_SECRET = "development-session-secret";
const ENVIRONMENT_SESSION_SECRET_PLACEHOLDER = "replace-with-32-random-bytes";

function emailList(value) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function loadConfig(env = process.env) {
  const port = Number(env.PORT ?? 3000);
  const environment = env.NODE_ENV ?? "development";
  const sessionSecret = env.SESSION_SECRET ?? DEVELOPMENT_SESSION_SECRET;
  const allowedEmails = emailList(env.ALLOWED_EMAILS);
  const dashboardAllowedEmails = emailList(env.DASHBOARD_ALLOWED_EMAILS);

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
    dashboardAllowedEmails,
    emergencyPasswordHash: env.EMERGENCY_PASSWORD_HASH ?? "",
  };
}
