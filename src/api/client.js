export class ApiError extends Error {
  constructor({ status, code, message }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function normalizedError(status, payload) {
  return new ApiError({
    status,
    code: typeof payload?.code === "string" ? payload.code : `HTTP_${status}`,
    message: typeof payload?.message === "string"
      ? payload.message
      : typeof payload?.error === "string"
        ? payload.error
        : "Request failed",
  });
}

async function readPayload(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function browserSafeHeader(value) {
  return /^[\u0000-\u00ff]*$/u.test(value) ? value : encodeURIComponent(value);
}

export async function apiRequest(path, {
  method = "GET",
  body,
  headers = {},
  branchCode,
  groupCode,
} = {}) {
  if ((branchCode && !groupCode) || (!branchCode && groupCode)) {
    throw new ApiError({
      status: 0,
      code: "INVALID_SCOPE",
      message: "Branch and group must be selected together",
    });
  }

  const requestHeaders = { ...headers };
  if (body !== undefined) requestHeaders["Content-Type"] = "application/json";
  if (branchCode && groupCode) {
    requestHeaders["X-Branch-Code"] = browserSafeHeader(branchCode);
    requestHeaders["X-Group-Code"] = browserSafeHeader(groupCode);
  }

  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: requestHeaders,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (cause) {
    throw new ApiError({
      status: 0,
      code: "NETWORK_ERROR",
      message: "Unable to reach the server",
    }, { cause });
  }

  const payload = await readPayload(response);
  if (!response.ok) throw normalizedError(response.status, payload);
  return payload;
}

export const sessionApi = {
  current: () => apiRequest("/api/session"),
  googleConfig: () => apiRequest("/api/session/config"),
  googleLogin: (credential) => apiRequest("/api/session/google", {
    method: "POST",
    body: { credential },
  }),
  logout: () => apiRequest("/api/session", { method: "DELETE" }),
  catalog: () => apiRequest("/api/catalog"),
};

function queryPath(path, parameters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }
  return `${path}?${query.toString()}`;
}

export const rosterApi = {
  students: ({ branchCode, groupCode, search = "", cursor, limit = 50 }) => apiRequest(
    queryPath("/api/students", {
      branch: branchCode,
      group: groupCode,
      status: "active",
      search,
      cursor,
      limit,
    }),
    { branchCode, groupCode },
  ),
  attendance: ({ branchCode, groupCode, date }) => apiRequest(
    queryPath("/api/attendance", {
      branch: branchCode,
      group: groupCode,
      date,
    }),
    { branchCode, groupCode },
  ),
  attendanceRecords: ({ branchCode, groupCode, date }) => apiRequest(
    queryPath("/api/attendance-records", {
      branch: branchCode,
      group: groupCode,
      date,
    }),
    { branchCode, groupCode },
  ),
  summary: ({ branchCode, groupCode, date }) => apiRequest(
    queryPath("/api/summary", {
      branch: branchCode,
      group: groupCode,
      date,
    }),
    { branchCode, groupCode },
  ),
  setAttendance: ({
    branchCode,
    groupCode,
    studentId,
    date,
    eventCode,
    active,
  }) => apiRequest(
    `/api/students/${encodeURIComponent(studentId)}/attendance/${date}/${eventCode}`,
    {
      method: "PUT",
      body: { active },
      branchCode,
      groupCode,
    },
  ),
  clearAttendance: ({ branchCode, groupCode, studentId, date }) => apiRequest(
    `/api/students/${encodeURIComponent(studentId)}/attendance/${date}`,
    {
      method: "DELETE",
      branchCode,
      groupCode,
    },
  ),
  saveProfile: ({ branchCode, groupCode, studentId, updatedAt, grade, profile }) => apiRequest(
    `/api/students/${encodeURIComponent(studentId)}/profile`,
    {
      method: "PATCH",
      body: { updatedAt, grade, profile },
      branchCode,
      groupCode,
    },
  ),
  messages: ({ branchCode, groupCode, studentId }) => apiRequest(
    `/api/students/${encodeURIComponent(studentId)}/messages`,
    { branchCode, groupCode },
  ),
  createMessage: ({ branchCode, groupCode, studentId, date, body }) => apiRequest(
    `/api/students/${encodeURIComponent(studentId)}/messages`,
    {
      method: "POST",
      body: { date, body },
      branchCode,
      groupCode,
    },
  ),
  findStudents: ({
    branchCode,
    groupCode,
    status,
    search = "",
    cursor,
    limit = 50,
  }) => apiRequest(
    queryPath("/api/students", {
      branch: branchCode,
      group: groupCode,
      status,
      search,
      cursor,
      limit,
    }),
    { branchCode, groupCode },
  ),
  enrolStudent: ({
    branchCode,
    groupCode,
    name,
    grade,
    profile,
    enrolmentKey,
  }) => apiRequest(
    "/api/students",
    {
      method: "POST",
      body: { name, grade, branchCode, groupCode, profile, enrolmentKey },
      branchCode,
      groupCode,
    },
  ),
  stopStudent: ({
    branchCode,
    groupCode,
    studentId,
    name,
    grade,
  }) => apiRequest(
    `/api/students/${encodeURIComponent(studentId)}/stop`,
    {
      method: "POST",
      body: { name, grade, groupCode },
      branchCode,
      groupCode,
    },
  ),
  restoreStudent: ({ branchCode, groupCode, studentId }) => apiRequest(
    `/api/students/${encodeURIComponent(studentId)}/restore`,
    {
      method: "POST",
      body: {},
      branchCode,
      groupCode,
    },
  ),
};
