#!/usr/bin/env node
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const index = path.join(dist, "client", "index.html");
const workerIndex = path.join(dist, "server", "index.js");
const hosting = path.join(root, ".openai", "hosting.json");
const schema = path.join(root, "db", "schema.ts");
const migrations = path.join(root, "drizzle");
const packagedMigrations = path.join(dist, ".openai", "drizzle");
const deprecatedMigrations = path.join(dist, "drizzle");

for (const file of [index, workerIndex, hosting, schema, migrations]) {
  if (!existsSync(file)) throw new Error("Missing Sites build input: " + file);
}

mkdirSync(path.join(dist, ".openai"), { recursive: true });
copyFileSync(hosting, path.join(dist, ".openai", "hosting.json"));
mkdirSync(path.join(dist, "db"), { recursive: true });
copyFileSync(schema, path.join(dist, "db", "schema.ts"));
rmSync(deprecatedMigrations, { recursive: true, force: true });
rmSync(packagedMigrations, { recursive: true, force: true });
cpSync(migrations, packagedMigrations, { recursive: true });

console.log("Prepared Sites build: bundled Worker, hosting config, schema, and D1 migrations");
