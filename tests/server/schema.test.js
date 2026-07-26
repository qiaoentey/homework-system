import { afterEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/testDatabase.js";

describe("initial database schema", () => {
  const pools = [];

  afterEach(async () => {
    await Promise.all(pools.splice(0).map((pool) => pool.end()));
  });

  it("seeds exactly three branches and nine teacher groups", async () => {
    const pool = await createTestDatabase();
    pools.push(pool);

    const branches = await pool.query("select code from branches order by code");
    const groups = await pool.query("select code, branch_code from teacher_groups order by code");

    expect(branches.rows.map((row) => row.code)).toEqual(["MK", "STP", "WS"]);
    expect(groups.rows).toHaveLength(9);
  });

  it("prevents a student group from pointing at another branch", async () => {
    const pool = await createTestDatabase();
    pools.push(pool);

    await expect(pool.query(
      `insert into students (id, name, grade, branch_code, group_code)
       values ('00000000-0000-4000-8000-000000000001', 'Test', 'Y2', 'WS', 'MK HAPPY')`,
    )).rejects.toThrow();
  });
});
