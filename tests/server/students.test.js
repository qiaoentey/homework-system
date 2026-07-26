import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/app.js";
import { PROFILE_FIELDS } from "../../server/domain/profile.js";
import { createTestDatabase } from "../helpers/testDatabase.js";

const emergencyPasswordHash = "task-4-test-salt:330dbd3ebcf20a4b02e6fc954a0677540e9a27cfc5ff51d956659ec11877e06fb426131601c8a7765cdd2f51a908b9013eb463625f6123e097ff762fe5b53b00";
const emptyProfile = Object.fromEntries(PROFILE_FIELDS.map((field) => [field, ""]));

function studentHeaders(branchCode = "MK", groupCode = "MK HAPPY") {
  return {
    "X-Branch-Code": branchCode,
    "X-Group-Code": groupCode,
  };
}

function testConfig() {
  return {
    sessionSecret: "test-session-secret",
    environment: "test",
    googleClientId: "test-client.apps.googleusercontent.com",
    allowedEmails: ["teacher@example.com"],
    emergencyPasswordHash,
  };
}

async function insertStudent(pool, {
  id,
  name = "CURRENT STUDENT",
  grade = "Y4",
  branchCode = "MK",
  groupCode = "MK HAPPY",
  status = "active",
  profile = { school: "SJK Test" },
} = {}) {
  const result = await pool.query(
    `insert into students (id, name, grade, branch_code, group_code, status, profile)
     values (coalesce($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7)
     returning *`,
    [id ?? null, name, grade, branchCode, groupCode, status, profile],
  );
  return result.rows[0];
}

