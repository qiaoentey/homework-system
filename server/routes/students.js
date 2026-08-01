import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../auth/session.js";
import { BRANCHES, GROUPS } from "../domain/catalog.js";
import { PROFILE_FIELDS } from "../domain/profile.js";
import { decodeHeaderValue } from "../http/headers.js";
import {
  enrolStudent,
  listStudents,
  restoreStudent,
  stopStudent,
  StudentRepositoryError,
  updateStudentProfile,
} from "../repositories/students.js";

const branchCodes = BRANCHES.map((branch) => branch.code);
const groupCodes = GROUPS.map((group) => group.code);
const branchSchema = z.enum(branchCodes);
const groupSchema = z.enum(groupCodes);
const uuidSchema = z.uuid();
const trimmedRequired = z.string().trim().min(1);
const fullProfileSchema = z.object(Object.fromEntries(
  PROFILE_FIELDS.map((field) => [field, z.string()]),
)).strict();
const partialProfileSchema = fullProfileSchema.partial();

const listSchema = z.object({
  branch: branchSchema,
  group: groupSchema,
  status: z.enum(["active", "stopped"]).default("active"),
  search: z.string().trim().max(200).optional().default(""),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional().default(50)
    .transform((limit) => Math.min(limit, 50)),
}).strict();

const enrolSchema = z.object({
  name: trimmedRequired,
  grade: trimmedRequired,
  branchCode: branchSchema,
  groupCode: groupSchema,
  profile: fullProfileSchema,
  enrolmentKey: uuidSchema,
}).strict();

const stopSchema = z.object({
  name: trimmedRequired,
  grade: trimmedRequired,
  groupCode: groupSchema,
}).strict();

const profileUpdateSchema = z.object({
  updatedAt: z.string().datetime({ offset: true }),
  profile: partialProfileSchema.refine((profile) => Object.keys(profile).length > 0),
}).strict();

function error(response, status, code, message) {
  return response.status(status).json({ code, error: message });
}

function validateGroupBranch(branchCode, groupCode) {
  return GROUPS.some((group) => group.branch === branchCode && group.code === groupCode);
}

function parseCursor(value) {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const parsed = z.object({
      name: z.string(),
      id: uuidSchema,
    }).strict().safeParse(decoded);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function readWriteContext(request) {
  const parsed = z.object({
    branchCode: branchSchema,
    groupCode: groupSchema,
  }).safeParse({
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
  if (!(repositoryError instanceof StudentRepositoryError)) return false;

  const errors = {
    ENROLMENT_KEY_CONFLICT: [409, "Enrolment key belongs to another student"],
    STUDENT_NOT_FOUND: [404, "Student not found"],
    IDENTITY_MISMATCH: [409, "Student identity confirmation does not match"],
    INVALID_STATUS: [409, "Student status does not allow this operation"],
    STUDENT_CHANGED: [409, "Student changed since it was loaded"],
  };
  const [status, message] = errors[repositoryError.code] ?? [500, "Student operation failed"];
  error(response, status, repositoryError.code, message);
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

export function createStudentsRouter({ pool }) {
  const router = Router();
  router.use(requireSession);

  router.get("/", route(async (request, response) => {
    const parsed = listSchema.safeParse(request.query);
    if (!parsed.success) {
      return error(response, 400, "INVALID_STUDENT_QUERY", "Invalid student query");
    }
    if (!validateGroupBranch(parsed.data.branch, parsed.data.group)) {
      return error(response, 400, "GROUP_BRANCH_MISMATCH", "Group does not belong to branch");
    }
    const cursor = parseCursor(parsed.data.cursor);
    if (parsed.data.cursor && !cursor) {
      return error(response, 400, "INVALID_CURSOR", "Invalid student cursor");
    }

    return response.json(await listStudents(pool, {
      branchCode: parsed.data.branch,
      groupCode: parsed.data.group,
      status: parsed.data.status,
      search: parsed.data.search,
      cursor,
      limit: parsed.data.limit,
    }));
  }));

  router.post("/", route(async (request, response) => {
    const context = readWriteContext(request);
    if (context.error === "GROUP_BRANCH_MISMATCH") {
      return error(response, 400, context.error, "Group does not belong to branch");
    }
    if (context.error) {
      return error(response, 400, context.error, "Branch and group headers are required");
    }

    const parsed = enrolSchema.safeParse(request.body);
    if (!parsed.success) {
      return error(response, 400, "INVALID_STUDENT", "Invalid student");
    }
    if (!validateGroupBranch(parsed.data.branchCode, parsed.data.groupCode)) {
      return error(response, 400, "GROUP_BRANCH_MISMATCH", "Group does not belong to branch");
    }
    if (
      parsed.data.branchCode !== context.value.branchCode ||
      parsed.data.groupCode !== context.value.groupCode
    ) {
      return error(response, 400, "WRITE_CONTEXT_MISMATCH", "Student does not match write context");
    }

    const result = await enrolStudent(pool, {
      ...parsed.data,
      actor: request.user.email,
    });
    return response.status(result.created ? 201 : 200).json(result.student);
  }));

  router.post("/:id/stop", route(async (request, response) => {
    const id = uuidSchema.safeParse(request.params.id);
    const context = readWriteContext(request);
    const parsed = stopSchema.safeParse(request.body);
    if (!id.success || !parsed.success) {
      return error(response, 400, "INVALID_STOP_REQUEST", "Invalid stop request");
    }
    if (context.error === "GROUP_BRANCH_MISMATCH") {
      return error(response, 400, context.error, "Group does not belong to branch");
    }
    if (context.error) {
      return error(response, 400, context.error, "Branch and group headers are required");
    }
    if (parsed.data.groupCode !== context.value.groupCode) {
      return error(response, 400, "WRITE_CONTEXT_MISMATCH", "Student does not match write context");
    }

    return response.json(await stopStudent(pool, {
      id: id.data,
      branchCode: context.value.branchCode,
      groupCode: context.value.groupCode,
      name: parsed.data.name,
      grade: parsed.data.grade,
      confirmedGroupCode: parsed.data.groupCode,
      actor: request.user.email,
    }));
  }));

  router.post("/:id/restore", route(async (request, response) => {
    const id = uuidSchema.safeParse(request.params.id);
    const context = readWriteContext(request);
    if (!id.success) {
      return error(response, 400, "INVALID_STUDENT_ID", "A student UUID is required");
    }
    if (context.error === "GROUP_BRANCH_MISMATCH") {
      return error(response, 400, context.error, "Group does not belong to branch");
    }
    if (context.error) {
      return error(response, 400, context.error, "Branch and group headers are required");
    }

    return response.json(await restoreStudent(pool, {
      id: id.data,
      ...context.value,
      actor: request.user.email,
    }));
  }));

  router.patch("/:id/profile", route(async (request, response) => {
    const id = uuidSchema.safeParse(request.params.id);
    const context = readWriteContext(request);
    const parsed = profileUpdateSchema.safeParse(request.body);
    if (!id.success) {
      return error(response, 400, "INVALID_STUDENT_ID", "A student UUID is required");
    }
    if (!parsed.success) {
      return error(response, 400, "INVALID_PROFILE", "Invalid student profile");
    }
    if (context.error === "GROUP_BRANCH_MISMATCH") {
      return error(response, 400, context.error, "Group does not belong to branch");
    }
    if (context.error) {
      return error(response, 400, context.error, "Branch and group headers are required");
    }

    return response.json(await updateStudentProfile(pool, {
      id: id.data,
      ...context.value,
      ...parsed.data,
      actor: request.user.email,
    }));
  }));

  return router;
}
