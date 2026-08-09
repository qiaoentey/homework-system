import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../auth/session.js";
import { ATTENDANCE_EVENTS } from "../domain/attendance.js";
import { BRANCHES, GROUPS } from "../domain/catalog.js";
import { decodeHeaderValue } from "../http/headers.js";
import {
  AttendanceRepositoryError,
  clearAttendanceDate,
  getDailyDashboard,
  getAttendanceRecord,
  getGroupSummary,
  listAttendance,
  upsertAttendanceEvent,
} from "../repositories/attendance.js";

const branchSchema = z.enum(BRANCHES.map((branch) => branch.code));
const groupSchema = z.enum(GROUPS.map((group) => group.code));
const eventSchema = z.enum(ATTENDANCE_EVENTS);
const uuidSchema = z.uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const groupDateSchema = z.object({
  branch: branchSchema,
  group: groupSchema,
  date: dateSchema,
}).strict();
const dashboardDateSchema = z.object({ date: dateSchema }).strict();
const updateSchema = z.object({ active: z.boolean() }).strict();

function error(response, status, code, message) {
  return response.status(status).json({ code, error: message });
}

function validateGroupBranch(branchCode, groupCode) {
  return GROUPS.some((group) => group.branch === branchCode && group.code === groupCode);
}

function readGroupContext(request) {
  const parsed = z.object({
    branchCode: branchSchema,
    groupCode: groupSchema,
  }).strict().safeParse({
    branchCode: decodeHeaderValue(request.get("X-Branch-Code")),
    groupCode: decodeHeaderValue(request.get("X-Group-Code")),
  });
  if (!parsed.success) return { error: "WRITE_CONTEXT_REQUIRED" };
  if (!validateGroupBranch(parsed.data.branchCode, parsed.data.groupCode)) {
    return { error: "GROUP_BRANCH_MISMATCH" };
  }
  return { value: parsed.data };
}

function sendRepositoryError(response, repositoryError) {
  if (!(repositoryError instanceof AttendanceRepositoryError)) return false;
  if (repositoryError.code === "STUDENT_NOT_FOUND") {
    error(response, 404, repositoryError.code, "Student not found");
  } else if (repositoryError.code === "STUDENT_OUTSIDE_GROUP") {
    error(response, 403, repositoryError.code, "Student is outside the selected group");
  } else {
    error(response, 500, "ATTENDANCE_FAILED", "Attendance operation failed");
  }
  return true;
}

function route(handler) {
  return async (request, response, next) => {
    try {
      await handler(request, response);
    } catch (repositoryError) {
      if (!sendRepositoryError(response, repositoryError)) next(repositoryError);
    }
  };
}

function parseGroupDate(request, response, errorCode) {
  const parsed = groupDateSchema.safeParse(request.query);
  if (!parsed.success) {
    error(response, 400, errorCode, "Invalid branch, group, or date");
    return null;
  }
  if (!validateGroupBranch(parsed.data.branch, parsed.data.group)) {
    error(response, 400, "GROUP_BRANCH_MISMATCH", "Group does not belong to branch");
    return null;
  }
  return parsed.data;
}

function parseStudentContext(request, response) {
  const id = uuidSchema.safeParse(request.params.id);
  const date = dateSchema.safeParse(request.params.date);
  const context = readGroupContext(request);
  if (!id.success || !date.success) {
    error(response, 400, "INVALID_ATTENDANCE_TARGET", "Invalid student UUID or date");
    return null;
  }
  if (context.error === "GROUP_BRANCH_MISMATCH") {
    error(response, 400, context.error, "Group does not belong to branch");
    return null;
  }
  if (context.error) {
    error(response, 400, context.error, "Branch and group headers are required");
    return null;
  }
  return { id: id.data, date: date.data, ...context.value };
}

export function createAttendanceRouter({ pool }) {
  const router = Router();

  router.get("/attendance", requireSession, route(async (request, response) => {
    const parsed = parseGroupDate(request, response, "INVALID_ATTENDANCE_QUERY");
    if (!parsed) return;
    response.json(await listAttendance(pool, {
      branchCode: parsed.branch,
      groupCode: parsed.group,
      date: parsed.date,
    }));
  }));

  router.get("/attendance-records", requireSession, route(async (request, response) => {
    const parsed = parseGroupDate(request, response, "INVALID_ATTENDANCE_RECORD_QUERY");
    if (!parsed) return;
    response.json(await getAttendanceRecord(pool, {
      branchCode: parsed.branch,
      groupCode: parsed.group,
      date: parsed.date,
    }));
  }));

  router.get("/summary", requireSession, route(async (request, response) => {
    const parsed = parseGroupDate(request, response, "INVALID_SUMMARY_QUERY");
    if (!parsed) return;
    response.json(await getGroupSummary(pool, {
      branchCode: parsed.branch,
      groupCode: parsed.group,
      date: parsed.date,
    }));
  }));

  router.get("/dashboard", requireSession, route(async (request, response) => {
    const parsed = dashboardDateSchema.safeParse(request.query);
    if (!parsed.success) {
      error(response, 400, "INVALID_DASHBOARD_QUERY", "Invalid dashboard date");
      return;
    }
    response.json(await getDailyDashboard(pool, parsed.data));
  }));

  router.put(
    "/students/:id/attendance/:date/:eventCode",
    requireSession,
    route(async (request, response) => {
      const target = parseStudentContext(request, response);
      const eventCode = eventSchema.safeParse(request.params.eventCode);
      const body = updateSchema.safeParse(request.body);
      if (!target) return;
      if (!eventCode.success || !body.success) {
        return error(response, 400, "INVALID_ATTENDANCE_EVENT", "Invalid attendance event");
      }
      return response.json(await upsertAttendanceEvent(pool, {
        ...target,
        eventCode: eventCode.data,
        active: body.data.active,
        actor: request.user.email,
      }));
    }),
  );

  router.delete(
    "/students/:id/attendance/:date",
    requireSession,
    route(async (request, response) => {
      const target = parseStudentContext(request, response);
      if (!target) return;
      return response.json(await clearAttendanceDate(pool, target));
    }),
  );

  return router;
}