describe("student API", () => {
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

  it("requires a signed session for roster reads and writes", async () => {
    await request(app)
      .get("/api/students?branch=MK&group=MK%20HAPPY")
      .expect(401);
    await request(app)
      .post("/api/students")
      .set(studentHeaders())
      .send({
        name: "NEW STUDENT",
        grade: "Y3",
        branchCode: "MK",
        groupCode: "MK HAPPY",
        profile: emptyProfile,
      })
      .expect(401);
  });

  it("never returns another branch through a mismatched group query", async () => {
    await insertStudent(pool, { branchCode: "MK", groupCode: "MK HAPPY" });

    const response = await agent
      .get("/api/students?branch=WS&group=MK%20HAPPY&status=active")
      .expect(400);

    expect(response.body.code).toBe("GROUP_BRANCH_MISMATCH");
  });

  it("lists only the selected group and defaults to active status", async () => {
    const expected = await insertStudent(pool, { name: " beta Student " });
    await insertStudent(pool, { name: "Stopped", status: "stopped" });
    await insertStudent(pool, {
      name: "Other branch",
      branchCode: "WS",
      groupCode: "WS HUILING",
    });

    const response = await agent
      .get("/api/students?branch=MK&group=MK%20HAPPY")
      .expect(200);

    expect(response.body).toMatchObject({
      nextCursor: null,
      total: 1,
      items: [{
        id: expected.id,
        name: " beta Student ",
        grade: "Y4",
        branchCode: "MK",
        groupCode: "MK HAPPY",
        status: "active",
        profile: { school: "SJK Test" },
      }],
    });
    expect(response.body.items[0].updatedAt).toEqual(expect.any(String));
  });

  it("searches case-insensitively within the selected branch and group", async () => {
    await insertStudent(pool, { name: "ALICE TAN" });
    await insertStudent(pool, { name: "MALICIA LIM" });
    await insertStudent(pool, { name: "BOB LEE" });
    await insertStudent(pool, {
      name: "ALICE OTHER",
      branchCode: "WS",
      groupCode: "WS HUILING",
    });

    const response = await agent
      .get("/api/students?branch=MK&group=MK%20HAPPY&search=lic")
      .expect(200);

    expect(response.body.items.map((student) => student.name)).toEqual(["ALICE TAN", "MALICIA LIM"]);
    expect(response.body.total).toBe(2);
  });

  it("orders and paginates by normalized name then stable UUID", async () => {
    await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000003",
      name: "Bob",
    });
    await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000002",
      name: "alice",
    });
    await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Alice",
      grade: "Y5",
    });

    const first = await agent
      .get("/api/students?branch=MK&group=MK%20HAPPY&limit=2")
      .expect(200);

    expect(first.body.items.map((student) => student.id)).toEqual([
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
    ]);
    expect(first.body.total).toBe(3);
    expect(first.body.nextCursor).toEqual(expect.any(String));

    const second = await agent
      .get(`/api/students?branch=MK&group=MK%20HAPPY&limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .expect(200);

    expect(second.body.items.map((student) => student.id)).toEqual([
      "00000000-0000-4000-8000-000000000003",
    ]);
    expect(second.body.nextCursor).toBeNull();
    expect(second.body.total).toBe(3);
  });

  it("uses the database-computed non-ASCII sort key for stable cursors", async () => {
    await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000002",
      name: "ÉCLAIR",
    });
    await insertStudent(pool, {
      id: "00000000-0000-4000-8000-000000000001",
      name: "éclair",
      grade: "Y5",
    });

    const first = await agent
      .get("/api/students?branch=MK&group=MK%20HAPPY&limit=1")
      .expect(200);
    const cursor = JSON.parse(Buffer.from(first.body.nextCursor, "base64url").toString("utf8"));
    const databaseSortKey = await pool.query(
      "select lower(name) as sort_name from students where id = $1",
      [first.body.items[0].id],
    );

    expect(first.body.items[0].id).toBe("00000000-0000-4000-8000-000000000001");
    expect(cursor).toEqual({
      name: databaseSortKey.rows[0].sort_name,
      id: "00000000-0000-4000-8000-000000000001",
    });

    const second = await agent
      .get(`/api/students?branch=MK&group=MK%20HAPPY&limit=1&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .expect(200);
    expect(second.body.items[0].id).toBe("00000000-0000-4000-8000-000000000002");
  });

  it("clamps requested page sizes to 50", async () => {
    await Promise.all(Array.from({ length: 51 }, (_, index) => insertStudent(pool, {
      name: `Student ${String(index + 1).padStart(2, "0")}`,
    })));

    const response = await agent
      .get("/api/students?branch=MK&group=MK%20HAPPY&limit=50000")
      .expect(200);

    expect(response.body.items).toHaveLength(50);
    expect(response.body.nextCursor).toEqual(expect.any(String));
    expect(response.body.total).toBe(51);
  });

  it("rejects malformed roster filters and cursors", async () => {
    await agent
      .get("/api/students?branch=NOPE&group=MK%20HAPPY&limit=0")
      .expect(400);
    await agent
      .get("/api/students?branch=MK&group=MK%20HAPPY&cursor=not-a-cursor")
      .expect(400);
  });

  it("enrols once with profile and activity in the selected branch transaction", async () => {
    const body = {
      name: " NEW STUDENT ",
      grade: " Y3 ",
      branchCode: "MK",
      groupCode: "MK HAPPY",
      profile: emptyProfile,
    };

    const response = await agent
      .post("/api/students")
      .set(studentHeaders())
      .send(body)
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      name: "NEW STUDENT",
      grade: "Y3",
      branchCode: "MK",
      groupCode: "MK HAPPY",
      status: "active",
      profile: emptyProfile,
      updatedAt: expect.any(String),
    });
    const activity = await pool.query(
      "select action, actor from student_activity where student_id = $1",
      [response.body.id],
    );
    expect(activity.rows).toEqual([{ action: "enrol", actor: "emergency@local" }]);

    await agent
      .post("/api/students")
      .set(studentHeaders())
      .send(body)
      .expect(409);
    expect(Number((await pool.query("select count(*) from students")).rows[0].count)).toBe(1);
    expect(Number((await pool.query("select count(*) from student_activity")).rows[0].count)).toBe(1);
  });

  it("atomically rejects one of two concurrent duplicate enrolments", async () => {
    const body = {
      name: "Concurrent Student",
      grade: "Y3",
      branchCode: "MK",
      groupCode: "MK HAPPY",
      profile: emptyProfile,
    };

    const responses = await Promise.all([
      agent.post("/api/students").set(studentHeaders()).send(body),
      agent.post("/api/students").set(studentHeaders()).send({
        ...body,
        name: "CONCURRENT STUDENT",
      }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(responses.find((response) => response.status === 409).body.code)
      .toBe("DUPLICATE_STUDENT");
    expect(Number((await pool.query(
      "select count(*) from students where group_code = $1 and lower(name) = $2 and grade = $3",
      ["MK HAPPY", "concurrent student", "Y3"],
    )).rows[0].count)).toBe(1);
    expect(Number((await pool.query("select count(*) from student_activity")).rows[0].count)).toBe(1);
  });

  it("rejects invalid enrolment fields, cross-branch groups, and write context", async () => {
    await agent
      .post("/api/students")
      .set(studentHeaders())
      .send({ name: "", grade: "", branchCode: "MK", groupCode: "", profile: emptyProfile })
      .expect(400);

    await agent
      .post("/api/students")
      .set(studentHeaders())
      .send({
        name: "NO PROFILE",
        grade: "Y3",
        branchCode: "MK",
        groupCode: "MK HAPPY",
      })
      .expect(400);

    const incompleteProfile = { ...emptyProfile };
    delete incompleteProfile.lateStayFriday;
    await agent
      .post("/api/students")
      .set(studentHeaders())
      .send({
        name: "INCOMPLETE PROFILE",
        grade: "Y3",
        branchCode: "MK",
        groupCode: "MK HAPPY",
        profile: incompleteProfile,
      })
      .expect(400);

    const mismatch = await agent
      .post("/api/students")
      .set(studentHeaders("WS", "MK HAPPY"))
      .send({
        name: "NEW STUDENT",
        grade: "Y3",
        branchCode: "WS",
        groupCode: "MK HAPPY",
        profile: emptyProfile,
      })
      .expect(400);
    expect(mismatch.body.code).toBe("GROUP_BRANCH_MISMATCH");

    await agent
      .post("/api/students")
      .send({
        name: "NEW STUDENT",
        grade: "Y3",
        branchCode: "MK",
        groupCode: "MK HAPPY",
        profile: emptyProfile,
      })
      .expect(400);
  });

  it("stops without deleting profile, attendance, or messages", async () => {
    const student = await insertStudent(pool);
    await pool.query(
      `insert into attendance_events
         (student_id, attendance_date, event_code, is_active, updated_by)
       values ($1, '2026-07-27', 'arrive', true, 'teacher@example.com')`,
      [student.id],
    );
    await pool.query(
      `insert into student_messages (student_id, message_date, body, created_by)
       values ($1, '2026-07-27', 'Keep this', 'teacher@example.com')`,
      [student.id],
    );

    const response = await agent
      .post(`/api/students/${student.id}/stop`)
      .set(studentHeaders())
      .send({ name: student.name, grade: student.grade, groupCode: student.group_code })
      .expect(200);

    expect(response.body.status).toBe("stopped");
    const row = await pool.query("select status, profile from students where id = $1", [student.id]);
    expect(row.rows[0]).toMatchObject({ status: "stopped", profile: student.profile });
    expect(Number((await pool.query(
      "select count(*) from attendance_events where student_id = $1",
      [student.id],
    )).rows[0].count)).toBe(1);
    expect(Number((await pool.query(
      "select count(*) from student_messages where student_id = $1",
      [student.id],
    )).rows[0].count)).toBe(1);
    expect((await pool.query(
      "select action from student_activity where student_id = $1",
      [student.id],
    )).rows).toEqual([{ action: "stop" }]);
  });

  it("requires exact UUID identity confirmation before stopping", async () => {
    const student = await insertStudent(pool);

    const response = await agent
      .post(`/api/students/${student.id}/stop`)
      .set(studentHeaders())
      .send({ name: student.name, grade: "Y5", groupCode: student.group_code })
      .expect(409);

    expect(response.body.code).toBe("IDENTITY_MISMATCH");
    expect((await pool.query("select status from students where id = $1", [student.id])).rows[0].status)
      .toBe("active");
  });

  it("restores only a stopped student and records history", async () => {
    const stopped = await insertStudent(pool, { status: "stopped" });

    const response = await agent
      .post(`/api/students/${stopped.id}/restore`)
      .set(studentHeaders())
      .send({})
      .expect(200);

    expect(response.body.status).toBe("active");
    expect((await pool.query(
      "select action from student_activity where student_id = $1",
      [stopped.id],
    )).rows).toEqual([{ action: "restore" }]);

    const second = await agent
      .post(`/api/students/${stopped.id}/restore`)
      .set(studentHeaders())
      .send({})
      .expect(409);
    expect(second.body.code).toBe("INVALID_STATUS");
  });

  it("server-validates write headers against the selected student", async () => {
    const student = await insertStudent(pool);

    await agent
      .post(`/api/students/${student.id}/stop`)
      .set(studentHeaders("WS", "WS HUILING"))
      .send({ name: student.name, grade: student.grade, groupCode: student.group_code })
      .expect(400);
  });

  it("updates only allowed profile fields with optimistic locking and history", async () => {
    const student = await insertStudent(pool);
    const current = await agent
      .get("/api/students?branch=MK&group=MK%20HAPPY")
      .expect(200);

    const response = await agent
      .patch(`/api/students/${student.id}/profile`)
      .set(studentHeaders())
      .send({
        updatedAt: current.body.items[0].updatedAt,
        profile: {
          school: "New School",
          usualPickupTime: "17:30",
        },
      })
      .expect(200);

    expect(response.body.profile).toEqual({
      school: "New School",
      usualPickupTime: "17:30",
    });
    expect((await pool.query(
      "select action, details from student_activity where student_id = $1",
      [student.id],
    )).rows).toEqual([{
      action: "profile_update",
      details: {
        profile: {
          school: "New School",
          usualPickupTime: "17:30",
        },
      },
    }]);

    const conflict = await agent
      .patch(`/api/students/${student.id}/profile`)
      .set(studentHeaders())
      .send({
        updatedAt: current.body.items[0].updatedAt,
        profile: { school: "Stale School" },
      })
      .expect(409);
    expect(conflict.body.code).toBe("STUDENT_CHANGED");
  });

  it("rejects unknown profile keys, non-UUID targets, and deleted selections", async () => {
    const student = await insertStudent(pool);

    await agent
      .patch(`/api/students/${student.id}/profile`)
      .set(studentHeaders())
      .send({
        updatedAt: student.updated_at.toISOString(),
        profile: { school: "Valid", notes: "not allowed" },
      })
      .expect(400);

    await agent
      .patch("/api/students/CURRENT%20STUDENT/profile")
      .set(studentHeaders())
      .send({
        updatedAt: student.updated_at.toISOString(),
        profile: { school: "No search targets" },
      })
      .expect(400);

    await agent
      .patch("/api/students/00000000-0000-4000-8000-000000000099/profile")
      .set(studentHeaders())
      .send({
        updatedAt: student.updated_at.toISOString(),
        profile: { school: "Gone" },
      })
      .expect(404);
  });
});
