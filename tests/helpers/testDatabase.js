import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DataType, newDb } from "pg-mem";

const migrationPath = fileURLToPath(new URL("../../server/db/migrations/001_initial.sql", import.meta.url));

export async function createTestDatabase() {
  const database = newDb();
  database.registerExtension("pgcrypto", (schema) => {
    schema.registerFunction({
      name: "gen_random_uuid",
      returns: DataType.uuid,
      implementation: randomUUID,
      impure: true,
    });
  });

  const { Pool } = database.adapters.createPg();
  const pool = new Pool();
  await pool.query(await readFile(migrationPath, "utf8"));
  return pool;
}
