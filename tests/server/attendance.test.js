import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/app.js";
import { GROUPS } from "../../server/domain/catalog.js";
import { listAttendance } from "../../server/repositories/attendance.js";
import { createTestDatabase } from "../helpers/testDatabase.js";

const emergencyPasswordHash = "task-4-test-salt:330dbd3ebcf20a4b02e6fc954a0677540e9a27cfc5ff51d956659ec11877e06fb426131601c8a7765cdd2f51a908b9013eb463625f6123e097ff762fe5b53b00";

function testConfig() {
  return {
    sessionSecret: "test-session-secret",
    environment: "test",
    googleClientId: "test-client.apps.googleusercontent.com",
    allowedEmails: ["teacher@example.com"],
    dashboardAllowedEmails: ["emergency@local"],
    emergencyPasswordHash,
  };
}

function groupHeaders(branchCode = "MK", groupCode = "MK HAPPY") {
  return {
    "X-Branch-Code": branchCode,
    "X-Group-Code": groupCode,
  };
}

async function insertStudent(pool, {
  id,
  name = "CURRENT STUDENT",
  branchCode = "MK",
  groupCode = "MK HAPPY",
  status = "active",
} = {}) {
  const result = await pool.query(
    `insert into students (id, name, grade, branch_code, group_code, status)
     values (coalesce($1, gen_random_uuid()), $2, 'Y4', $3, $4, $5)
     returning *`,
    [id ?? null, name, branchCode, groupCode, status],
  );
  return result.rows[0];
}

async function insertEvent(pool, studentId, eventCode, {
  date = "2026-07-27",
  active = true,
  absenceReason = null,
} = {}) {
  await pool.query(
    `insert into attendance_events
       (student_id, attendance_date, event_code, is_active, absence_reason, updated_by)
     values ($1, $2, $3, $4, $5, 'fixture@example.com')`,
    [studentId, date, eventCode, active, absenceReason],
  );
}

