function dateString(value) {
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function mapMessage(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    date: dateString(row.message_date),
    body: row.body,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export class MessageRepositoryError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

async function assertStudentScope(pool, { id, branchCode, groupCode }) {
  const result = await pool.query(
    "select branch_code, group_code from students where id = $1",
    [id],
  );
  if (!result.rows.length) {
    throw new MessageRepositoryError("STUDENT_NOT_FOUND");
  }
  const student = result.rows[0];
  if (student.branch_code !== branchCode || student.group_code !== groupCode) {
    throw new MessageRepositoryError("STUDENT_OUTSIDE_GROUP");
  }
}

export async function listStudentMessages(pool, {
  id,
  branchCode,
  groupCode,
}) {
  await assertStudentScope(pool, { id, branchCode, groupCode });
  const result = await pool.query(
    `select id, student_id, message_date, body, created_by, created_at
     from student_messages
     where student_id = $1
     order by message_date desc, created_at desc, id desc`,
    [id],
  );
  return { items: result.rows.map(mapMessage) };
}

export async function createStudentMessage(pool, {
  id,
  branchCode,
  groupCode,
  date,
  body,
  actor,
}) {
  await assertStudentScope(pool, { id, branchCode, groupCode });
  const result = await pool.query(
    `insert into student_messages (student_id, message_date, body, created_by)
     values ($1, $2, $3, $4)
     returning id, student_id, message_date, body, created_by, created_at`,
    [id, date, body, actor],
  );
  return mapMessage(result.rows[0]);
}
