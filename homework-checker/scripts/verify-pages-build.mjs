import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const distDirectory = fileURLToPath(new URL("../dist/", import.meta.url));
const readDistFile = (name) => readFileSync(`${distDirectory}${name}`, "utf8");
const fail = (message) => {
  console.error(`Pages build contract violation: ${message}`);
  process.exit(1);
};

let html;
let manifest;
let serviceWorker;

try {
  html = readDistFile("index.html");
  manifest = JSON.parse(readDistFile("manifest.webmanifest"));
  serviceWorker = readDistFile("service-worker.js");
} catch (error) {
  fail(`could not read required dist output: ${error.message}`);
}

if (!html.includes("/homework-system/assets/")) {
  fail("dist/index.html must reference /homework-system/assets/");
}

if (!/rel=["']manifest["'][^>]*href=["']\.\/manifest\.webmanifest["']|href=["']\.\/manifest\.webmanifest["'][^>]*rel=["']manifest["']/.test(html)) {
  fail("dist/index.html must link the manifest relatively as ./manifest.webmanifest");
}

if (manifest.start_url !== "./") {
  fail('dist/manifest.webmanifest must set "start_url" to "./"');
}

if (manifest.scope !== "./") {
  fail('dist/manifest.webmanifest must set "scope" to "./"');
}

const basePathMatch = serviceWorker.match(/([A-Za-z_$][\w$]*)=[A-Za-z_$][\w$]*\(`\/homework-system\/`\)/);
if (!basePathMatch) {
  fail("dist/service-worker.js must contain the /homework-system/ base path");
}

const baseIdentifier = basePathMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
if (!(new RegExp("[A-Za-z_$][\\w$]*\\(" + baseIdentifier + ",`index\\.html`\\)")).test(serviceWorker)) {
  fail("dist/service-worker.js must route the app shell to /homework-system/index.html");
}

if (!(new RegExp("[A-Za-z_$][\\w$]*\\(" + baseIdentifier + ",`ocr/`\\)")).test(serviceWorker)) {
  fail("dist/service-worker.js must scope OCR resources to /homework-system/ocr/");
}

const rootAbsoluteReference = /["'`]\/(?:ocr|pdf|icons|assets)\//;
for (const [name, contents] of [["index.html", html], ["manifest.webmanifest", JSON.stringify(manifest)], ["service-worker.js", serviceWorker]]) {
  const match = contents.match(rootAbsoluteReference);
  if (match) {
    fail(`dist/${name} contains root-absolute reference ${match[0]}`);
  }
}

const pdfNames = readdirSync(`${distDirectory}pdf`)
  .filter((name) => name.endsWith(".pdf"))
  .sort();

if (pdfNames.length !== 12) {
  fail(`dist/pdf must contain exactly 12 PDFs; found ${pdfNames.length}`);
}

for (const pdfName of pdfNames) {
  if (!serviceWorker.includes(`"url":"pdf/${pdfName}"`)) {
    fail(`dist/service-worker.js must precache pdf/${pdfName}`);
  }
}

const precacheCount = (serviceWorker.match(/"url":/g) ?? []).length;
console.log(`Pages build contract verified (${precacheCount} precache entries; ${pdfNames.length} PDFs).`);
