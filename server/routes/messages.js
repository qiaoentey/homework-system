import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../auth/session.js";
import { BRANCHES, GROUPS } from "../domain/catalog.js";
import {
  createStudentMessage,
  listStudentMessages,
  MessageRepositoryError,
} from "../repositories/messages.js";

const branchSchema = z.enum(BRANCHES.map((branch) => branch.code));
const groupSchema = z.enum(GROUPS.map((group) => group.code));
const uuidSchema = z.uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const createSchema = z.object({
  date: dateSchema,
  body: z.string().trim().min(1).max(2000),
}).strict();

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
    branchCode: request.get("X-Branch-Code"),
    groupCode: request.get("X-Group-Code"),
  });
  if (!parsed.success) return { error: "WRITE_CONTEXT_REQUIRED" };
  if (!validateGroupBranch(parsed.data.branchCode, parsed.data.groupCode)) {
    return { error: "GROUP_BRANCH_MISMATCH" };
  }
  return { value: parsed.data };
}

function parseTarget(request, response) {
  const id = uuidSchema.safeParse(request.params.id);
  const context = readGroupContext(request);
  if (!id.success) {
    error(response, 400, "INVALID_STUDENT_ID", "A student UUID is required");
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
  return { id: id.data, ...context.value };
}

function sendRepositoryError(response, repositoryError) {
  if (!(repositoryError instanceof MessageRepositoryError)) return false;
  if (repositoryError.code === "STUDENT_NOT_FOUND") {
    error(response, 404, repositoryError.code, "Student not found");
  } else if (repositoryError.code === "STUDENT_OUTSIDE_GROUP") {
    error(response, 403, repositoryError.code, "Student is outside the selected group");
  } else {
    error(response, 500, "MESSAGE_FAILED", "Message operation failed");
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

export function createMessagesRouter({ pool }) {
  const router = Router();

  router.get("/students/:id/messages", requireSession, route(async (request, response) => {
    const target = parseTarget(request, response);
    if (!target) return;
    response.json(await listStudentMessages(pool, target));
  }));

  router.post("/students/:id/messages", requireSession, route(async (request, response) => {
    const target = parseTarget(request, response);
    const body = createSchema.safeParse(request.body);
    if (!target) return;
    if (!body.success) {
      return error(response, 400, "INVALID_MESSAGE", "Message body and date are required");
    }
    return response.status(201).json(await createStudentMessage(pool, {
      ...target,
      ...body.data,
      actor: request.user.email,
    }));
  }));

  return router;
}
