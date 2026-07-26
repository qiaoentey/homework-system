import { randomUUID } from "node:crypto";
import { DataType, newDb } from "pg-mem";
import { migrate } from "../../server/db/migrate.js";

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
  await migrate(pool);
  return pool;
}
