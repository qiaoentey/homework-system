export const SESSION_COOKIE = "__Host-daycare_session";
export const SHARED_OPERATOR_EMAIL = "shared-access@local";

const SESSION_SECONDS = 12 * 60 * 60;
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function apiError(status, code, message, headers = {}) {
  return json({ code, error: message }, status, headers);
}

function validConfiguration(env) {
  return Boolean(
    env?.DB
    && /^[0-9a-f]{64}$/u.test(env.ACCESS_PASSWORD_SHA256 ?? "")
    && typeof env.ACCESS_SESSION_SECRET === "string"
    && env.ACCESS_SESSION_SECRET.length >= 32,
  );
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value) {
  if (!/^[0-9a-f]{64}$/u.test(value)) return null;
  return Uint8Array.from(
    value.match(/.{2}/gu),
    (pair) => Number.parseInt(pair, 16),
  );
}

function constantTimeEqual(left, right) {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array)) return false;
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", textEncoder.encode(value)));
}

function base64urlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64urlDecode(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, textEncoder.encode(value)));
}

async function signedSession(secret, now) {
  const payload = base64urlEncode(textEncoder.encode(JSON.stringify({
    email: SHARED_OPERATOR_EMAIL,
    exp: Math.floor(now / 1000) + SESSION_SECONDS,
  })));
  const signature = base64urlEncode(await hmac(secret, payload));
  return `${payload}.${signature}`;
}

function cookieValue(request) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === SESSION_COOKIE) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

function exactPasswordBody(body) {
  return Boolean(
    body
    && typeof body === "object"
    && !Array.isArray(body)
    && Object.keys(body).length === 1
    && typeof body.password === "string"
    && body.password.length > 0
    && body.password.length <= 128,
  );
}

async function requestBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function first(database, sql, values = []) {
  return database.prepare(sql).bind(...values).first();
}

async function run(database, sql, values = []) {
  return database.prepare(sql).bind(...values).run();
}

async function addressHash(request) {
  const address = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
  return bytesToHex(await sha256(address));
}

export function sessionCookie(value, maxAge = SESSION_SECONDS) {
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookie() {
  return `${sessionCookie("", 0)}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export async function readSession(request, env, now = Date.now()) {
  if (!validConfiguration(env)) return null;
  const token = cookieValue(request);
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const payloadBytes = base64urlDecode(parts[0]);
  const suppliedSignature = base64urlDecode(parts[1]);
  if (!payloadBytes || !suppliedSignature) return null;
  const expectedSignature = await hmac(env.ACCESS_SESSION_SECRET, parts[0]);
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(textDecoder.decode(payloadBytes));
    if (
      !payload
      || typeof payload !== "object"
      || Array.isArray(payload)
      || Object.keys(payload).length !== 2
      || payload.email !== SHARED_OPERATOR_EMAIL
      || !Number.isInteger(payload.exp)
      || payload.exp <= Math.floor(now / 1000)
    ) {
      return null;
    }
    return { email: SHARED_OPERATOR_EMAIL };
  } catch {
    return null;
  }
}

export async function authenticatePassword(request, env, now = Date.now()) {
  if (!validConfiguration(env)) {
    return apiError(503, "AUTHENTICATION_UNAVAILABLE", "Authentication is unavailable");
  }

  const body = await requestBody(request);
  if (!exactPasswordBody(body)) {
    return apiError(400, "INVALID_PASSWORD_REQUEST", "A password is required");
  }

  const database = env.DB;
  const key = await addressHash(request);
  await run(
    database,
    "DELETE FROM access_login_attempts WHERE updated_at < ?",
    [now - RETENTION_MS],
  );
  const previous = await first(
    database,
    `SELECT failures, window_started_at, locked_until
     FROM access_login_attempts
     WHERE address_hash = ?`,
    [key],
  );

  if (Number(previous?.locked_until ?? 0) > now) {
    const retryAfter = Math.max(1, Math.ceil((previous.locked_until - now) / 1000));
    return apiError(
      429,
      "PASSWORD_LOGIN_THROTTLED",
      "Too many password attempts",
      { "retry-after": String(retryAfter) },
    );
  }

  const expected = hexToBytes(env.ACCESS_PASSWORD_SHA256);
  const actual = await sha256(body.password);
  if (!constantTimeEqual(actual, expected)) {
    const withinWindow = previous && now - Number(previous.window_started_at) < WINDOW_MS;
    const failures = withinWindow ? Number(previous.failures) + 1 : 1;
    const windowStartedAt = withinWindow ? Number(previous.window_started_at) : now;
    const lockedUntil = failures >= MAX_FAILURES ? now + LOCK_MS : 0;
    await run(
      database,
      `INSERT INTO access_login_attempts
         (address_hash, failures, window_started_at, locked_until, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (address_hash)
       DO UPDATE SET
         failures = excluded.failures,
         window_started_at = excluded.window_started_at,
         locked_until = excluded.locked_until,
         updated_at = excluded.updated_at`,
      [key, failures, windowStartedAt, lockedUntil, now],
    );
    if (lockedUntil > 0) {
      return apiError(
        429,
        "PASSWORD_LOGIN_THROTTLED",
        "Too many password attempts",
        { "retry-after": String(Math.ceil(LOCK_MS / 1000)) },
      );
    }
    return apiError(401, "INVALID_PASSWORD", "Invalid password");
  }

  await run(database, "DELETE FROM access_login_attempts WHERE address_hash = ?", [key]);
  const token = await signedSession(env.ACCESS_SESSION_SECRET, now);
  return new Response(null, {
    status: 204,
    headers: { "set-cookie": sessionCookie(token) },
  });
}
