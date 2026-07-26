import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/app.js";
import { listAttendance } from "../../server/repositories/attendance.js";
import { createTestDatabase } from "../helpers/testDatabase.js";

const emergencyPasswordHash = "task-4-test-salt:330dbd3ebcf20a4b02e6fc954a0677540e9a27cfc5ff51d956659ec11877e06fb426131601c8a7765cdd2f51a908b9013eb463625f6123e097ff762fe5b53b00";

function testConfig() {
  return {
    sessionSecret: "test-session-secret",
    environment: "test",
    googleClientId: "test-client.apps.googleusercontent.com",
    allowedEmails: ["teacher@example.com"],
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
} = {}) {
  await pool.query(
    `insert into attendance_events
       (student_id, attendance_date, event_code, is_active, updated_by)
     values ($1, $2, $3, $4, 'fixture@example.com')`,
    [studentId, date, eventCode, active],
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

  it("requires a signed session for attendance and summary access", async () => {
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
          updatedBy: "fixture@example.com",
          updatedAt: expect.any(String),
        },
        {
          studentId: current.id,
          date: "2026-07-27",
          eventCode: "koko",
          active: false,
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
      koko: 2,
      unmarked: 2,
    });
  });
});
