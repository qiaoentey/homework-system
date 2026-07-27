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
  const journal = JSON.parse(await readFile(
    new URL("../../drizzle/meta/_journal.json", import.meta.url),
    "utf8",
  ));
  const migrations = await Promise.all(journal.entries.map(async ({ tag }) => ({
    tag,
    statements: (await readFile(
      new URL(`../../drizzle/${tag}.sql`, import.meta.url),
      "utf8",
    ))
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean),
  })));
  const appliedMigrations = new Set();
  let batchTail = Promise.resolve();
  const DB = {
    prepare(sql) {
      return createPreparedStatement(database, sql);
    },
    batch(statements) {
      const execute = async () => {
        database.exec("BEGIN IMMEDIATE");
        try {
          const results = [];
          for (const statement of statements) results.push(await statement.run());
          database.exec("COMMIT");
          return results;
        } catch (error) {
          database.exec("ROLLBACK");
          throw error;
        }
      };
      const pending = batchTail.then(execute, execute);
      batchTail = pending.catch(() => {});
      return pending;
    },
  };

  async function applyMigration() {
    for (const migration of migrations) {
      if (appliedMigrations.has(migration.tag)) continue;
      for (const [index, statement] of migration.statements.entries()) {
        const byteLength = new TextEncoder().encode(statement).byteLength;
        if (byteLength > 100_000) {
          throw new Error(
            `D1 migration ${migration.tag} statement ${index + 1} is ` +
            `${byteLength} UTF-8 bytes; limit is 100000`,
          );
        }
        await DB.prepare(statement).run();
      }
      appliedMigrations.add(migration.tag);
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
