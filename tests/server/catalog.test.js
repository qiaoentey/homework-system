import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../server/app.js";

const emergencyPasswordHash = "task-4-test-salt:330dbd3ebcf20a4b02e6fc954a0677540e9a27cfc5ff51d956659ec11877e06fb426131601c8a7765cdd2f51a908b9013eb463625f6123e097ff762fe5b53b00";

function createTestApp() {
  return createApp({
    config: {
      sessionSecret: "test-session-secret",
      environment: "test",
      googleClientId: "test-client.apps.googleusercontent.com",
      allowedEmails: ["teacher@example.com"],
      emergencyPasswordHash,
    },
  });
}

describe("GET /api/catalog", () => {
  it("rejects catalog access without a session", async () => {
    const response = await request(createTestApp()).get("/api/catalog");

    expect(response.status).toBe(401);
  });

  it("returns only the fixed three-branch catalog after login", async () => {
    const agent = request.agent(createTestApp());
    await agent.post("/api/session/emergency").send({ password: "test-access" }).expect(204);

    expect((await agent.get("/api/catalog").expect(200)).body).toEqual({
      branches: [
        {
          code: "MK",
          label: "MK",
          groups: [
            { code: "MK HAPPY", label: "HAPPY" },
            { code: "MK QIAO EN", label: "QIAO EN" },
            { code: "MK WEN XUAN", label: "WEN XUAN" },
          ],
        },
        {
          code: "STP",
          label: "STP",
          groups: [
            { code: "巧恩 STP", label: "巧恩" },
            { code: "PS STP", label: "PS" },
            { code: "SY STP", label: "SY" },
            { code: "YUAN NING STP", label: "YUAN NING" },
            { code: "JANICE STP", label: "JANICE" },
          ],
        },
        {
          code: "WS",
          label: "WS",
          groups: [
            { code: "WS HUILING", label: "HUILING" },
            { code: "WS JIA WEN", label: "JIA WEN" },
            { code: "WS MIXIN", label: "MIXIN" },
          ],
        },
      ],
    });
  });
});
