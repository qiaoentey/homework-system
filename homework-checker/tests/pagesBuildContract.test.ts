import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Pages build contract", () => {
  it("declares the fixed public base and verifier", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    expect(packageJson.scripts["build:pages"]).toContain("/homework-system/");
    expect(packageJson.scripts["verify:pages"]).toContain("verify-pages-build.mjs");
  });
});
