import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "./pool.js";

const migrationsDirectory = fileURLToPath(new URL("./migrations", import.meta.url));

async function getMigrationNames() {
  return (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

export async function migrate(pool) {
  const migrationsTable = await pool.query(
    `select table_name
     from information_schema.tables
     where table_schema = $1 and table_name = $2`,
    ["public", "schema_migrations"],
  );

  if (migrationsTable.rows.length === 0) {
    await pool.query(`
      create table schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
      )
    `);
  }

  const applied = await pool.query("select name from schema_migrations");
  const appliedNames = new Set(applied.rows.map((row) => row.name));
  const pending = (await getMigrationNames()).filter((name) => !appliedNames.has(name));

  for (const name of pending) {
    const sql = await readFile(path.join(migrationsDirectory, name), "utf8");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [name]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  return pending;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run database migrations");
  }

  const pool = createPool(connectionString);
  try {
    const pending = await migrate(pool);
    console.log(pending.length ? `Applied migrations: ${pending.join(", ")}` : "No pending migrations.");
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
