import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "../../server/db/migrate.js";
import { createTestDatabaseBefore } from "../helpers/testDatabase.js";

const identityMigration = "002_unique_student_identity.sql";

describe("student identity migration", () => {
  const pools = [];

  afterEach(async () => {
    await Promise.all(pools.splice(0).map((pool) => pool.end()));
  });

  it("blocks legacy duplicates with actionable details without changing either student", async () => {
    const pool = await createTestDatabaseBefore(identityMigration);
    pools.push(pool);
    await pool.query(
      `insert into students (id, name, grade, branch_code, group_code, status)
       values
         ('00000000-0000-4000-8000-000000000001', ' Alice Tan ', ' Y3 ', 'MK', 'MK HAPPY', 'stopped'),
         ('00000000-0000-4000-8000-000000000002', 'ALICE TAN', 'y3', 'MK', 'MK HAPPY', 'active')`,
    );

    await expect(migrate(pool)).rejects.toThrow(
      /002_unique_student_identity\.sql.*MK HAPPY.*alice tan.*y3.*count=2.*00000000-0000-4000-8000-000000000001.*00000000-0000-4000-8000-000000000002.*preserv/isu,
    );

    expect((await pool.query(
      "select id, status from students order by id",
    )).rows).toEqual([
      { id: "00000000-0000-4000-8000-000000000001", status: "stopped" },
      { id: "00000000-0000-4000-8000-000000000002", status: "active" },
    ]);
    expect((await pool.query(
      "select name from schema_migrations order by name",
    )).rows).toEqual([{ name: "001_initial.sql" }]);
  });

  it("migrates a clean legacy database and enforces trimmed case-insensitive identity", async () => {
    const pool = await createTestDatabaseBefore(identityMigration);
    pools.push(pool);
    await pool.query(
      `insert into students (name, grade, branch_code, group_code)
       values ('Alice Tan', 'Y3', 'MK', 'MK HAPPY')`,
    );

    expect(await migrate(pool)).toEqual([identityMigration]);
    await expect(pool.query(
      `insert into students (name, grade, branch_code, group_code)
       values (' ALICE TAN ', ' y3 ', 'MK', 'MK HAPPY')`,
    )).rejects.toMatchObject({ code: "23505" });
  });
});
