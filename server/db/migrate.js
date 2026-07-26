import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "./pool.js";

const migrationsDirectory = fileURLToPath(new URL("./migrations", import.meta.url));
const studentIdentityMigration = "002_unique_student_identity.sql";

async function getMigrationNames() {
  return (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

async function preflightStudentIdentityMigration(client) {
  const conflicts = await client.query(
    `select first_student.group_code,
            lower(btrim(first_student.name)) as normalized_name,
            lower(btrim(first_student.grade)) as normalized_grade
     from students first_student
     join students duplicate_student
       on duplicate_student.group_code = first_student.group_code
      and lower(btrim(duplicate_student.name)) = lower(btrim(first_student.name))
      and lower(btrim(duplicate_student.grade)) = lower(btrim(first_student.grade))
      and duplicate_student.id > first_student.id
     order by first_student.group_code, normalized_name, normalized_grade
     limit 1`,
  );
  if (!conflicts.rows.length) return;

  const conflict = conflicts.rows[0];
  const students = await client.query(
    `select id
     from students
     where group_code = $1
       and lower(btrim(name)) = $2
       and lower(btrim(grade)) = $3
     order by id`,
    [conflict.group_code, conflict.normalized_name, conflict.normalized_grade],
  );
  const ids = students.rows.map((student) => student.id).join(", ");

  throw new Error(
    `${studentIdentityMigration} blocked by duplicate normalized student identity: ` +
    `group="${conflict.group_code}", name="${conflict.normalized_name}", ` +
    `grade="${conflict.normalized_grade}", count=${students.rows.length}, ` +
    `ids=[${ids}]. Resolve the duplicate identities manually before retrying, ` +
    "preserving students, student_activity, attendance_events, and student_messages history.",
  );
}

const migrationPreflights = new Map([
  [studentIdentityMigration, preflightStudentIdentityMigration],
]);

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
      const preflight = migrationPreflights.get(name);
      if (preflight) await preflight(client);
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
