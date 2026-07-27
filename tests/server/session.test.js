import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../server/app.js";
import { createGoogleVerifier } from "../../server/auth/session.js";

const emergencyPasswordHash = "task-4-test-salt:330dbd3ebcf20a4b02e6fc954a0677540e9a27cfc5ff51d956659ec11877e06fb426131601c8a7765cdd2f51a908b9013eb463625f6123e097ff762fe5b53b00";

function createTestApp(options = {}) {
  return createApp({
    config: {
      sessionSecret: "test-session-secret",
      environment: "test",
      googleClientId: "test-client.apps.googleusercontent.com",
      allowedEmails: ["teacher@example.com"],
      emergencyPasswordHash,
      ...options.config,
    },
    googleVerifier: options.googleVerifier,
    emergencyPasswordVerifier: options.emergencyPasswordVerifier,
    emergencyThrottleOptions: options.emergencyThrottleOptions,
  });
}

describe("session routes", () => {
  it("rejects an incorrect emergency password without creating a session", async () => {
    const agent = request.agent(createTestApp());

    await agent.post("/api/session/emergency").send({ password: "not-the-password" }).expect(401);
    await agent.get("/api/session").expect(401);
  });

  it("creates an HTTP-only lax session for the emergency password", async () => {
    const agent = request.agent(createTestApp());

    const login = await agent.post("/api/session/emergency").send({ password: "test-access" }).expect(204);

    expect(login.headers["set-cookie"]).toEqual(expect.arrayContaining([
      expect.stringMatching(/httponly/i),
    ]));
    expect(login.headers["set-cookie"][0]).toMatch(/samesite=lax/i);
    expect(await agent.get("/api/session").expect(200)).toMatchObject({
      body: { email: "emergency@local" },
    });
  });

  it("rejects a verified Google identity outside the email allowlist", async () => {
    const app = createTestApp({
      googleVerifier: async () => ({ email: "outside@example.com", emailVerified: true }),
    });

    await request(app).post("/api/session/google").send({ credential: "test-token" }).expect(403);
  });

  it("rejects a Google identity whose email is not verified", async () => {
    const agent = request.agent(createTestApp({
      googleVerifier: async () => ({ email: "teacher@example.com", emailVerified: false }),
    }));

    await agent.post("/api/session/google").send({ credential: "test-token" }).expect(403);
    await agent.get("/api/session").expect(401);
  });

  it("verifies Google credentials against the configured client audience", async () => {
    let verificationOptions;
    const verifier = createGoogleVerifier("configured-client.apps.googleusercontent.com", {
      async verifyIdToken(options) {
        verificationOptions = options;
        return {
          getPayload: () => ({ email: "teacher@example.com", email_verified: true }),
        };
      },
    });

    await expect(verifier("test-token")).resolves.toEqual({ email: "teacher@example.com", emailVerified: true });
    expect(verificationOptions).toEqual({
      idToken: "test-token",
      audience: "configured-client.apps.googleusercontent.com",
    });
  });

  it("creates a session for an allowed verified Google identity", async () => {
    const app = createTestApp({
      googleVerifier: async () => ({ email: "teacher@example.com", emailVerified: true }),
    });
    const agent = request.agent(app);

    await agent.post("/api/session/google").send({ credential: "test-token" }).expect(204);
    expect((await agent.get("/api/session").expect(200)).body).toEqual({ email: "teacher@example.com" });
  });

  it("clears a session when logging out", async () => {
    const agent = request.agent(createTestApp());
    await agent.post("/api/session/emergency").send({ password: "test-access" }).expect(204);

    await agent.delete("/api/session").expect(204);
    await agent.get("/api/session").expect(401);
  });

  it("marks the session cookie secure in production", async () => {
    const app = createTestApp({ config: { environment: "production" } });

    const response = await request(app)
      .post("/api/session/emergency")
      .set("X-Forwarded-Proto", "https")
      .send({ password: "test-access" })
      .expect(204);

    expect(response.headers["set-cookie"][0]).toMatch(/secure/i);
  });

  it("locks repeated emergency guesses before scrypt and resets the IP after success", async () => {
    let now = 1_000;
    let verifierCalls = 0;
    const app = createTestApp({
      emergencyPasswordVerifier: async (password) => {
        verifierCalls += 1;
        return password === "correct";
      },
      emergencyThrottleOptions: {
        maxFailures: 2,
        lockoutMs: 5_000,
        maxEntries: 10,
        now: () => now,
      },
    });
    const agent = request.agent(app);

    await agent.post("/api/session/emergency").send({ password: "guess-1" }).expect(401);
    await agent.post("/api/session/emergency").send({ password: "guess-2" }).expect(401);
    const blocked = await agent
      .post("/api/session/emergency")
      .send({ password: "correct" })
      .expect(429);
    expect(blocked.headers["retry-after"]).toBe("5");
    expect(blocked.body.code).toBe("EMERGENCY_LOGIN_THROTTLED");
    expect(verifierCalls).toBe(2);

    now += 5_000;
    await agent.post("/api/session/emergency").send({ password: "correct" }).expect(204);
    expect(verifierCalls).toBe(3);
    await agent.post("/api/session/emergency").send({ password: "guess-3" }).expect(401);
    expect(verifierCalls).toBe(4);
  });

  it("uses only the single trusted production proxy hop for emergency IP limits", async () => {
    let verifierCalls = 0;
    const app = createTestApp({
      config: {
        environment: "production",
        sessionSecret: "production-session-secret-at-least-32-bytes",
      },
      emergencyPasswordVerifier: async () => {
        verifierCalls += 1;
        return false;
      },
      emergencyThrottleOptions: {
        maxFailures: 1,
        lockoutMs: 60_000,
        maxEntries: 10,
        now: () => 1_000,
      },
    });

    await request(app)
      .post("/api/session/emergency")
      .set("X-Forwarded-For", "203.0.113.99, 198.51.100.10")
      .send({ password: "guess" })
      .expect(401);
    await request(app)
      .post("/api/session/emergency")
      .set("X-Forwarded-For", "192.0.2.44, 198.51.100.10")
      .send({ password: "guess" })
      .expect(429);
    await request(app)
      .post("/api/session/emergency")
      .set("X-Forwarded-For", "192.0.2.44, 198.51.100.11")
      .send({ password: "guess" })
      .expect(401);
    expect(verifierCalls).toBe(2);
  });

  it("bounds throttle memory and lazily cleans expired IP entries", async () => {
    let now = 1_000;
    let verifierCalls = 0;
    const app = createTestApp({
      config: {
        environment: "production",
        sessionSecret: "production-session-secret-at-least-32-bytes",
      },
      emergencyPasswordVerifier: async () => {
        verifierCalls += 1;
        return false;
      },
      emergencyThrottleOptions: {
        maxFailures: 1,
        lockoutMs: 5_000,
        maxEntries: 2,
        now: () => now,
      },
    });
    const guessFrom = (ip) => request(app)
      .post("/api/session/emergency")
      .set("X-Forwarded-For", ip)
      .send({ password: "guess" });

    await guessFrom("198.51.100.1").expect(401);
    await guessFrom("198.51.100.2").expect(401);
    await guessFrom("198.51.100.3").expect(401);
    await guessFrom("198.51.100.1").expect(401);
    expect(verifierCalls).toBe(4);

    now += 5_000;
    await guessFrom("198.51.100.2").expect(401);
    expect(verifierCalls).toBe(5);
  });
});