describe("attendance API", () => {
  let pool;
  let app;
  let agent;

  beforeEach(async () => {
    pool = await createTestDatabase();
    app = createApp({ config: testConfig(), pool });
    agent = request.agent(app);
    await agent.post("/api/session/emergency").send({ password: "test-access" }).expect(204);
  });

  afterEach(async () => {
    await pool.end();
  });

  it("requires a signed session for attendance, records, and summary access", async () => {
    const student = await insertStudent(pool);

    await request(app)
      .get("/api/attendance?branch=MK&group=MK%20HAPPY&date=2026-07-27")
      .expect(401);
    await request(app)
      .put(`/api/students/${student.id}/attendance/2026-07-27/arrive`)
      .set(groupHeaders())
      .send({ active: true })
      .expect(401);
    await request(app)
      .get("/api/summary?branch=MK&group=MK%20HAPPY&date=2026-07-27")
      .expect(401);
    await request(app)
      .get("/api/attendance-records?branch=MK&group=MK%20HAPPY&date=2026-07-27")
      .expect(401);
    await request(app)
      .get("/api/dashboard?date=2026-07-27")
      .expect(401);
  });

  it("rejects the three-branch Dashboard for a signed-in teacher outside the admin list", async () => {
    const restrictedApp = createApp({
      config: {
        ...testConfig(),
        dashboardAllowedEmails: ["teacher@example.com"],
      },
      pool,
    });
    const regularTeacher = request.agent(restrictedApp);
    await regularTeacher
      .post("/api/session/emergency")
      .send({ password: "test-access" })
      .expect(204);

    const catalog = await regularTeacher.get("/api/catalog").expect(200);
    expect(catalog.body.permissions).toEqual({ canViewDashboard: false });
    await regularTeacher
      .get("/api/dashboard?date=2026-07-27")
      .expect(403, {
        code: "DASHBOARD_ACCESS_DENIED",
        error: "Dashboard access is not allowed",
      });
  });

  it("lists scoped present, absent, unmarked, stopped-history, and conflict records", async () => {
    const present = await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000001",
      name: "PRESENT",
    });
    const stoppedPresent = await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000002",
      name: "STOPPED PRESENT",
      status: "stopped",
    });
    const absent = await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000003",
      name: "ABSENT",
    });
    const unmarked = await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000004",
      name: "UNMARKED",
    });
    const conflict = await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000005",
      name: "CONFLICT",
    });
    const otherGroup = await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000006",
      name: "OTHER GROUP",
      branchCode: "WS",
      groupCode: "WS HUILING",
    });
    await insertEvent(pool, present.id, "arrive");
    await insertEvent(pool, stoppedPresent.id, "arrive");
    await insertEvent(pool, absent.id, "absent", { absenceReason: "生病" });
    await insertEvent(pool, unmarked.id, "arrive", { active: false });
    await insertEvent(pool, conflict.id, "arrive");
    await insertEvent(pool, conflict.id, "absent");
    await insertEvent(pool, otherGroup.id, "arrive");

    const response = await agent
      .get("/api/attendance-records?branch=MK&group=MK%20HAPPY&date=2026-07-27")
      .expect(200);

    expect(response.body).toEqual({
      date: "2026-07-27",
      counts: { present: 2, absent: 1, unmarked: 1, conflicts: 1 },
      present: [
        { id: present.id, name: "PRESENT", grade: "Y4" },
        { id: stoppedPresent.id, name: "STOPPED PRESENT", grade: "Y4" },
      ],
      absent: [{ id: absent.id, name: "ABSENT", grade: "Y4", absenceReason: "生病" }],
      unmarked: [{ id: unmarked.id, name: "UNMARKED", grade: "Y4" }],
      conflicts: [{ id: conflict.id, name: "CONFLICT", grade: "Y4" }],
    });
  });

  it("lists attendance only for active students in the selected branch and group", async () => {
    const current = await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000001",
    });
    const stopped = await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000002",
      name: "STOPPED",
      status: "stopped",
    });
    const otherGroup = await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000003",
      name: "OTHER GROUP",
      branchCode: "WS",
      groupCode: "WS HUILING",
    });
    await insertEvent(pool, current.id, "arrive");
    await insertEvent(pool, current.id, "koko", { active: false });
    await insertEvent(pool, stopped.id, "arrive");
    await insertEvent(pool, otherGroup.id, "arrive");

    const response = await agent
      .get("/api/attendance?branch=MK&group=MK%20HAPPY&date=2026-07-27")
      .expect(200);

    expect(response.body).toEqual({
      items: [
        {
          studentId: current.id,
          date: "2026-07-27",
          eventCode: "arrive",
          active: true,
          absenceReason: null,
          updatedBy: "fixture@example.com",
          updatedAt: expect.any(String),
        },
        {
          studentId: current.id,
          date: "2026-07-27",
          eventCode: "koko",
          active: false,
          absenceReason: null,
          updatedBy: "fixture@example.com",
          updatedAt: expect.any(String),
        },
      ],
    });
  });

  it("preserves a PostgreSQL local-midnight attendance date in Malaysia time", async () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = "Asia/Kuala_Lumpur";
    try {
      const databaseDate = new Date(2026, 6, 27);
      expect(databaseDate.toISOString().slice(0, 10)).toBe("2026-07-26");
      const driverPool = {
        query: async () => ({
          rows: [{
            student_id: "00000000-0000-4000-8000-000000000001",
            attendance_date: databaseDate,
            event_code: "arrive",
            is_active: true,
            updated_by: "teacher@example.com",
            updated_at: new Date("2026-07-27T03:00:00.000Z"),
          }],
        }),
      };

      const response = await listAttendance(driverPool, {
        branchCode: "MK",
        groupCode: "MK HAPPY",
        date: "2026-07-27",
      });

      expect(response.items[0].date).toBe("2026-07-27");
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });

  it("upserts one event without duplicating it and records the signed-in actor", async () => {
    const student = await insertStudent(pool);
    const path = `/api/students/${student.id}/attendance/2026-07-27/arrive`;

    const first = await agent
      .put(path)
      .set(groupHeaders())
      .send({ active: true })
      .expect(200);
    const second = await agent
      .put(path)
      .set(groupHeaders())
      .send({ active: false })
      .expect(200);

    expect(first.body).toMatchObject({
      studentId: student.id,
      date: "2026-07-27",
      eventCode: "arrive",
      active: true,
      updatedBy: "emergency@local",
    });
    expect(second.body.active).toBe(false);
    const stored = await pool.query(
      `select is_active, updated_by
       from attendance_events
       where student_id = $1 and attendance_date = $2 and event_code = $3`,
      [student.id, "2026-07-27", "arrive"],
    );
    expect(stored.rows).toEqual([{
      is_active: false,
      updated_by: "emergency@local",
    }]);
  });

  it("requires, trims, persists, lists, and clears an active absence reason", async () => {
    const student = await insertStudent(pool);
    const prefix = `/api/students/${student.id}/attendance/2026-07-27`;

    const saved = await agent
      .put(`${prefix}/absent`)
      .set(groupHeaders())
      .send({ active: true, reason: "  旅行  " })
      .expect(200);

    expect(saved.body).toMatchObject({
      studentId: student.id,
      eventCode: "absent",
      active: true,
      absenceReason: "旅行",
    });
    const listed = await agent
      .get("/api/attendance?branch=MK&group=MK%20HAPPY&date=2026-07-27")
      .expect(200);
    expect(listed.body.items).toContainEqual(expect.objectContaining({
      studentId: student.id,
      eventCode: "absent",
      absenceReason: "旅行",
    }));

    const cleared = await agent
      .put(`${prefix}/absent`)
      .set(groupHeaders())
      .send({ active: false })
      .expect(200);
    expect(cleared.body).toMatchObject({ active: false, absenceReason: null });
    expect((await pool.query(
      `select absence_reason from attendance_events
       where student_id = $1 and attendance_date = $2 and event_code = 'absent'`,
      [student.id, "2026-07-27"],
    )).rows).toEqual([{ absence_reason: null }]);
  });

  it("atomically makes active arrive and absent mutually exclusive", async () => {
    const student = await insertStudent(pool);
    await insertEvent(pool, student.id, "absent");
    const prefix = `/api/students/${student.id}/attendance/2026-07-27`;

    await agent
      .put(`${prefix}/arrive`)
      .set(groupHeaders())
      .send({ active: true })
      .expect(200);
    expect((await pool.query(
      `select event_code, is_active from attendance_events
       where student_id = $1 and attendance_date = $2
       order by event_code`,
      [student.id, "2026-07-27"],
    )).rows).toEqual([
      { event_code: "absent", is_active: false },
      { event_code: "arrive", is_active: true },
    ]);

    await agent
      .put(`${prefix}/absent`)
      .set(groupHeaders())
      .send({ active: true, reason: "家事" })
      .expect(200);
    await agent
      .put(`${prefix}/arrive`)
      .set(groupHeaders())
      .send({ active: false })
      .expect(200);
    expect((await pool.query(
      `select event_code, is_active from attendance_events
       where student_id = $1 and attendance_date = $2
       order by event_code`,
      [student.id, "2026-07-27"],
    )).rows).toEqual([
      { event_code: "absent", is_active: true },
      { event_code: "arrive", is_active: false },
    ]);
  });

  it("rejects attendance when the student is outside the selected group", async () => {
    const mkStudent = await insertStudent(pool);

    const response = await agent
      .put(`/api/students/${mkStudent.id}/attendance/2026-07-27/arrive`)
      .set(groupHeaders("WS", "WS HUILING"))
      .send({ active: true })
      .expect(403);

    expect(response.body.code).toBe("STUDENT_OUTSIDE_GROUP");
    expect(Number((await pool.query("select count(*) from attendance_events")).rows[0].count))
      .toBe(0);
  });

  it("validates exact attendance dates, event codes, bodies, and group contracts", async () => {
    const student = await insertStudent(pool);
    const prefix = `/api/students/${student.id}/attendance`;

    await agent
      .put(`${prefix}/2026-02-30/arrive`)
      .set(groupHeaders())
      .send({ active: true })
      .expect(400);
    await agent
      .put(`${prefix}/2026-07-27/Arrive`)
      .set(groupHeaders())
      .send({ active: true })
      .expect(400);
    await agent
      .put(`${prefix}/2026-07-27/home`)
      .set(groupHeaders())
      .send({ active: true })
      .expect(400);
    await agent
      .put(`${prefix}/2026-07-27/review`)
      .set(groupHeaders())
      .send({ active: true })
      .expect(400);
    await agent
      .put(`${prefix}/2026-07-27/koko`)
      .set(groupHeaders())
      .send({ active: true })
      .expect(400);
    await agent
      .put(`${prefix}/2026-07-27/arrive`)
      .set(groupHeaders())
      .send({ active: "true" })
      .expect(400);
    await agent
      .put(`${prefix}/2026-07-27/arrive`)
      .set(groupHeaders())
      .send({ active: true, extra: true })
      .expect(400);
    await agent
      .put(`${prefix}/2026-07-27/absent`)
      .set(groupHeaders())
      .send({ active: true })
      .expect(400);
    await agent
      .put(`${prefix}/2026-07-27/absent`)
      .set(groupHeaders())
      .send({ active: true, reason: "   " })
      .expect(400);
    await agent
      .put(`${prefix}/2026-07-27/absent`)
      .set(groupHeaders())
      .send({ active: true, reason: "a".repeat(101) })
      .expect(400);
    await agent
      .put(`${prefix}/2026-07-27/arrive`)
      .set(groupHeaders())
      .send({ active: true, reason: "生病" })
      .expect(400);
    await agent
      .put(`${prefix}/2026-07-27/arrive`)
      .send({ active: true })
      .expect(400);
    const mismatch = await agent
      .put(`${prefix}/2026-07-27/arrive`)
      .set(groupHeaders("WS", "MK HAPPY"))
      .send({ active: true })
      .expect(400);
    expect(mismatch.body.code).toBe("GROUP_BRANCH_MISMATCH");

    await agent
      .get("/api/attendance?branch=MK&group=WS%20HUILING&date=2026-07-27")
      .expect(400);
    await agent
      .get("/api/summary?branch=MK&group=MK%20HAPPY&date=2026-2-3")
      .expect(400);
    await agent
      .get("/api/attendance-records?branch=MK&group=MK%20HAPPY&date=2026-02-30")
      .expect(400);
    const recordMismatch = await agent
      .get("/api/attendance-records?branch=MK&group=WS%20HUILING&date=2026-07-27")
      .expect(400);
    expect(recordMismatch.body.code).toBe("GROUP_BRANCH_MISMATCH");
    await agent
      .get("/api/dashboard?date=2026-02-30")
      .expect(400);
    await agent
      .get("/api/dashboard?date=2026-07-27&branch=MK")
      .expect(400);
  });

  it("keeps only the newest primary attendance state active", async () => {
    const selected = await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000091",
      name: "PRIMARY STATE",
    });
    const prefix = `/api/students/${selected.id}/attendance/2026-07-27`;

    for (const eventCode of ["arrive", "absent"]) {
      await agent
        .put(`${prefix}/${eventCode}`)
        .set(groupHeaders())
        .send(eventCode === "absent" ? { active: true, reason: "校外比赛" } : { active: true })
        .expect(200);
    }

    const active = await pool.query(
      `select event_code
       from attendance_events
       where student_id = $1 and attendance_date = $2 and is_active = true
       order by event_code`,
      [selected.id, "2026-07-27"],
    );
    expect(active.rows.map((row) => row.event_code)).toEqual(["absent"]);
  });

  it("clears only the selected student's events on the selected date", async () => {
    const selected = await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000001",
    });
    const peer = await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000002",
      name: "PEER",
    });
    await insertEvent(pool, selected.id, "arrive");
    await insertEvent(pool, selected.id, "koko");
    await insertEvent(pool, selected.id, "arrive", { date: "2026-07-28" });
    await insertEvent(pool, peer.id, "arrive");

    const response = await agent
      .delete(`/api/students/${selected.id}/attendance/2026-07-27`)
      .set(groupHeaders())
      .expect(200);

    expect(response.body).toEqual({ cleared: 2 });
    const remaining = await pool.query(
      `select student_id, attendance_date, event_code
       from attendance_events
       order by student_id, attendance_date`,
    );
    expect(remaining.rows.map((row) => ({
      student_id: row.student_id,
      date: new Date(row.attendance_date).toISOString().slice(0, 10),
      event_code: row.event_code,
    }))).toEqual([
      {
        student_id: selected.id,
        date: "2026-07-28",
        event_code: "arrive",
      },
      {
        student_id: peer.id,
        date: "2026-07-27",
        event_code: "arrive",
      },
    ]);
  });

  it("summarizes unique active students and handles overlapping event markers", async () => {
    const students = await Promise.all([
      insertStudent(pool, { name: "ARRIVED" }),
      insertStudent(pool, { name: "ABSENT" }),
      insertStudent(pool, { name: "KOKO" }),
      insertStudent(pool, { name: "ARRIVED AND KOKO" }),
      insertStudent(pool, { name: "INACTIVE MARKER" }),
      insertStudent(pool, { name: "UNMARKED" }),
    ]);
    const stopped = await insertStudent(pool, { name: "STOPPED", status: "stopped" });
    const other = await insertStudent(pool, {
      name: "OTHER",
      branchCode: "WS",
      groupCode: "WS HUILING",
    });

    await insertEvent(pool, students[0].id, "arrive");
    await insertEvent(pool, students[1].id, "absent");
    await insertEvent(pool, students[2].id, "koko");
    await insertEvent(pool, students[3].id, "arrive");
    await insertEvent(pool, students[3].id, "koko");
    await insertEvent(pool, students[4].id, "arrive", { active: false });
    await insertEvent(pool, stopped.id, "arrive");
    await insertEvent(pool, other.id, "absent");

    const response = await agent
      .get("/api/summary?branch=MK&group=MK%20HAPPY&date=2026-07-27")
      .expect(200);

    expect(response.body).toEqual({
      expected: 6,
      arrived: 2,
      notArrived: 3,
      absent: 1,
      unmarked: 3,
    });
  });

  it("returns every daycare group with the same daily status calculation", async () => {
    await pool.query(
      "delete from students where group_code = any($1::text[])",
      [["MK HAPPY", "MK WEN XUAN", "WS HUILING"]],
    );
    const arrived = await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000101",
      name: "MK ARRIVED",
    });
    const absent = await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000102",
      name: "MK ABSENT",
    });
    const koko = await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000103",
      name: "MK KOKO",
    });
    const unmarked = await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000104",
      name: "MK UNMARKED",
    });
    const stopped = await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000105",
      name: "STOPPED",
      status: "stopped",
    });
    const wsKoko = await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000106",
      name: "WS KOKO",
      branchCode: "WS",
      groupCode: "WS HUILING",
    });
    await insertEvent(pool, arrived.id, "arrive");
    await insertEvent(pool, arrived.id, "shower");
    await insertEvent(pool, arrived.id, "meal");
    await insertEvent(pool, arrived.id, "homework");
    await insertEvent(pool, arrived.id, "supplement");
    await insertEvent(pool, absent.id, "absent", { absenceReason: "旅行" });
    await insertEvent(pool, koko.id, "koko");
    await insertEvent(pool, stopped.id, "arrive");
    await insertEvent(pool, wsKoko.id, "koko");

    const response = await agent
      .get("/api/dashboard?date=2026-07-27")
      .expect(200);

    expect(response.body.date).toBe("2026-07-27");
    expect(response.body.groups).toHaveLength(GROUPS.length);
    expect(response.body.groups.map(({ groupCode }) => groupCode))
      .toEqual(GROUPS.map(({ code }) => code));

    const mkHappy = response.body.groups.find(({ groupCode }) => groupCode === "MK HAPPY");
    expect(mkHappy).toEqual({
      branchCode: "MK",
      groupCode: "MK HAPPY",
      groupLabel: "HAPPY",
      summary: {
        expected: 4,
        arrived: 1,
        notArrived: 2,
        absent: 1,
        unmarked: 2,
      },
      students: [
        {
          id: absent.id,
          name: "MK ABSENT",
          grade: "Y4",
          status: "absent",
          events: ["absent"],
          absenceReason: "旅行",
        },
        {
          id: arrived.id,
          name: "MK ARRIVED",
          grade: "Y4",
          status: "arrived",
          events: ["arrive", "shower", "meal", "homework", "supplement"],
        },
        { id: koko.id, name: "MK KOKO", grade: "Y4", status: "unmarked", events: [] },
        { id: unmarked.id, name: "MK UNMARKED", grade: "Y4", status: "unmarked", events: [] },
      ],
    });
    const currentClass = await agent
      .get("/api/summary?branch=MK&group=MK%20HAPPY&date=2026-07-27")
      .expect(200);
    expect(currentClass.body).toEqual(mkHappy.summary);
    expect(response.body.groups.find(({ groupCode }) => groupCode === "WS HUILING"))
      .toMatchObject({
        summary: {
          expected: 1,
          arrived: 0,
          notArrived: 1,
          absent: 0,
          unmarked: 1,
        },
        students: [{
          id: wsKoko.id,
          name: "WS KOKO",
          grade: "Y4",
          status: "unmarked",
          events: [],
        }],
      });
    expect(response.body.groups.find(({ groupCode }) => groupCode === "MK WEN XUAN"))
      .toMatchObject({
        summary: {
          expected: 0,
          arrived: 0,
          notArrived: 0,
          absent: 0,
          unmarked: 0,
        },
        students: [],
      });
  });
});
