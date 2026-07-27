import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";

function assertSingleStatement(sql) {
  const withoutTrailingSemicolon = sql.trim().replace(/;$/u, "");
  if (withoutTrailingSemicolon.includes(";")) {
    throw new Error(`D1 prepare received multiple SQL statements: ${sql}`);
  }
}

function createPreparedStatement(database, sql, values = []) {
  assertSingleStatement(sql);
  const statement = database.prepare(sql);

  return {
    bind(...nextValues) {
      return createPreparedStatement(database, sql, nextValues);
    },
    async all() {
      return { results: statement.all(...values) };
    },
    async first(column) {
      const row = statement.get(...values) ?? null;
      return column && row ? row[column] : row;
    },
    async run() {
      const result = statement.run(...values);
      return {
        success: true,
        meta: {
          changes: Number(result.changes),
          last_row_id: Number(result.lastInsertRowid),
        },
      };
    },
  };
}

export async function createSitesD1() {
  const database = new DatabaseSync(":memory:");
  const migration = await readFile(
    new URL("../../drizzle/0000_daycare_sites.sql", import.meta.url),
    "utf8",
  );
  const migrationStatements = migration
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  const DB = {
    prepare(sql) {
      return createPreparedStatement(database, sql);
    },
  };

  async function applyMigration() {
    for (const statement of migrationStatements) {
      await DB.prepare(statement).run();
    }
  }

  await applyMigration();

  return {
    DB,
    close() {
      database.close();
    },
    execMigration: applyMigration,
  };
}
