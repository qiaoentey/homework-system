// @vitest-environment node

import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const projectDirectory = decodeURIComponent(
  new URL("../", import.meta.url).pathname,
);
const verifierPath = join(projectDirectory, "scripts/verify-pages-build.mjs");
const builtDistPath = join(projectDirectory, "dist");
const temporaryDirectories: string[] = [];

const makeArtifactCopy = () => {
  const directory = mkdtempSync(join(tmpdir(), "pages-build-contract-"));
  const artifactPath = join(directory, "dist");
  cpSync(builtDistPath, artifactPath, { recursive: true });
  temporaryDirectories.push(directory);
  return artifactPath;
};

const runVerifier = (artifactPath: string) => spawnSync(
  process.execPath,
  [verifierPath, artifactPath],
  {
    cwd: projectDirectory,
    encoding: "utf8",
  },
);

const replacePrecacheUrl = (
  serviceWorker: string,
  urlPattern: RegExp,
  replacement: string,
) => {
  const result = serviceWorker.replace(
    new RegExp(`"url":"(${urlPattern.source})"`),
    `"url":"${replacement}"`,
  );
  expect(result).not.toBe(serviceWorker);
  return result;
};

describe("Pages build contract", () => {
  beforeAll(() => {
    const build = spawnSync(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "build:pages"],
      {
        cwd: projectDirectory,
        encoding: "utf8",
      },
    );
    expect(build.stderr || build.stdout).toBeDefined();
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
  }, 120_000);

  afterAll(() => {
    for (const directory of temporaryDirectories) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("declares the fixed public base and verifier", () => {
    const packageJson = JSON.parse(readFileSync(
      join(projectDirectory, "package.json"),
      "utf8",
    ));
    expect(packageJson.scripts["build:pages"]).toContain("/homework-system/");
    expect(packageJson.scripts["verify:pages"]).toContain("verify-pages-build.mjs");
  });

  it("accepts the complete Pages artifact with exactly 23 precache entries", () => {
    const result = runVerifier(builtDistPath);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Pages build contract verified (23 precache entries; 12 PDFs).",
    );
  });

  it.each([
    ["main JavaScript bundle", /assets\/index-[^"]+\.js/, "assets/missing-main.js"],
    ["main stylesheet", /assets\/index-[^"]+\.css/, "assets/missing-main.css"],
    [
      "Workbox runtime",
      /assets\/workbox-window\.prod\.es5-[^"]+\.js/,
      "assets/missing-workbox.js",
    ],
    ["OCR worker", /assets\/ocr\.worker-[^"]+\.js/, "assets/missing-ocr-worker.js"],
    [
      "image preprocessing worker",
      /assets\/imagePreprocess\.worker-[^"]+\.js/,
      "assets/missing-image-worker.js",
    ],
  ])("rejects a precache that omits the %s", (_label, pattern, replacement) => {
    const artifactPath = makeArtifactCopy();
    const serviceWorkerPath = join(artifactPath, "service-worker.js");
    const serviceWorker = readFileSync(serviceWorkerPath, "utf8");
    writeFileSync(
      serviceWorkerPath,
      replacePrecacheUrl(serviceWorker, pattern, replacement),
    );

    const result = runVerifier(artifactPath);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Pages build contract violation:");
  });

  it("rejects a manifest icon that escapes the project base", () => {
    const artifactPath = makeArtifactCopy();
    const manifestPath = join(artifactPath, "manifest.webmanifest");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.icons[0].src = "../icon-192.png";
    writeFileSync(manifestPath, JSON.stringify(manifest));

    const result = runVerifier(artifactPath);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("manifest icon src must stay inside the Pages base");
  });

  it("rejects a manifest icon whose output file is missing", () => {
    const artifactPath = makeArtifactCopy();
    rmSync(join(artifactPath, "icons/icon-192.png"));

    const result = runVerifier(artifactPath);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("required file icons/icon-192.png");
  });

  it("rejects an empty PDF even when it is listed in the precache", () => {
    const artifactPath = makeArtifactCopy();
    writeFileSync(
      join(artifactPath, "pdf/1年级_华文_活动本答案参考.pdf"),
      "",
    );

    const result = runVerifier(artifactPath);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "required file pdf/1年级_华文_活动本答案参考.pdf must be non-empty",
    );
  });

  it("rejects a video-index filename even when twelve PDFs are precached", () => {
    const artifactPath = makeArtifactCopy();
    const currentName = "1年级_华文_活动本答案参考.pdf";
    const forbiddenName = "1年级_华文_活动本答案影片索引.pdf";
    cpSync(
      join(artifactPath, "pdf", currentName),
      join(artifactPath, "pdf", forbiddenName),
      { recursive: false },
    );
    rmSync(join(artifactPath, "pdf", currentName), { force: false });
    const serviceWorkerPath = join(artifactPath, "service-worker.js");
    const serviceWorker = readFileSync(serviceWorkerPath, "utf8");
    writeFileSync(
      serviceWorkerPath,
      serviceWorker.replace(
        `pdf/${currentName}`,
        `pdf/${forbiddenName}`,
      ),
    );

    const result = runVerifier(artifactPath);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "PDF filenames must end with 活动本答案参考.pdf",
    );
  });
});
