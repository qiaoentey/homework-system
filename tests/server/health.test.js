import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../server/app.js";

describe("GET /api/health", () => {
  it("returns a healthy JSON response", async () => {
    const response = await request(createApp({ pool: null, config: { sessionSecret: "test" } }))
      .get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
