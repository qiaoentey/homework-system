import { afterEach, describe, expect, it } from "vitest";
import { importRosters, ROSTER_FILES } from "../../scripts/import-rosters.mjs";
import { createTestDatabase } from "../helpers/testDatabase.js";
import { JANICE_ROSTER } from "../fixtures/janiceRoster.js";
import { WS_HUILING_REQUESTED_ROSTER } from "../fixtures/wsHuilingRequestedRoster.js";

const APPROVED_COUNTS = {
  "MK HAPPY": 82,
  "MK QIAO EN": 40,
  "MK WEN XUAN": 18,
  "WS HUILING": 89,
  "WS JIA WEN": 61,
  "WS MIXIN": 42,
  "巧恩 STP": 90,
  "PS STP": 83,
  "SY STP": 50,
  "YUAN NING STP": 43,
  "JANICE STP": 52,
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
    expect(result.rows).toContainEqual(expect.objectContaining({
      groupCode: "MK QIAO EN",
      name: "Aria",
      grade: "Y6",
    }));
    expect(result.rows
      .filter((row) => row.groupCode === "JANICE STP")
      .map(({ name, grade }) => [name, grade]))
      .toEqual(JANICE_ROSTER);
    const wsHuiling = result.rows.filter((row) => row.groupCode === "WS HUILING");
    expect(wsHuiling).toHaveLength(89);
    expect(wsHuiling.map(({ name, grade }) => [name, grade]))
      .toEqual(expect.arrayContaining(WS_HUILING_REQUESTED_ROSTER));
    expect(wsHuiling.filter(({ name }) => name === "颜凯峯").map(({ grade }) => grade))
      .toEqual(["Y3", "Y2"]);
    expect(wsHuiling).not.toContainEqual(expect.objectContaining({ name: "chen yi qi" }));
    expect(wsHuiling).not.toContainEqual(expect.objectContaining({ name: "胡浩文" }));
    for (const label of ["假期通知", "午餐伙食", "晚餐伙食", "liew妈妈", "Daycare助理"]) {
      expect(result.rows).not.toContainEqual(expect.objectContaining({
        groupCode: "MK HAPPY",
        name: label,
      }));
    }
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
  }, 10_000);
});
