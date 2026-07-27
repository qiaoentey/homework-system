// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type WorkflowStep = {
  id?: string;
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, unknown>;
};

type Workflow = {
  name: string;
  on: Record<string, {
    paths?: string[];
    types?: string[];
    workflows?: string[];
  }>;
  permissions: Record<string, string>;
  concurrency?: {
    group: string;
    "cancel-in-progress": boolean;
  };
  jobs: Record<string, {
    if?: string;
    environment?: Record<string, string>;
    steps: WorkflowStep[];
  }>;
};

const readWorkflow = (name: string) => parse(readFileSync(
  decodeURIComponent(
    new URL(`../../.github/workflows/${name}`, import.meta.url).pathname,
  ),
  "utf8",
)) as Workflow;

describe("Homework checker CI workflow", () => {
  const workflow = readWorkflow("homework-checker-ci.yml");
  const verifySteps = workflow.jobs.verify.steps;

  it.each(["push", "pull_request"])(
    "runs when the privileged Pages workflow changes on %s",
    (eventName) => {
      expect(workflow.on[eventName].paths).toEqual([
        "homework-checker/**",
        ".github/workflows/homework-checker-ci.yml",
        ".github/workflows/homework-checker-pages.yml",
      ]);
    },
  );

  it("cancels only an older run of the same workflow and ref", () => {
    expect(workflow.concurrency).toEqual({
      group: "${{ github.workflow }}-${{ github.ref }}",
      "cancel-in-progress": true,
    });
  });

  it("serially gates both root and Pages browser modes after browser installation", () => {
    const runs = verifySteps.map((step) => step.run);
    const browserInstallIndex = runs.indexOf(
      "npx playwright install --with-deps chromium webkit",
    );

    expect(browserInstallIndex).toBeGreaterThanOrEqual(0);
    expect(runs.slice(browserInstallIndex + 1, browserInstallIndex + 3)).toEqual([
      "npm run test:e2e",
      "npm run test:e2e:pages",
    ]);
  });
});

describe("Homework checker Pages workflow", () => {
  const workflow = readWorkflow("homework-checker-pages.yml");
  const deploy = workflow.jobs.deploy;

  it("waits for the complete CI workflow and only accepts successful main pushes", () => {
    expect(workflow.on).toEqual({
      workflow_run: {
        workflows: ["Homework checker CI"],
        types: ["completed"],
      },
    });
    expect(deploy.if).toBe(
      "github.event.workflow_run.conclusion == 'success' && " +
      "github.event.workflow_run.event == 'push' && " +
      "github.event.workflow_run.head_branch == 'main'",
    );
  });

  it("uses exactly the minimum Pages permissions", () => {
    expect(workflow.permissions).toEqual({
      contents: "read",
      pages: "write",
      "id-token": "write",
    });
  });

  it("checks out the exact CI-tested SHA", () => {
    expect(deploy.steps.find((step) => step.uses === "actions/checkout@v4"))
      .toEqual({
        uses: "actions/checkout@v4",
        with: {
          ref: "${{ github.event.workflow_run.head_sha }}",
        },
      });
  });

  it("keeps the build gates and official Pages actions fail-closed", () => {
    expect(deploy.steps.filter((step) => step.run).map((step) => step.run))
      .toEqual([
        "npm ci",
        "npm test",
        "npm run build:pages",
        "npm run verify:pages",
      ]);
    expect(deploy.steps.filter((step) => step.uses).map((step) => step.uses))
      .toEqual([
        "actions/checkout@v4",
        "actions/setup-node@v4",
        "actions/configure-pages@v5",
        "actions/upload-pages-artifact@v4",
        "actions/deploy-pages@v4",
      ]);
    expect(
      deploy.steps.find(
        (step) => step.uses === "actions/upload-pages-artifact@v4",
      )?.with,
    ).toEqual({ path: "homework-checker/dist" });
    expect(
      deploy.steps.find((step) => step.uses === "actions/deploy-pages@v4")?.id,
    ).toBe("deployment");
    expect(deploy.steps.every((step) => !("continue-on-error" in step))).toBe(true);
  });

  it("serializes Pages deployments", () => {
    expect(workflow.concurrency).toEqual({
      group: "homework-checker-pages",
      "cancel-in-progress": true,
    });
  });
});
