import { Router } from "express";
import { createGoogleVerifier, requireSession, verifyEmergencyPassword } from "../auth/session.js";

const EMERGENCY_EMAIL = "emergency@local";

function isAllowedEmail(email, allowedEmails) {
  return typeof email === "string" && Array.isArray(allowedEmails) && allowedEmails.includes(email.toLowerCase());
}

export function createSessionRouter({ config, googleVerifier = createGoogleVerifier(config.googleClientId) }) {
  const router = Router();

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

  router.post("/emergency", async (request, response) => {
    const valid = await verifyEmergencyPassword(request.body?.password, config.emergencyPasswordHash);
    if (!valid) {
      return response.status(401).json({ error: "Invalid emergency password" });
    }

    request.session.user = { email: EMERGENCY_EMAIL };
    return response.status(204).end();
  });

  router.get("/", requireSession, (request, response) => response.json(request.user));

  router.delete("/", (request, response) => {
    request.session = null;
    return response.status(204).end();
  });

  return router;
}
