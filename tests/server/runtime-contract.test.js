import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(await readFile(
  new URL("../../package.json", import.meta.url),
  "utf8",
));
const renderBlueprint = await readFile(
  new URL("../../render.yaml", import.meta.url),
  "utf8",
);

function renderNodeVersion(blueprint) {
  return blueprint.match(/key:\s+NODE_VERSION\s+value:\s+([^\s]+)/u)?.[1];
}

describe("clean verification runtime contract", () => {
  it("runs on the exact Node line declared by both npm and Render", () => {
    const actualVersion = process.version.replace(/^v/u, "");

    expect(packageJson.engines?.node).toBe(actualVersion);
    expect(renderNodeVersion(renderBlueprint)).toBe(actualVersion);
  });

  it("imports the packaged Sites schema through installed production dependencies", async () => {
    const schema = await import("../../db/schema.ts");

    expect(schema.students).toBeDefined();
    expect(schema.studentActivity).toBeDefined();
  });
});
