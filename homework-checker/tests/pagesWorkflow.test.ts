// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Pages workflow", () => {
  const workflow = readFileSync(
    decodeURIComponent(
      new URL("../../.github/workflows/homework-checker-pages.yml", import.meta.url)
        .pathname,
    ),
    "utf8",
  );

  it("waits for the complete CI workflow on main", () => {
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain('workflows: ["Homework checker CI"]');
    expect(workflow).toContain("types: [completed]");
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("github.event.workflow_run.event == 'push'");
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'");
  });

  it("uses the official Pages artifact and deployment actions", () => {
    expect(workflow).toContain("actions/configure-pages@v5");
    expect(workflow).toContain("actions/upload-pages-artifact@v4");
    expect(workflow).toContain("actions/deploy-pages@v4");
    expect(workflow).toContain("pages: write");
    expect(workflow).toContain("id-token: write");
    expect(workflow).not.toContain("continue-on-error");
  });
});
