function dateString(value) {
  if (typeof value === "string") return value.slice(0, 10);
  const date = new Date(value);
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mapAttendanceEvent(row) {
  return {
    studentId: row.student_id,
    date: dateString(row.attendance_date),
    eventCode: row.event_code,
    active: row.is_active,
    updatedBy: row.updated_by,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class AttendanceRepositoryError extends Error {
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

async function assertStudentScope(pool, { id, branchCode, groupCode }) {
  const result = await pool.query(
    "select branch_code, group_code from students where id = $1",
    [id],
  );
  if (!result.rows.length) {
    throw new AttendanceRepositoryError("STUDENT_NOT_FOUND");
  }
  const student = result.rows[0];
  if (student.branch_code !== branchCode || student.group_code !== groupCode) {
    throw new AttendanceRepositoryError("STUDENT_OUTSIDE_GROUP");
  }
}

export async function listAttendance(pool, {
  branchCode,
  groupCode,
  date,
}) {
  const result = await pool.query(
    `select ae.student_id, ae.attendance_date, ae.event_code, ae.is_active,
            ae.updated_by, ae.updated_at
     from attendance_events ae
     join students s on s.id = ae.student_id
     where s.branch_code = $1
       and s.group_code = $2
       and s.status = 'active'
       and ae.attendance_date = $3
     order by ae.student_id, ae.event_code`,
    [branchCode, groupCode, date],
  );
  return { items: result.rows.map(mapAttendanceEvent) };
}

export async function getAttendanceRecord(pool, {
  branchCode,
  groupCode,
  date,
}) {
  const result = await pool.query(
    `select s.id, s.name, s.grade, s.status, ae.event_code
     from students s
     left join attendance_events ae
       on ae.student_id = s.id
      and ae.attendance_date = $3
      and ae.is_active = true
      and ae.event_code in ('arrive', 'absent')
     where s.branch_code = $1
       and s.group_code = $2
       and (s.status = 'active' or ae.event_code is not null)
     order by lower(s.name), s.id, ae.event_code`,
    [branchCode, groupCode, date],
  );
  const students = new Map();
  for (const row of result.rows) {
    if (!students.has(row.id)) {
      students.set(row.id, {
        item: { id: row.id, name: row.name, grade: row.grade },
        status: row.status,
        events: new Set(),
      });
    }
    if (row.event_code) students.get(row.id).events.add(row.event_code);
  }

  const present = [];
  const absent = [];
  const unmarked = [];
  const conflicts = [];
  for (const { item, status, events } of students.values()) {
    if (events.has("arrive") && events.has("absent")) conflicts.push(item);
    else if (events.has("arrive")) present.push(item);
    else if (events.has("absent")) absent.push(item);
    else if (status === "active") unmarked.push(item);
  }

  return {
    date,
    counts: {
      present: present.length,
      absent: absent.length,
      unmarked: unmarked.length,
      conflicts: conflicts.length,
    },
    present,
    absent,
    unmarked,
    conflicts,
  };
}

export async function upsertAttendanceEvent(pool, {
  id,
  branchCode,
  groupCode,
  date,
  eventCode,
  active,
  actor,
}) {
  return inTransaction(pool, async (client) => {
    await assertStudentScope(client, { id, branchCode, groupCode });
    const upsert = `insert into attendance_events
       (student_id, attendance_date, event_code, is_active, updated_by)
     values ($1, $2, $3, $4, $5)
     on conflict (student_id, attendance_date, event_code)
     do update set
       is_active = excluded.is_active,
       updated_by = excluded.updated_by,
       updated_at = now()
     returning student_id, attendance_date, event_code, is_active, updated_by, updated_at`;
    const result = await client.query(upsert, [id, date, eventCode, active, actor]);
    if (active && (eventCode === "arrive" || eventCode === "absent")) {
      const opposite = eventCode === "arrive" ? "absent" : "arrive";
      await client.query(upsert, [id, date, opposite, false, actor]);
    }
    return mapAttendanceEvent(result.rows[0]);
  });
}

export async function clearAttendanceDate(pool, {
  id,
  branchCode,
  groupCode,
  date,
}) {
  await assertStudentScope(pool, { id, branchCode, groupCode });
  const result = await pool.query(
    "delete from attendance_events where student_id = $1 and attendance_date = $2",
    [id, date],
  );
  return { cleared: result.rowCount };
}

export async function getGroupSummary(pool, {
  branchCode,
  groupCode,
  date,
}) {
  const result = await pool.query(
    `select s.id as student_id, ae.event_code
     from students s
     left join attendance_events ae
       on ae.student_id = s.id
      and ae.attendance_date = $3
      and ae.is_active = true
      and ae.event_code in ('arrive', 'absent', 'koko')
     where s.branch_code = $1
       and s.group_code = $2
       and s.status = 'active'
     order by s.id`,
    [branchCode, groupCode, date],
  );

  const eventsByStudent = new Map();
  for (const row of result.rows) {
    if (!eventsByStudent.has(row.student_id)) {
      eventsByStudent.set(row.student_id, new Set());
    }
    if (row.event_code) eventsByStudent.get(row.student_id).add(row.event_code);
  }

  let arrived = 0;
  let absent = 0;
  let koko = 0;
  let notArrived = 0;
  let unmarked = 0;
  for (const events of eventsByStudent.values()) {
    if (events.has("arrive")) arrived += 1;
    if (events.has("absent")) absent += 1;
    if (events.has("koko")) koko += 1;
    if (!events.has("arrive") && !events.has("absent")) notArrived += 1;
    if (
      !events.has("arrive") &&
      !events.has("absent") &&
      !events.has("koko")
    ) {
      unmarked += 1;
    }
  }

  return {
    expected: eventsByStudent.size,
    arrived,
    notArrived,
    absent,
    koko,
    unmarked,
  };
}
