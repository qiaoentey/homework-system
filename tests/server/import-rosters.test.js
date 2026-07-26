import { afterEach, describe, expect, it } from "vitest";
import { importRosters, ROSTER_FILES } from "../../scripts/import-rosters.mjs";
import { createTestDatabase } from "../helpers/testDatabase.js";

const APPROVED_COUNTS = {
  "MK HAPPY": 82,
  "MK QIAO EN": 40,
  "MK WEN XUAN": 18,
  "WS HUILING": 46,
  "WS JIA WEN": 61,
  "WS MIXIN": 42,
  "巧恩 STP": 90,
  "PS STP": 121,
  "SY STP": 50,
};

describe("approved roster import", () => {
  const pools = [];

  afterEach(async () => {
    await Promise.all(pools.splice(0).map((pool) => pool.end()));
  });

  it("imports each approved roster with its exact count and no Qiao En basic-class rows", async () => {
    const pool = await createTestDatabase();
    pools.push(pool);

    const result = await importRosters(pool, ROSTER_FILES);

    expect(result.counts).toMatchObject(APPROVED_COUNTS);
    expect(result.rows.filter((row) => row.groupCode === "MK QIAO EN"))
      .not.toContainEqual(expect.objectContaining({ sourceRef: expect.stringContaining("basic") }));
  });

  it("is idempotent and does not create duplicate students", async () => {
    const pool = await createTestDatabase();
    pools.push(pool);

    await importRosters(pool, ROSTER_FILES);
    const second = await importRosters(pool, ROSTER_FILES);
    const students = await pool.query("select group_code, source_ref from students");

    expect(second.inserted).toBe(0);
    expect(students.rows).toHaveLength(Object.values(APPROVED_COUNTS).reduce((sum, count) => sum + count, 0));
    expect(new Set(students.rows.map((row) => `${row.group_code}:${row.source_ref}`)).size)
      .toBe(students.rows.length);
  });
});
