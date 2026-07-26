import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/app.js";
import { listStudentMessages } from "../../server/repositories/messages.js";
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
} = {}) {
  const result = await pool.query(
    `insert into students (id, name, grade, branch_code, group_code)
     values (coalesce($1, gen_random_uuid()), $2, 'Y4', $3, $4)
     returning *`,
    [id ?? null, name, branchCode, groupCode],
  );
  return result.rows[0];
}

describe("student message API", () => {
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

  it("requires a signed session for message reads and writes", async () => {
    const student = await insertStudent(pool);

    await request(app)
      .get(`/api/students/${student.id}/messages`)
      .set(groupHeaders())
      .expect(401);
    await request(app)
      .post(`/api/students/${student.id}/messages`)
      .set(groupHeaders())
      .send({ date: "2026-07-27", body: "Message" })
      .expect(401);
  });

  it("creates one trimmed message for the selected student and signed-in actor", async () => {
    const student = await insertStudent(pool);

    const response = await agent
      .post(`/api/students/${student.id}/messages`)
      .set(groupHeaders())
      .send({ date: "2026-07-27", body: "  Bring workbook tomorrow.  " })
      .expect(201);

    expect(response.body).toEqual({
      id: expect.any(String),
      studentId: student.id,
      date: "2026-07-27",
      body: "Bring workbook tomorrow.",
      createdBy: "emergency@local",
      createdAt: expect.any(String),
    });
    const stored = await pool.query(
      `select student_id, message_date, body, created_by
       from student_messages`,
    );
    expect(stored.rows.map((row) => ({
      student_id: row.student_id,
      date: new Date(row.message_date).toISOString().slice(0, 10),
      body: row.body,
      created_by: row.created_by,
    }))).toEqual([{
      student_id: student.id,
      date: "2026-07-27",
      body: "Bring workbook tomorrow.",
      created_by: "emergency@local",
    }]);
  });

  it("lists one student's messages newest first with a stable tie-breaker", async () => {
    const student = await insertStudent(pool);
    const other = await insertStudent(pool, { name: "OTHER STUDENT" });
    await pool.query(
      `insert into student_messages
         (id, student_id, message_date, body, created_by, created_at)
       values
         ('00000000-0000-4000-8000-000000000001', $1, '2026-07-25', 'Old', 'a@example.com',
          '2026-07-25T09:00:00Z'),
         ('00000000-0000-4000-8000-000000000002', $1, '2026-07-27', 'Newest first', 'b@example.com',
          '2026-07-27T10:00:00Z'),
         ('00000000-0000-4000-8000-000000000003', $1, '2026-07-27', 'Newest second', 'c@example.com',
          '2026-07-27T09:00:00Z'),
         ('00000000-0000-4000-8000-000000000004', $2, '2026-07-28', 'Other student', 'd@example.com',
          '2026-07-28T09:00:00Z')`,
      [student.id, other.id],
    );

    const response = await agent
      .get(`/api/students/${student.id}/messages`)
      .set(groupHeaders())
      .expect(200);

    expect(response.body.items.map((message) => message.body)).toEqual([
      "Newest first",
      "Newest second",
      "Old",
    ]);
    expect(response.body.items.every((message) => message.studentId === student.id)).toBe(true);
  });

  it("preserves a PostgreSQL local-midnight message date in Malaysia time", async () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = "Asia/Kuala_Lumpur";
    try {
      const databaseDate = new Date(2026, 6, 27);
      expect(databaseDate.toISOString().slice(0, 10)).toBe("2026-07-26");
      const driverPool = {
        query: async (sql) => {
          if (sql.includes("from students")) {
            return { rows: [{ branch_code: "MK", group_code: "MK HAPPY" }] };
          }
          return {
            rows: [{
              id: "00000000-0000-4000-8000-000000000002",
              student_id: "00000000-0000-4000-8000-000000000001",
              message_date: databaseDate,
              body: "Bring workbook",
              created_by: "teacher@example.com",
              created_at: new Date("2026-07-27T03:00:00.000Z"),
            }],
          };
        },
      };

      const response = await listStudentMessages(driverPool, {
        id: "00000000-0000-4000-8000-000000000001",
        branchCode: "MK",
        groupCode: "MK HAPPY",
      });

      expect(response.items[0].date).toBe("2026-07-27");
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });

  it("rejects message access when the student is outside the selected group", async () => {
    const student = await insertStudent(pool);

    const read = await agent
      .get(`/api/students/${student.id}/messages`)
      .set(groupHeaders("WS", "WS HUILING"))
      .expect(403);
    const write = await agent
      .post(`/api/students/${student.id}/messages`)
      .set(groupHeaders("WS", "WS HUILING"))
      .send({ date: "2026-07-27", body: "Must not save" })
      .expect(403);

    expect(read.body.code).toBe("STUDENT_OUTSIDE_GROUP");
    expect(write.body.code).toBe("STUDENT_OUTSIDE_GROUP");
    expect(Number((await pool.query("select count(*) from student_messages")).rows[0].count))
      .toBe(0);
  });

  it("rejects empty, oversized, malformed-date, extra-field, and unscoped messages", async () => {
    const student = await insertStudent(pool);
    const path = `/api/students/${student.id}/messages`;

    await agent
      .post(path)
      .set(groupHeaders())
      .send({ date: "2026-07-27", body: "   " })
      .expect(400);
    await agent
      .post(path)
      .set(groupHeaders())
      .send({ date: "2026-07-27", body: "x".repeat(2001) })
      .expect(400);
    await agent
      .post(path)
      .set(groupHeaders())
      .send({ date: "2026-02-30", body: "Invalid date" })
      .expect(400);
    await agent
      .post(path)
      .set(groupHeaders())
      .send({ date: "2026-07-27", body: "No extra", extra: true })
      .expect(400);
    await agent
      .post(path)
      .send({ date: "2026-07-27", body: "No context" })
      .expect(400);

    expect(Number((await pool.query("select count(*) from student_messages")).rows[0].count))
      .toBe(0);
  });

  it("counts message limits by Unicode code points instead of UTF-16 units", async () => {
    const student = await insertStudent(pool);
    const path = `/api/students/${student.id}/messages`;

    const accepted = await agent
      .post(path)
      .set(groupHeaders())
      .send({ date: "2026-07-27", body: "🙂".repeat(1001) })
      .expect(201);
    expect(Array.from(accepted.body.body)).toHaveLength(1001);

    await agent
      .post(path)
      .set(groupHeaders())
      .send({ date: "2026-07-27", body: "🙂".repeat(2001) })
      .expect(400);
    expect(Number((await pool.query("select count(*) from student_messages")).rows[0].count))
      .toBe(1);
  });
});
