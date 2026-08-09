import { describe, expect, it } from "vitest";
import { loadConfig } from "../../server/config.js";

describe("loadConfig", () => {
  it("keeps the deterministic development fallback outside production", () => {
    expect(loadConfig({ NODE_ENV: "test" }).sessionSecret).toBe("development-session-secret");
  });

  it("normalizes the comma-separated Dashboard administrator Gmail list", () => {
    expect(loadConfig({
      NODE_ENV: "test",
      DASHBOARD_ALLOWED_EMAILS: " Admin@Example.com, qiaoen9816@gmail.com, ",
    }).dashboardAllowedEmails).toEqual([
      "admin@example.com",
      "qiaoen9816@gmail.com",
    ]);
  });

  it("rejects a missing session secret in production", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow();
  });

  it("rejects a short session secret in production", () => {
    expect(() => loadConfig({ NODE_ENV: "production", SESSION_SECRET: "a".repeat(31) })).toThrow();
  });

  it("rejects the public environment-file placeholder in production", () => {
    expect(() => loadConfig({ NODE_ENV: "production", SESSION_SECRET: "replace-with-32-random-bytes" })).toThrow();
  });

  it("accepts a 32-character session secret in production", () => {
    const config = loadConfig({ NODE_ENV: "production", SESSION_SECRET: "a".repeat(32) });

    expect(config.sessionSecret).toBe("a".repeat(32));
  });
});
