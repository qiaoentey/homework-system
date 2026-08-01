import { Router } from "express";
import { createGoogleVerifier, requireSession, verifyEmergencyPassword } from "../auth/session.js";
import { createEmergencyThrottle } from "../auth/emergencyThrottle.js";

const EMERGENCY_EMAIL = "emergency@local";

function isAllowedEmail(email, allowedEmails) {
  return typeof email === "string" && Array.isArray(allowedEmails) && allowedEmails.includes(email.toLowerCase());
}

export function createSessionRouter({
  config,
  googleVerifier = createGoogleVerifier(config.googleClientId),
  emergencyPasswordVerifier = verifyEmergencyPassword,
  emergencyThrottle,
  emergencyThrottleOptions,
}) {
  const router = Router();
  const throttle = emergencyThrottle
    ?? createEmergencyThrottle(emergencyThrottleOptions);

  router.get("/config", (_request, response) => response.json({
    googleClientId: config.googleClientId,
  }));

  router.post("/google", async (request, response) => {
    if (typeof request.body?.credential !== "string" || !request.body.credential) {
      return response.status(400).json({ error: "Google credential is required" });
    }

    try {
      const identity = await googleVerifier(request.body.credential);
      const email = identity?.email?.toLowerCase();

      if (!identity?.emailVerified || !isAllowedEmail(email, config.allowedEmails)) {
        return response.status(403).json({ error: "Google account is not allowed" });
      }

      request.session.user = { email };
      return response.status(204).end();
    } catch {
      return response.status(401).json({ error: "Invalid Google credential" });
    }
  });

  async function passwordLogin(request, response) {
    const ip = request.ip || request.socket.remoteAddress || "unknown";
    const retryAfter = throttle.retryAfter(ip);
    if (retryAfter > 0) {
      response.set("Retry-After", String(retryAfter));
      return response.status(429).json({
        code: "EMERGENCY_LOGIN_THROTTLED",
        error: "Too many emergency login attempts",
      });
    }

    const valid = await emergencyPasswordVerifier(
      request.body?.password,
      config.emergencyPasswordHash,
    );
    if (!valid) {
      throttle.recordFailure(ip);
      return response.status(401).json({ error: "Invalid emergency password" });
    }

    throttle.reset(ip);
    request.session.user = { email: EMERGENCY_EMAIL };
    return response.status(204).end();
  }

  router.post("/password", passwordLogin);
  router.post("/emergency", passwordLogin);

  router.get("/", requireSession, (request, response) => response.json(request.user));

  router.delete("/", (request, response) => {
    request.session = null;
    return response.status(204).end();
  });

  return router;
}
