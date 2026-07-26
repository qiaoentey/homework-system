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
    requestHeaders["X-Branch-Code"] = branchCode;
    requestHeaders["X-Group-Code"] = groupCode;
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
  googleLogin: (credential) => apiRequest("/api/session/google", {
    method: "POST",
    body: { credential },
  }),
  emergencyLogin: (password) => apiRequest("/api/session/emergency", {
    method: "POST",
    body: { password },
  }),
  logout: () => apiRequest("/api/session", { method: "DELETE" }),
  catalog: () => apiRequest("/api/catalog"),
};
