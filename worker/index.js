const LOCAL_OPERATOR_EMAIL = "sites-owner@private.local";
const BRANCHES = [
  { code: "MK", label: "MK" },
  { code: "STP", label: "STP" },
  { code: "WS", label: "WS" },
];
const GROUPS = [
  { code: "MK HAPPY", branch: "MK", label: "HAPPY" },
  { code: "MK QIAO EN", branch: "MK", label: "QIAO EN" },
  { code: "MK WEN XUAN", branch: "MK", label: "WEN XUAN" },
  { code: "巧恩 STP", branch: "STP", label: "巧恩" },
  { code: "PS STP", branch: "STP", label: "PS" },
  { code: "SY STP", branch: "STP", label: "SY" },
  { code: "WS HUILING", branch: "WS", label: "HUILING" },
  { code: "WS JIA WEN", branch: "WS", label: "JIA WEN" },
  { code: "WS MIXIN", branch: "WS", label: "MIXIN" },
];
const PROFILE_FIELDS = [
  "school",
  "schoolClass",
  "usualPickupTime",
  "pickupMethod",
  "lateStayMonday",
  "lateStayTuesday",
  "lateStayWednesday",
  "lateStayThursday",
  "lateStayFriday",
];
const ATTENDANCE_EVENTS = new Set([
  "pickup",
  "arrive",
  "shower",
  "meal",
  "homework",
  "supplement",
  "review",
  "home",
  "absent",
  "koko",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function empty(status = 204) {
  return new Response(null, { status });
}

function apiError(status, code, message) {
  return json({ code, error: message }, status);
}

function operator(request) {
  return {
    email: request.headers.get("oai-authenticated-user-email")?.trim()
      || LOCAL_OPERATOR_EMAIL,
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, allowed, required = allowed) {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key))
    && keys.every((key) => allowed.includes(key));
}

function isNonemptyString(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function validGroup(branchCode, groupCode) {
  return GROUPS.some(({ branch, code }) => branch === branchCode && code === groupCode);
}

function validDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validIsoDate(value) {
  return typeof value === "string"
    && /(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
    && !Number.isNaN(Date.parse(value));
}

function readContext(request) {
  const branchCode = request.headers.get("X-Branch-Code");
  const groupCode = request.headers.get("X-Group-Code");
  if (!BRANCHES.some(({ code }) => code === branchCode) || !GROUPS.some(({ code }) => code === groupCode)) {
    return { error: "WRITE_CONTEXT_REQUIRED" };
  }
  if (!validGroup(branchCode, groupCode)) return { error: "GROUP_BRANCH_MISMATCH" };
  return { branchCode, groupCode };
}

function contextError(context) {
  if (context.error === "GROUP_BRANCH_MISMATCH") {
    return apiError(400, context.error, "Group does not belong to branch");
  }
  if (context.error) {
    return apiError(400, context.error, "Branch and group headers are required");
  }
  return null;
}

async function requestBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function all(database, sql, values = []) {
  const result = await database.prepare(sql).bind(...values).all();
  return result.results ?? [];
}

async function first(database, sql, values = []) {
  return database.prepare(sql).bind(...values).first();
}

async function run(database, sql, values = []) {
  return database.prepare(sql).bind(...values).run();
}

function parseProfile(value) {
  if (isRecord(value)) return value;
  try {
    const profile = JSON.parse(value);
    return isRecord(profile) ? profile : {};
  } catch {
    return {};
  }
}

function mapStudent(row) {
  return {
    id: row.id,
    name: row.name,
    grade: row.grade,
    branchCode: row.branch_code,
    groupCode: row.group_code,
    status: row.status,
    profile: parseProfile(row.profile),
    updatedAt: row.updated_at,
  };
}

function mapAttendance(row) {
  return {
    studentId: row.student_id,
    date: row.attendance_date,
    eventCode: row.event_code,
    active: Boolean(row.is_active),
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    date: row.message_date,
    body: row.body,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function encodeCursor(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function parseCursor(value) {
  if (!value) return null;
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const decoded = JSON.parse(new TextDecoder().decode(bytes));
    if (
      !hasOnlyKeys(decoded, ["name", "id"])
      || typeof decoded.name !== "string"
      || !UUID_PATTERN.test(decoded.id)
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function escapeLike(value) {
  return value.replace(/[\\%_]/gu, "\\$&");
}

function timestampAfter(previous) {
  return new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString();
}

function fullProfile(value) {
  return hasOnlyKeys(value, PROFILE_FIELDS)
    && PROFILE_FIELDS.every((field) => typeof value[field] === "string");
}

function matchesEnrolmentPayload(student, body) {
  const profile = parseProfile(student.profile);
  return student.name === body.name.trim()
    && student.grade === body.grade.trim()
    && student.branch_code === body.branchCode
    && student.group_code === body.groupCode
    && PROFILE_FIELDS.every((field) => profile[field] === body.profile[field]);
}

function partialProfile(value) {
  return hasOnlyKeys(value, PROFILE_FIELDS, [])
    && Object.keys(value).length > 0
    && Object.values(value).every((field) => typeof field === "string");
}

async function rawStudent(database, id) {
  return first(
    database,
    `SELECT id, name, grade, branch_code, group_code, status, profile, updated_at
     FROM students
     WHERE id = ?`,
    [id],
  );
}

async function scopedStudent(database, id, branchCode, groupCode, outsideStatus = 404) {
  const student = await rawStudent(database, id);
  if (!student) {
    return { response: apiError(404, "STUDENT_NOT_FOUND", "Student not found") };
  }
  if (student.branch_code !== branchCode || student.group_code !== groupCode) {
    return {
      response: outsideStatus === 403
        ? apiError(403, "STUDENT_OUTSIDE_GROUP", "Student is outside the selected group")
        : apiError(404, "STUDENT_NOT_FOUND", "Student not found"),
    };
  }
  return { student };
}

function catalogResponse() {
  return {
    branches: BRANCHES.map((branch) => ({
      ...branch,
      groups: GROUPS
        .filter((group) => group.branch === branch.code)
        .map(({ code, label }) => ({ code, label })),
    })),
  };
}

async function listStudents(request, database, url) {
  const allowed = new Set(["branch", "group", "status", "search", "cursor", "limit"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return apiError(400, "INVALID_STUDENT_QUERY", "Invalid student query");
  }

  const branchCode = url.searchParams.get("branch");
  const groupCode = url.searchParams.get("group");
  const status = url.searchParams.get("status") || "active";
  const search = (url.searchParams.get("search") || "").trim();
  const cursorValue = url.searchParams.get("cursor");
  const rawLimit = url.searchParams.get("limit") || "50";
  const limitValue = Number(rawLimit);
  if (
    !BRANCHES.some(({ code }) => code === branchCode)
    || !GROUPS.some(({ code }) => code === groupCode)
    || !["active", "stopped"].includes(status)
    || search.length > 200
    || !Number.isInteger(limitValue)
    || limitValue <= 0
  ) {
    return apiError(400, "INVALID_STUDENT_QUERY", "Invalid student query");
  }
  if (!validGroup(branchCode, groupCode)) {
    return apiError(400, "GROUP_BRANCH_MISMATCH", "Group does not belong to branch");
  }
  const cursor = parseCursor(cursorValue);
  if (cursorValue && !cursor) return apiError(400, "INVALID_CURSOR", "Invalid student cursor");
  const limit = Math.min(limitValue, 50);

  const conditions = ["branch_code = ?", "group_code = ?", "status = ?"];
  const values = [branchCode, groupCode, status];
  if (search) {
    conditions.push("lower(name) LIKE ? ESCAPE '\\'");
    values.push(`%${escapeLike(search.toLowerCase())}%`);
  }
  const count = await first(
    database,
    `SELECT count(*) AS total FROM students WHERE ${conditions.join(" AND ")}`,
    values,
  );
  if (cursor) {
    conditions.push("(lower(name) > ? OR (lower(name) = ? AND id > ?))");
    values.push(cursor.name, cursor.name, cursor.id);
  }
  const rows = await all(
    database,
    `SELECT id, name, grade, branch_code, group_code, status, profile, updated_at,
            lower(name) AS sort_name
     FROM students
     WHERE ${conditions.join(" AND ")}
     ORDER BY lower(name), id
     LIMIT ?`,
    [...values, limit + 1],
  );
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return json({
    items: page.map(mapStudent),
    nextCursor: hasMore
      ? encodeCursor({ name: page.at(-1).sort_name, id: page.at(-1).id })
      : null,
    total: Number(count.total),
  });
}

async function enrolStudent(request, database) {
  const context = readContext(request);
  const invalidContext = contextError(context);
  if (invalidContext) return invalidContext;
  const body = await requestBody(request);
  if (
    !hasOnlyKeys(body, [
      "name",
      "grade",
      "branchCode",
      "groupCode",
      "profile",
      "enrolmentKey",
    ])
    || !isNonemptyString(body.name)
    || !isNonemptyString(body.grade)
    || !BRANCHES.some(({ code }) => code === body.branchCode)
    || !GROUPS.some(({ code }) => code === body.groupCode)
    || !fullProfile(body.profile)
    || !UUID_PATTERN.test(body.enrolmentKey)
  ) {
    return apiError(400, "INVALID_STUDENT", "Invalid student");
  }
  if (!validGroup(body.branchCode, body.groupCode)) {
    return apiError(400, "GROUP_BRANCH_MISMATCH", "Group does not belong to branch");
  }
  if (body.branchCode !== context.branchCode || body.groupCode !== context.groupCode) {
    return apiError(400, "WRITE_CONTEXT_MISMATCH", "Student does not match write context");
  }

  const id = crypto.randomUUID();
  const activityId = crypto.randomUUID();
  const now = new Date().toISOString();
  const results = await database.batch([
    database.prepare(
      `INSERT INTO students
         (id, name, grade, branch_code, group_code, status, profile,
          enrolment_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
       ON CONFLICT (enrolment_key) DO NOTHING`,
    ).bind(
        id,
        body.name.trim(),
        body.grade.trim(),
        body.branchCode,
        body.groupCode,
        JSON.stringify(body.profile),
        body.enrolmentKey,
        now,
        now,
      ),
    database.prepare(
      `INSERT INTO student_activity
         (id, student_id, action, actor, details, created_at)
       SELECT ?, ?, 'enrol', ?, ?, ?
       WHERE changes() = 1`,
    ).bind(
      activityId,
      id,
      operator(request).email,
      JSON.stringify({
        branchCode: body.branchCode,
        groupCode: body.groupCode,
        enrolmentKey: body.enrolmentKey,
      }),
      now,
    ),
  ]);
  const created = Number(results[0]?.meta?.changes ?? 0) === 1;
  const student = await first(
    database,
    `SELECT id, name, grade, branch_code, group_code, status, profile, updated_at
     FROM students
     WHERE enrolment_key = ?`,
    [body.enrolmentKey],
  );
  if (!student) {
    return apiError(409, "ENROLMENT_KEY_CONFLICT", "Enrolment key could not be resolved");
  }
  if (!matchesEnrolmentPayload(student, body)) {
    return apiError(409, "ENROLMENT_KEY_CONFLICT", "Enrolment key belongs to another student");
  }
  return json(mapStudent(student), created ? 201 : 200);
}

async function stopStudent(request, database, id) {
  if (!UUID_PATTERN.test(id)) return apiError(400, "INVALID_STOP_REQUEST", "Invalid stop request");
  const context = readContext(request);
  const invalidContext = contextError(context);
  const body = await requestBody(request);
  if (
    !hasOnlyKeys(body, ["name", "grade", "groupCode"])
    || !isNonemptyString(body.name)
    || !isNonemptyString(body.grade)
    || !GROUPS.some(({ code }) => code === body.groupCode)
  ) {
    return apiError(400, "INVALID_STOP_REQUEST", "Invalid stop request");
  }
  if (invalidContext) return invalidContext;
  if (body.groupCode !== context.groupCode) {
    return apiError(400, "WRITE_CONTEXT_MISMATCH", "Student does not match write context");
  }
  const scoped = await scopedStudent(database, id, context.branchCode, context.groupCode);
  if (scoped.response) return scoped.response;
  if (
    scoped.student.name !== body.name.trim()
    || scoped.student.grade !== body.grade.trim()
    || scoped.student.group_code !== body.groupCode
  ) {
    return apiError(409, "IDENTITY_MISMATCH", "Student identity confirmation does not match");
  }
  if (scoped.student.status !== "active") {
    return apiError(409, "INVALID_STATUS", "Student status does not allow this operation");
  }
  const updatedAt = timestampAfter(scoped.student.updated_at);
  const activityId = crypto.randomUUID();
  const now = new Date().toISOString();
  const results = await database.batch([
    database.prepare(
      `UPDATE students
       SET status = 'stopped', updated_at = ?
       WHERE id = ?
         AND branch_code = ?
         AND group_code = ?
         AND status = 'active'
         AND name = ?
         AND grade = ?`,
    ).bind(
      updatedAt,
      id,
      context.branchCode,
      context.groupCode,
      body.name.trim(),
      body.grade.trim(),
    ),
    database.prepare(
      `INSERT INTO student_activity
         (id, student_id, action, actor, details, created_at)
       SELECT ?, ?, 'stop', ?, ?, ?
       WHERE changes() = 1`,
    ).bind(
      activityId,
      id,
      operator(request).email,
      JSON.stringify({
        name: body.name.trim(),
        grade: body.grade.trim(),
        groupCode: body.groupCode,
      }),
      now,
    ),
  ]);
  if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
    return apiError(409, "INVALID_STATUS", "Student status does not allow this operation");
  }
  return json(mapStudent(await rawStudent(database, id)));
}

async function restoreStudent(request, database, id) {
  if (!UUID_PATTERN.test(id)) return apiError(400, "INVALID_STUDENT_ID", "A student UUID is required");
  const context = readContext(request);
  const invalidContext = contextError(context);
  if (invalidContext) return invalidContext;
  const scoped = await scopedStudent(database, id, context.branchCode, context.groupCode);
  if (scoped.response) return scoped.response;
  if (scoped.student.status !== "stopped") {
    return apiError(409, "INVALID_STATUS", "Student status does not allow this operation");
  }
  const activityId = crypto.randomUUID();
  const now = new Date().toISOString();
  const results = await database.batch([
    database.prepare(
      `UPDATE students
       SET status = 'active', updated_at = ?
       WHERE id = ?
         AND branch_code = ?
         AND group_code = ?
         AND status = 'stopped'`,
    ).bind(
      timestampAfter(scoped.student.updated_at),
      id,
      context.branchCode,
      context.groupCode,
    ),
    database.prepare(
      `INSERT INTO student_activity
         (id, student_id, action, actor, details, created_at)
       SELECT ?, ?, 'restore', ?, '{}', ?
       WHERE changes() = 1`,
    ).bind(activityId, id, operator(request).email, now),
  ]);
  if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
    return apiError(409, "INVALID_STATUS", "Student status does not allow this operation");
  }
  return json(mapStudent(await rawStudent(database, id)));
}

async function updateProfile(request, database, id) {
  if (!UUID_PATTERN.test(id)) return apiError(400, "INVALID_STUDENT_ID", "A student UUID is required");
  const context = readContext(request);
  const invalidContext = contextError(context);
  const body = await requestBody(request);
  if (
    !hasOnlyKeys(body, ["updatedAt", "profile"])
    || !validIsoDate(body.updatedAt)
    || !partialProfile(body.profile)
  ) {
    return apiError(400, "INVALID_PROFILE", "Invalid student profile");
  }
  if (invalidContext) return invalidContext;
  const scoped = await scopedStudent(database, id, context.branchCode, context.groupCode);
  if (scoped.response) return scoped.response;
  const activityId = crypto.randomUUID();
  const now = new Date().toISOString();
  const results = await database.batch([
    database.prepare(
      `UPDATE students
       SET profile = ?, updated_at = ?
       WHERE id = ?
         AND branch_code = ?
         AND group_code = ?
         AND updated_at = ?`,
    ).bind(
      JSON.stringify({ ...parseProfile(scoped.student.profile), ...body.profile }),
      timestampAfter(scoped.student.updated_at),
      id,
      context.branchCode,
      context.groupCode,
      new Date(body.updatedAt).toISOString(),
    ),
    database.prepare(
      `INSERT INTO student_activity
         (id, student_id, action, actor, details, created_at)
       SELECT ?, ?, 'profile_update', ?, ?, ?
       WHERE changes() = 1`,
    ).bind(
      activityId,
      id,
      operator(request).email,
      JSON.stringify({ profile: body.profile }),
      now,
    ),
  ]);
  if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
    return apiError(409, "STUDENT_CHANGED", "Student changed since it was loaded");
  }
  return json(mapStudent(await rawStudent(database, id)));
}

async function attendanceList(database, url) {
  const branchCode = url.searchParams.get("branch");
  const groupCode = url.searchParams.get("group");
  const date = url.searchParams.get("date");
  if (
    [...url.searchParams.keys()].some((key) => !["branch", "group", "date"].includes(key))
    || !BRANCHES.some(({ code }) => code === branchCode)
    || !GROUPS.some(({ code }) => code === groupCode)
    || !validDate(date)
  ) {
    return apiError(400, "INVALID_ATTENDANCE_QUERY", "Invalid branch, group, or date");
  }
  if (!validGroup(branchCode, groupCode)) {
    return apiError(400, "GROUP_BRANCH_MISMATCH", "Group does not belong to branch");
  }
  const rows = await all(
    database,
    `SELECT ae.student_id, ae.attendance_date, ae.event_code, ae.is_active,
            ae.updated_by, ae.updated_at
     FROM attendance_events ae
     JOIN students s ON s.id = ae.student_id
     WHERE s.branch_code = ?
       AND s.group_code = ?
       AND s.status = 'active'
       AND ae.attendance_date = ?
     ORDER BY ae.student_id, ae.event_code`,
    [branchCode, groupCode, date],
  );
  return json({ items: rows.map(mapAttendance) });
}

async function summary(database, url) {
  const branchCode = url.searchParams.get("branch");
  const groupCode = url.searchParams.get("group");
  const date = url.searchParams.get("date");
  if (
    [...url.searchParams.keys()].some((key) => !["branch", "group", "date"].includes(key))
    || !BRANCHES.some(({ code }) => code === branchCode)
    || !GROUPS.some(({ code }) => code === groupCode)
    || !validDate(date)
  ) {
    return apiError(400, "INVALID_SUMMARY_QUERY", "Invalid branch, group, or date");
  }
  if (!validGroup(branchCode, groupCode)) {
    return apiError(400, "GROUP_BRANCH_MISMATCH", "Group does not belong to branch");
  }
  const rows = await all(
    database,
    `SELECT s.id AS student_id, ae.event_code
     FROM students s
     LEFT JOIN attendance_events ae
       ON ae.student_id = s.id
      AND ae.attendance_date = ?
      AND ae.is_active = 1
      AND ae.event_code IN ('arrive', 'absent', 'koko')
     WHERE s.branch_code = ?
       AND s.group_code = ?
       AND s.status = 'active'
     ORDER BY s.id`,
    [date, branchCode, groupCode],
  );
  const eventsByStudent = new Map();
  for (const row of rows) {
    if (!eventsByStudent.has(row.student_id)) eventsByStudent.set(row.student_id, new Set());
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
    if (!events.has("arrive") && !events.has("absent") && !events.has("koko")) unmarked += 1;
  }
  return json({
    expected: eventsByStudent.size,
    arrived,
    notArrived,
    absent,
    koko,
    unmarked,
  });
}

async function updateAttendance(request, database, id, date, eventCode) {
  if (!UUID_PATTERN.test(id) || !validDate(date)) {
    return apiError(400, "INVALID_ATTENDANCE_TARGET", "Invalid student UUID or date");
  }
  const context = readContext(request);
  const invalidContext = contextError(context);
  if (invalidContext) return invalidContext;
  const body = await requestBody(request);
  if (
    !ATTENDANCE_EVENTS.has(eventCode)
    || !hasOnlyKeys(body, ["active"])
    || typeof body.active !== "boolean"
  ) {
    return apiError(400, "INVALID_ATTENDANCE_EVENT", "Invalid attendance event");
  }
  const scoped = await scopedStudent(database, id, context.branchCode, context.groupCode, 403);
  if (scoped.response) return scoped.response;
  const now = new Date().toISOString();
  await run(
    database,
    `INSERT INTO attendance_events
       (student_id, attendance_date, event_code, is_active, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (student_id, attendance_date, event_code)
     DO UPDATE SET
       is_active = excluded.is_active,
       updated_by = excluded.updated_by,
       updated_at = excluded.updated_at`,
    [id, date, eventCode, body.active ? 1 : 0, operator(request).email, now],
  );
  const event = await first(
    database,
    `SELECT student_id, attendance_date, event_code, is_active, updated_by, updated_at
     FROM attendance_events
     WHERE student_id = ? AND attendance_date = ? AND event_code = ?`,
    [id, date, eventCode],
  );
  return json(mapAttendance(event));
}

async function clearAttendance(request, database, id, date) {
  if (!UUID_PATTERN.test(id) || !validDate(date)) {
    return apiError(400, "INVALID_ATTENDANCE_TARGET", "Invalid student UUID or date");
  }
  const context = readContext(request);
  const invalidContext = contextError(context);
  if (invalidContext) return invalidContext;
  const scoped = await scopedStudent(database, id, context.branchCode, context.groupCode, 403);
  if (scoped.response) return scoped.response;
  const result = await run(
    database,
    "DELETE FROM attendance_events WHERE student_id = ? AND attendance_date = ?",
    [id, date],
  );
  return json({ cleared: Number(result.meta?.changes ?? 0) });
}

async function listMessages(request, database, id) {
  if (!UUID_PATTERN.test(id)) return apiError(400, "INVALID_STUDENT_ID", "A student UUID is required");
  const context = readContext(request);
  const invalidContext = contextError(context);
  if (invalidContext) return invalidContext;
  const scoped = await scopedStudent(database, id, context.branchCode, context.groupCode, 403);
  if (scoped.response) return scoped.response;
  const rows = await all(
    database,
    `SELECT id, student_id, message_date, body, created_by, created_at
     FROM student_messages
     WHERE student_id = ?
     ORDER BY message_date DESC, created_at DESC, id DESC`,
    [id],
  );
  return json({ items: rows.map(mapMessage) });
}

async function createMessage(request, database, id) {
  if (!UUID_PATTERN.test(id)) return apiError(400, "INVALID_STUDENT_ID", "A student UUID is required");
  const context = readContext(request);
  const invalidContext = contextError(context);
  if (invalidContext) return invalidContext;
  const body = await requestBody(request);
  if (
    !hasOnlyKeys(body, ["date", "body"])
    || !validDate(body.date)
    || !isNonemptyString(body.body)
    || [...body.body.trim()].length > 2000
  ) {
    return apiError(400, "INVALID_MESSAGE", "Message body and date are required");
  }
  const scoped = await scopedStudent(database, id, context.branchCode, context.groupCode, 403);
  if (scoped.response) return scoped.response;
  const messageId = crypto.randomUUID();
  const now = new Date().toISOString();
  await run(
    database,
    `INSERT INTO student_messages
       (id, student_id, message_date, body, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [messageId, id, body.date, body.body.trim(), operator(request).email, now],
  );
  const message = await first(
    database,
    `SELECT id, student_id, message_date, body, created_by, created_at
     FROM student_messages WHERE id = ?`,
    [messageId],
  );
  return json(mapMessage(message), 201);
}

async function handleApi(request, env, url) {
  const { pathname } = url;
  if (pathname === "/api/health" && request.method === "GET") return json({ ok: true });
  if (pathname === "/api/session" && request.method === "GET") return json(operator(request));
  if (pathname === "/api/session" && request.method === "DELETE") return empty();
  if (
    ["/api/session/google", "/api/session/emergency"].includes(pathname)
    && request.method === "POST"
  ) {
    return empty();
  }
  if (pathname === "/api/catalog" && request.method === "GET") return json(catalogResponse());
  const databaseRoute = ["/api/students", "/api/attendance", "/api/summary"].includes(pathname)
    || /^\/api\/students\/[^/]+\/(?:attendance|profile|messages|stop|restore)(?:\/|$)/u.test(pathname);
  if (databaseRoute && !env.DB) {
    return apiError(500, "DATABASE_UNAVAILABLE", "Database binding is unavailable");
  }

  if (pathname === "/api/students" && request.method === "GET") {
    return listStudents(request, env.DB, url);
  }
  if (pathname === "/api/students" && request.method === "POST") {
    return enrolStudent(request, env.DB);
  }
  if (pathname === "/api/attendance" && request.method === "GET") {
    return attendanceList(env.DB, url);
  }
  if (pathname === "/api/summary" && request.method === "GET") return summary(env.DB, url);

  let match = pathname.match(/^\/api\/students\/([^/]+)\/attendance\/([^/]+)\/([^/]+)$/u);
  if (match && request.method === "PUT") {
    return updateAttendance(request, env.DB, match[1], match[2], match[3]);
  }
  match = pathname.match(/^\/api\/students\/([^/]+)\/attendance\/([^/]+)$/u);
  if (match && request.method === "DELETE") {
    return clearAttendance(request, env.DB, match[1], match[2]);
  }
  match = pathname.match(/^\/api\/students\/([^/]+)\/profile$/u);
  if (match && request.method === "PATCH") return updateProfile(request, env.DB, match[1]);
  match = pathname.match(/^\/api\/students\/([^/]+)\/messages$/u);
  if (match && request.method === "GET") return listMessages(request, env.DB, match[1]);
  if (match && request.method === "POST") return createMessage(request, env.DB, match[1]);
  match = pathname.match(/^\/api\/students\/([^/]+)\/stop$/u);
  if (match && request.method === "POST") return stopStudent(request, env.DB, match[1]);
  match = pathname.match(/^\/api\/students\/([^/]+)\/restore$/u);
  if (match && request.method === "POST") return restoreStudent(request, env.DB, match[1]);

  return apiError(404, "NOT_FOUND", "API route not found");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch {
        return apiError(500, "INTERNAL_ERROR", "Request failed");
      }
    }

    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      return response;
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};
