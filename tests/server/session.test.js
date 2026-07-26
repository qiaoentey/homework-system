import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../server/app.js";

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
});
