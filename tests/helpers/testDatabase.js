import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DataType, newDb } from "pg-mem";
import { migrate } from "../../server/db/migrate.js";

const migrationsDirectory = fileURLToPath(new URL("../../server/db/migrations", import.meta.url));

function createMemoryPool() {
  const database = newDb();
  database.registerExtension("pgcrypto", (schema) => {
    schema.registerFunction({
      name: "gen_random_uuid",
      returns: DataType.uuid,
      implementation: randomUUID,
      impure: true,
    });
  });
  database.public.registerFunction({
    name: "btrim",
    args: [DataType.text],
    returns: DataType.text,
    implementation: (value) => value.trim(),
  });

  const { Pool } = database.adapters.createPg();
  return new Pool();
}

export async function createTestDatabase() {
  const pool = createMemoryPool();
  await migrate(pool);
  return pool;
}

export async function createTestDatabaseBefore(excludedMigration) {
  const pool = createMemoryPool();
  await pool.query(`
    create table schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);
  const migrationNames = (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith(".sql") && name < excludedMigration)
    .sort();
  for (const name of migrationNames) {
    await pool.query(await readFile(path.join(migrationsDirectory, name), "utf8"));
    await pool.query("insert into schema_migrations (name) values ($1)", [name]);
  }
  return pool;
}
