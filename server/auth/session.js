import { scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { OAuth2Client } from "google-auth-library";

const scrypt = promisify(scryptCallback);

export async function verifyEmergencyPassword(password, storedHash) {
  if (typeof password !== "string" || typeof storedHash !== "string") {
    return false;
  }

  const [salt, encodedHash, ...extraParts] = storedHash.split(":");
  if (!salt || !encodedHash || extraParts.length > 0 || !/^[a-f0-9]+$/i.test(encodedHash) || encodedHash.length % 2 !== 0) {
    return false;
  }

  const expectedHash = Buffer.from(encodedHash, "hex");
  const actualHash = await scrypt(password, salt, expectedHash.length);
  return timingSafeEqual(actualHash, expectedHash);
}

export function createGoogleVerifier(googleClientId) {
  const client = new OAuth2Client(googleClientId);

  return async (credential) => {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();

    return {
      email: payload?.email,
      emailVerified: payload?.email_verified === true,
    };
  };
}

export function requireSession(request, response, next) {
  if (!request.session?.user?.email) {
    return response.status(401).json({ error: "Authentication required" });
  }

  request.user = request.session.user;
  return next();
}
