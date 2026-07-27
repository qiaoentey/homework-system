import { PROFILE_FIELDS } from "../domain/profile.js";

function mapStudent(row) {
  return {
    id: row.id,
    name: row.name,
    grade: row.grade,
    branchCode: row.branch_code,
    groupCode: row.group_code,
    status: row.status,
    profile: row.profile,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function matchesEnrolmentPayload(student, {
  name,
  grade,
  branchCode,
  groupCode,
  profile,
}) {
  return student.name === name
    && student.grade === grade
    && student.branch_code === branchCode
    && student.group_code === groupCode
    && PROFILE_FIELDS.every((field) => student.profile?.[field] === profile[field]);
}

function nextUpdatedAt(previous) {
  return new Date(Math.max(Date.now(), new Date(previous).getTime() + 1));
}

function encodeCursor(student) {
  return Buffer.from(JSON.stringify({
    name: student.sort_name,
    id: student.id,
  })).toString("base64url");
}

function escapeLike(value) {
  return value.replace(/[\\%_]/gu, "\\$&");
}

export class StudentRepositoryError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

async function inTransaction(pool, operation) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listStudents(pool, {
  branchCode,
  groupCode,
  status,
  search,
  cursor,
  limit,
}) {
  const conditions = [
    "branch_code = $1",
    "group_code = $2",
    "status = $3",
  ];
  const values = [branchCode, groupCode, status];

  if (search) {
    values.push(`%${escapeLike(search.toLowerCase())}%`);
    conditions.push(`lower(name) like $${values.length}`);
  }

  const countResult = await pool.query(
    `select count(*) as total
     from students
     where ${conditions.join(" and ")}`,
    values,
  );

  if (cursor) {
    values.push(cursor.name, cursor.id);
    const nameParameter = `$${values.length - 1}`;
    const idParameter = `$${values.length}`;
    conditions.push(
      `(lower(name) > ${nameParameter}
        or (lower(name) = ${nameParameter} and id > ${idParameter}))`,
    );
  }

  values.push(limit + 1);
  const result = await pool.query(
    `select id, name, grade, branch_code, group_code, status, profile, updated_at,
            lower(name) as sort_name
     from students
     where ${conditions.join(" and ")}
     order by lower(name), id
     limit $${values.length}`,
    values,
  );
  const hasMore = result.rows.length > limit;
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

  return {
    items: rows.map(mapStudent),
    nextCursor: hasMore ? encodeCursor(rows.at(-1)) : null,
    total: Number(countResult.rows[0].total),
  };
}

export async function enrolStudent(pool, {
  name,
  grade,
  branchCode,
  groupCode,
  profile,
  enrolmentKey,
  actor,
}) {
  return inTransaction(pool, async (client) => {
    const prior = await client.query(
      `select id, name, grade, branch_code, group_code, status, profile, updated_at
       from students
       where enrolment_key = $1`,
      [enrolmentKey],
    );
    if (prior.rows.length) {
      const student = prior.rows[0];
      if (!matchesEnrolmentPayload(student, {
        name,
        grade,
        branchCode,
        groupCode,
        profile,
      })) {
        throw new StudentRepositoryError("ENROLMENT_KEY_CONFLICT");
      }
      return { student: mapStudent(student), created: false };
    }

    const inserted = await client.query(
      `insert into students
         (name, grade, branch_code, group_code, status, profile, enrolment_key)
       values ($1, $2, $3, $4, 'active', $5, $6)
       on conflict (enrolment_key) do nothing
       returning id, name, grade, branch_code, group_code, status, profile, updated_at`,
      [name, grade, branchCode, groupCode, profile, enrolmentKey],
    );
    if (inserted.rows.length) {
      const student = inserted.rows[0];
      await client.query(
        `insert into student_activity (student_id, action, actor, details)
         values ($1, 'enrol', $2, $3)`,
        [student.id, actor, { branchCode, groupCode, enrolmentKey }],
      );
      return { student: mapStudent(student), created: true };
    }

    const existing = await client.query(
      `select id, name, grade, branch_code, group_code, status, profile, updated_at
       from students
       where enrolment_key = $1`,
      [enrolmentKey],
    );
    if (!existing.rows.length) {
      throw new StudentRepositoryError("ENROLMENT_KEY_CONFLICT");
    }
    const student = existing.rows[0];
    if (!matchesEnrolmentPayload(student, {
      name,
      grade,
      branchCode,
      groupCode,
      profile,
    })) {
      throw new StudentRepositoryError("ENROLMENT_KEY_CONFLICT");
    }
    return { student: mapStudent(student), created: false };
  });
}

export async function stopStudent(pool, {
  id,
  branchCode,
  groupCode,
  name,
  grade,
  confirmedGroupCode,
  actor,
}) {
  return inTransaction(pool, async (client) => {
    const selected = await client.query(
      `select id, name, grade, branch_code, group_code, status, profile, updated_at
       from students
       where id = $1 and branch_code = $2 and group_code = $3
       for update`,
      [id, branchCode, groupCode],
    );
    if (!selected.rows.length) throw new StudentRepositoryError("STUDENT_NOT_FOUND");

    const student = selected.rows[0];
    if (
      student.name !== name ||
      student.grade !== grade ||
      student.group_code !== confirmedGroupCode
    ) {
      throw new StudentRepositoryError("IDENTITY_MISMATCH");
    }
    if (student.status !== "active") {
      throw new StudentRepositoryError("INVALID_STATUS");
    }

    const updated = await client.query(
      `update students
       set status = 'stopped', updated_at = $2
       where id = $1
       returning id, name, grade, branch_code, group_code, status, profile, updated_at`,
      [id, nextUpdatedAt(student.updated_at)],
    );
    await client.query(
      `insert into student_activity (student_id, action, actor, details)
       values ($1, 'stop', $2, $3)`,
      [id, actor, { name, grade, groupCode: confirmedGroupCode }],
    );
    return mapStudent(updated.rows[0]);
  });
}

export async function restoreStudent(pool, {
  id,
  branchCode,
  groupCode,
  actor,
}) {
  return inTransaction(pool, async (client) => {
    const selected = await client.query(
      `select id, name, grade, branch_code, group_code, status, profile, updated_at
       from students
       where id = $1 and branch_code = $2 and group_code = $3
       for update`,
      [id, branchCode, groupCode],
    );
    if (!selected.rows.length) throw new StudentRepositoryError("STUDENT_NOT_FOUND");

    const student = selected.rows[0];
    if (student.status !== "stopped") {
      throw new StudentRepositoryError("INVALID_STATUS");
    }

    const updated = await client.query(
      `update students
       set status = 'active', updated_at = $2
       where id = $1
       returning id, name, grade, branch_code, group_code, status, profile, updated_at`,
      [id, nextUpdatedAt(student.updated_at)],
    );
    await client.query(
      `insert into student_activity (student_id, action, actor)
       values ($1, 'restore', $2)`,
      [id, actor],
    );
    return mapStudent(updated.rows[0]);
  });
}

export async function updateStudentProfile(pool, {
  id,
  branchCode,
  groupCode,
  updatedAt,
  profile,
  actor,
}) {
  return inTransaction(pool, async (client) => {
    const selected = await client.query(
      `select id, name, grade, branch_code, group_code, status, profile, updated_at
       from students
       where id = $1 and branch_code = $2 and group_code = $3
       for update`,
      [id, branchCode, groupCode],
    );
    if (!selected.rows.length) throw new StudentRepositoryError("STUDENT_NOT_FOUND");

    const student = selected.rows[0];
    if (new Date(student.updated_at).getTime() !== new Date(updatedAt).getTime()) {
      throw new StudentRepositoryError("STUDENT_CHANGED");
    }

    const mergedProfile = { ...student.profile, ...profile };
    const updated = await client.query(
      `update students
       set profile = $2, updated_at = $3
       where id = $1
       returning id, name, grade, branch_code, group_code, status, profile, updated_at`,
      [id, mergedProfile, nextUpdatedAt(student.updated_at)],
    );
    await client.query(
      `insert into student_activity (student_id, action, actor, details)
       values ($1, 'profile_update', $2, $3)`,
      [id, actor, { profile }],
    );
    return mapStudent(updated.rows[0]);
  });
}
