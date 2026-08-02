import {
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import {
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_PRECACHE_ENTRY_COUNT = 23;
const EXPECTED_PDF_COUNT = 12;
const DEFAULT_DIST_DIRECTORY = fileURLToPath(
  new URL("../dist/", import.meta.url),
);
const distDirectory = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : DEFAULT_DIST_DIRECTORY;
const readDistFile = (name) => readFileSync(join(distDirectory, name), "utf8");
const fail = (message) => {
  console.error(`Pages build contract violation: ${message}`);
  process.exit(1);
};

let answerCatalog;
try {
  answerCatalog = JSON.parse(readFileSync(
    fileURLToPath(new URL("../answer-data/catalog.json", import.meta.url)),
    "utf8",
  ));
} catch (error) {
  fail(`could not read the answer catalog: ${error.message}`);
}

const expectedPdfNames = answerCatalog.resources
  .map((resource) => resource.pdfFile)
  .sort();
if (
  expectedPdfNames.length !== EXPECTED_PDF_COUNT ||
  new Set(expectedPdfNames).size !== EXPECTED_PDF_COUNT
) {
  fail(`answer catalog must declare exactly ${EXPECTED_PDF_COUNT} unique PDFs`);
}

const isBaseSafeRelativePath = (path) => {
  if (
    typeof path !== "string" ||
    path.length === 0 ||
    path.startsWith("/") ||
    path.startsWith("\\") ||
    path.includes("\\") ||
    path.includes("?") ||
    path.includes("#") ||
    /^[a-z][a-z\d+.-]*:/i.test(path)
  ) {
    return false;
  }

  const normalized = normalize(path);
  return normalized !== ".." &&
    !normalized.startsWith(`..${sep}`) &&
    !isAbsolute(normalized);
};

const requireNonEmptyFile = (relativePath) => {
  if (!isBaseSafeRelativePath(relativePath)) {
    fail(`required file path must stay inside dist: ${relativePath}`);
  }

  const filePath = resolve(distDirectory, relativePath);
  const pathFromDist = relative(distDirectory, filePath);
  if (
    pathFromDist === ".." ||
    pathFromDist.startsWith(`..${sep}`) ||
    isAbsolute(pathFromDist)
  ) {
    fail(`required file path must stay inside dist: ${relativePath}`);
  }

  let stats;
  try {
    stats = statSync(filePath);
  } catch {
    fail(`required file ${relativePath} is missing`);
  }

  if (!stats.isFile()) {
    fail(`required file ${relativePath} must be a file`);
  }
  if (stats.size === 0) {
    fail(`required file ${relativePath} must be non-empty`);
  }
};

const jsonArrayAt = (source, start) => {
  let depth = 0;
  let escaped = false;
  let inString = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "[") {
      depth += 1;
    } else if (character === "]") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return undefined;
};

const parsePrecacheEntries = (serviceWorker) => {
  const candidates = [];
  let start = serviceWorker.indexOf('[{"revision":');

  while (start !== -1) {
    const source = jsonArrayAt(serviceWorker, start);
    if (source) {
      try {
        const parsed = JSON.parse(source);
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed.every((entry) =>
            entry &&
            typeof entry === "object" &&
            typeof entry.url === "string" &&
            (entry.revision === null || typeof entry.revision === "string")
          )
        ) {
          candidates.push(parsed);
        }
      } catch {
        // Continue looking for the generated Workbox manifest.
      }
    }
    start = serviceWorker.indexOf('[{"revision":', start + 1);
  }

  if (candidates.length !== 1) {
    fail(
      `dist/service-worker.js must contain exactly one parseable Workbox ` +
      `precache manifest; found ${candidates.length}`,
    );
  }

  return candidates[0];
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

requireNonEmptyFile("index.html");
requireNonEmptyFile("manifest.webmanifest");
requireNonEmptyFile("service-worker.js");

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

const expectedManifestIcons = [
  {
    src: "icons/icon-192.png",
    sizes: "192x192",
    type: "image/png",
  },
  {
    src: "icons/icon-512.png",
    sizes: "512x512",
    type: "image/png",
  },
];

if (!Array.isArray(manifest.icons) || manifest.icons.length !== 2) {
  fail("dist/manifest.webmanifest must declare exactly two icons");
}

for (const expectedIcon of expectedManifestIcons) {
  const icon = manifest.icons.find(
    (candidate) => candidate?.sizes === expectedIcon.sizes,
  );
  if (!icon) {
    fail(`dist/manifest.webmanifest must declare the ${expectedIcon.sizes} icon`);
  }
  if (!isBaseSafeRelativePath(icon.src)) {
    fail(`manifest icon src must stay inside the Pages base: ${icon.src}`);
  }
  if (icon.src !== expectedIcon.src || icon.type !== expectedIcon.type) {
    fail(
      `dist/manifest.webmanifest ${expectedIcon.sizes} icon must use ` +
      `${expectedIcon.src} as image/png`,
    );
  }
  requireNonEmptyFile(icon.src);
}

const basePathMatch = serviceWorker.match(
  /([A-Za-z_$][\w$]*)=[A-Za-z_$][\w$]*\(`\/homework-system\/`\)/,
);
if (!basePathMatch) {
  fail("dist/service-worker.js must contain the /homework-system/ base path");
}

const baseIdentifier = basePathMatch[1].replace(
  /[.*+?^${}()|[\]\\]/g,
  "\\$&",
);
if (!(new RegExp(
  "[A-Za-z_$][\\w$]*\\(" + baseIdentifier + ",`index\\.html`\\)",
)).test(serviceWorker)) {
  fail("dist/service-worker.js must route the app shell to /homework-system/index.html");
}

if (!(new RegExp(
  "[A-Za-z_$][\\w$]*\\(" + baseIdentifier + ",`ocr/`\\)",
)).test(serviceWorker)) {
  fail("dist/service-worker.js must scope OCR resources to /homework-system/ocr/");
}

const rootAbsoluteReference = /["'`]\/(?:ocr|pdf|icons|assets)\//;
for (const [name, contents] of [
  ["index.html", html],
  ["manifest.webmanifest", JSON.stringify(manifest)],
  ["service-worker.js", serviceWorker],
]) {
  const match = contents.match(rootAbsoluteReference);
  if (match) {
    fail(`dist/${name} contains root-absolute reference ${match[0]}`);
  }
}

const precacheEntries = parsePrecacheEntries(serviceWorker);
if (precacheEntries.length !== EXPECTED_PRECACHE_ENTRY_COUNT) {
  fail(
    `dist/service-worker.js must contain exactly ` +
    `${EXPECTED_PRECACHE_ENTRY_COUNT} precache entries; found ` +
    `${precacheEntries.length}`,
  );
}

const precacheUrls = precacheEntries.map((entry) => entry.url);
for (const url of new Set(precacheUrls)) {
  if (!isBaseSafeRelativePath(url)) {
    fail(`precache URL must stay inside the Pages base: ${url}`);
  }
  requireNonEmptyFile(url);
}

const requirePrecachedUrl = (url, label) => {
  if (!precacheUrls.includes(url)) {
    fail(`dist/service-worker.js must precache ${label}: ${url}`);
  }
};

requirePrecachedUrl("index.html", "the app shell");
requirePrecachedUrl("manifest.webmanifest", "the Web App Manifest");
for (const { src } of expectedManifestIcons) {
  requirePrecachedUrl(src, "a manifest icon");
}

const requiredHashedAssets = [
  ["main JavaScript bundle", /^assets\/index-[A-Za-z\d_-]+\.js$/],
  ["main stylesheet", /^assets\/index-[A-Za-z\d_-]+\.css$/],
  [
    "Workbox runtime",
    /^assets\/workbox-window\.prod\.es5-[A-Za-z\d_-]+\.js$/,
  ],
  ["OCR worker", /^assets\/ocr\.worker-[A-Za-z\d_-]+\.js$/],
  [
    "image preprocessing worker",
    /^assets\/imagePreprocess\.worker-[A-Za-z\d_-]+\.js$/,
  ],
];

const matchedAssets = new Map();
for (const [label, pattern] of requiredHashedAssets) {
  const matches = [...new Set(precacheUrls.filter((url) => pattern.test(url)))];
  if (matches.length !== 1) {
    fail(
      `dist/service-worker.js must precache exactly one ${label}; ` +
      `found ${matches.length}`,
    );
  }
  matchedAssets.set(label, matches[0]);
}

const mainJavaScript = matchedAssets.get("main JavaScript bundle");
const mainStylesheet = matchedAssets.get("main stylesheet");
if (!html.includes(`/homework-system/${mainJavaScript}`)) {
  fail(`dist/index.html must load ${mainJavaScript} from the Pages base`);
}
if (!html.includes(`/homework-system/${mainStylesheet}`)) {
  fail(`dist/index.html must load ${mainStylesheet} from the Pages base`);
}

const mainBundle = readDistFile(mainJavaScript);
for (const label of [
  "Workbox runtime",
  "OCR worker",
  "image preprocessing worker",
]) {
  const asset = matchedAssets.get(label);
  if (!mainBundle.includes(asset.split("/").at(-1))) {
    fail(`${mainJavaScript} must reference the generated ${label} ${asset}`);
  }
}

const pdfNames = readdirSync(join(distDirectory, "pdf"))
  .filter((name) => name.endsWith(".pdf"))
  .sort();

if (pdfNames.length !== EXPECTED_PDF_COUNT) {
  fail(
    `dist/pdf must contain exactly ${EXPECTED_PDF_COUNT} PDFs; ` +
    `found ${pdfNames.length}`,
  );
}

if (pdfNames.some((name) =>
  name.includes("影片索引") || !name.endsWith("_活动本答案参考.pdf")
)) {
  fail("PDF filenames must end with 活动本答案参考.pdf and must not contain 影片索引");
}

const missingPdfNames = expectedPdfNames.filter((name) => !pdfNames.includes(name));
const unexpectedPdfNames = pdfNames.filter((name) => !expectedPdfNames.includes(name));
if (missingPdfNames.length > 0 || unexpectedPdfNames.length > 0) {
  fail(
    `dist/pdf filenames must exactly match the answer catalog; ` +
    `missing: ${missingPdfNames.join(", ") || "none"}; ` +
    `unexpected: ${unexpectedPdfNames.join(", ") || "none"}`,
  );
}

const precachedPdfUrls = precacheUrls.filter((url) => url.startsWith("pdf/"));
if (precachedPdfUrls.length !== EXPECTED_PDF_COUNT) {
  fail(
    `dist/service-worker.js must precache exactly ${EXPECTED_PDF_COUNT} PDFs; ` +
    `found ${precachedPdfUrls.length}`,
  );
}

for (const pdfName of pdfNames) {
  const pdfUrl = `pdf/${pdfName}`;
  requireNonEmptyFile(pdfUrl);
  requirePrecachedUrl(pdfUrl, "an answer PDF");
}

console.log(
  `Pages build contract verified (${precacheEntries.length} precache entries; ` +
  `${pdfNames.length} PDFs).`,
);
