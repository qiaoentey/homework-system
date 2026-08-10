import { afterEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/testDatabase.js";

describe("initial database schema", () => {
  const pools = [];

  afterEach(async () => {
    await Promise.all(pools.splice(0).map((pool) => pool.end()));
  });

  it("seeds exactly three branches and eleven teacher groups", async () => {
    const pool = await createTestDatabase();
    pools.push(pool);

    const branches = await pool.query("select code from branches order by code");
    const groups = await pool.query("select code, branch_code from teacher_groups order by code");

    expect(branches.rows.map((row) => row.code)).toEqual(["MK", "STP", "WS"]);
    expect(groups.rows).toHaveLength(11);
    expect(groups.rows).toContainEqual({ code: "JANICE STP", branch_code: "STP" });
  });

  it("stores an optional reason beside attendance events", async () => {
    const pool = await createTestDatabase();
    pools.push(pool);

    const columns = await pool.query(
      `select column_name, is_nullable
       from information_schema.columns
       where table_name = 'attendance_events'
         and column_name = 'absence_reason'`,
    );

    expect(columns.rows).toEqual([{
      column_name: "absence_reason",
      is_nullable: expect.any(String),
    }]);
  });

  it("prevents a student group from pointing at another branch", async () => {
    const pool = await createTestDatabase();
    pools.push(pool);

    await expect(pool.query(
      `insert into students (id, name, grade, branch_code, group_code)
       values ('00000000-0000-4000-8000-000000000001', 'Test', 'Y2', 'WS', 'MK HAPPY')`,
    )).rejects.toThrow();
  });

  it("allows real duplicate identities while enforcing unique enrolment keys", async () => {
    const pool = await createTestDatabase();
    pools.push(pool);
    const initialCount = Number((await pool.query("select count(*) from students")).rows[0].count);

    await pool.query(
      `insert into students
         (name, grade, branch_code, group_code, status, enrolment_key)
       values ('Alice Tan', 'Y3', 'MK', 'MK HAPPY', 'stopped',
               '10000000-0000-4000-8000-000000000001')`,
    );

    await pool.query(
      `insert into students
         (name, grade, branch_code, group_code, enrolment_key)
       values (' ALICE TAN ', ' y3 ', 'MK', 'MK HAPPY',
               '10000000-0000-4000-8000-000000000002')`,
    );

    await expect(pool.query(
      `insert into students
         (name, grade, branch_code, group_code, enrolment_key)
       values ('Another Student', 'Y5', 'MK', 'MK HAPPY',
               '10000000-0000-4000-8000-000000000001')`,
    )).rejects.toMatchObject({ code: "23505" });

    expect(Number((await pool.query("select count(*) from students")).rows[0].count))
      .toBe(initialCount + 2);
  });
});
