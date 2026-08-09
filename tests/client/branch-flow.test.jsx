// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App.jsx";
import { apiRequest } from "../../src/api/client.js";
import { flowReducer, initialFlowState } from "../../src/state/flowReducer.js";

const catalog = {
  branches: [
    {
      code: "MK",
      label: "MK",
      groups: [
        { code: "MK HAPPY", label: "HAPPY" },
        { code: "MK QIAO EN", label: "QIAO EN" },
        { code: "MK WEN XUAN", label: "WEN XUAN" },
      ],
    },
    {
      code: "STP",
      label: "STP",
      groups: [
        { code: "巧恩 STP", label: "巧恩" },
        { code: "PS STP", label: "PS" },
        { code: "SY STP", label: "SY" },
        { code: "YUAN NING STP", label: "YUAN NING" },
      ],
    },
    {
      code: "WS",
      label: "WS",
      groups: [
        { code: "WS HUILING", label: "HUILING" },
        { code: "WS JIA WEN", label: "JIA WEN" },
        { code: "WS MIXIN", label: "MIXIN" },
      ],
    },
  ],
};

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    async text() {
      return body === undefined ? "" : JSON.stringify(body);
    },
  };
}

function signedInFetch() {
  return vi.fn(async (url, options = {}) => {
    if (url === "/api/session" && (options.method ?? "GET") === "GET") {
      return jsonResponse(200, { email: "teacher@example.com" });
    }
    if (url === "/api/catalog" && (options.method ?? "GET") === "GET") {
      return jsonResponse(200, catalog);
    }
    if (url.startsWith("/api/dashboard?date=")) {
      return jsonResponse(200, { date: "2026-07-27", groups: [] });
    }
    throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
  });
}

describe.each([
  { viewport: "desktop", width: 1440, height: 900 },
  { viewport: "mobile", width: 390, height: 844 },
])("branch-first entrance at $viewport width", ({ width, height }) => {
  beforeEach(() => {
    Object.defineProperties(window, {
      innerWidth: { configurable: true, value: width },
      innerHeight: { configurable: true, value: height },
    });
    vi.stubGlobal("fetch", signedInFetch());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows branches first and never mixes teacher groups", async () => {
    const { container } = render(<App />);
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;

    const brandLogo = screen.getByRole("img", { name: "诚意教育，您身边学习专家" });
    expect(brandLogo).toHaveAttribute("src", "/assets/brand-logo.png");
    expect(brandLogo).toHaveAttribute("width", "105");
    expect(brandLogo).toHaveAttribute("height", "34");
    expect(await screen.findByRole("heading", { name: "请选择分院" })).toBeVisible();
    expect(screen.getByText("进入后只显示该分院名单")).toBeVisible();
    expect(within(screen.getByRole("group", { name: "分院选择" }))
      .getAllByRole("button")
      .map((button) => button.textContent)).toEqual([
      "MK",
      "STP",
      "WS",
    ]);
    expect(within(screen.getByRole("group", { name: "分院选择" }))
      .getAllByRole("button")
      .map((button) => [button.textContent, button.dataset.variant])).toEqual([
      ["MK", "default"],
      ["STP", "primary"],
      ["WS", "default"],
    ]);

    fireEvent.click(screen.getByRole("button", { name: "MK" }));
    expect(screen.getByRole("button", { name: "HAPPY" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "HUILING" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "YUAN NING" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回分院" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "HAPPY" }));
    expect(await screen.findByRole("heading", { name: "MK HAPPY" })).toBeVisible();
    expect(screen.getByRole("button", { name: "返回老师" })).toBeVisible();
    expect(screen.getByRole("button", { name: "返回分院" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Dashboard" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "返回班级" }));
    expect(await screen.findByRole("heading", { name: "MK HAPPY" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "返回分院" }));
    fireEvent.click(screen.getByRole("button", { name: "STP" }));
    expect(screen.getByRole("button", { name: "YUAN NING" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "HAPPY" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "返回分院" }));
    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "返回分院" }));
    expect(screen.getByRole("heading", { name: "请选择分院" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "WS" }));
    expect(screen.getByRole("button", { name: "HUILING" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "HAPPY" })).not.toBeInTheDocument();
  });
});

describe("flow state boundaries", () => {
  it("clears stale group and branch selections at every backwards boundary", () => {
    const changedBranch = flowReducer(
      { screen: "roster", branchCode: "MK", groupCode: "MK HAPPY" },
      { type: "SELECT_BRANCH", branchCode: "WS" },
    );
    expect(changedBranch).toEqual({ screen: "group", branchCode: "WS", groupCode: null });

    expect(flowReducer(
      { screen: "roster", branchCode: "WS", groupCode: "WS HUILING" },
      { type: "BACK_TO_GROUPS" },
    )).toEqual({ screen: "group", branchCode: "WS", groupCode: null });

    expect(flowReducer(changedBranch, { type: "BACK_TO_BRANCHES" })).toEqual({
      screen: "branch",
      branchCode: null,
      groupCode: null,
    });
    expect(flowReducer(changedBranch, { type: "OPEN_DASHBOARD" })).toEqual({
      screen: "dashboard",
      branchCode: "WS",
      groupCode: null,
    });
    expect(flowReducer(
      { screen: "dashboard", branchCode: "MK", groupCode: "MK HAPPY" },
      { type: "BACK_FROM_DASHBOARD" },
    )).toEqual({ screen: "roster", branchCode: "MK", groupCode: "MK HAPPY" });
    expect(flowReducer(changedBranch, { type: "LOGOUT" })).toEqual(initialFlowState);
  });
});

describe("API boundary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes response failures without leaking server wording", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(409, {
      code: "GROUP_BRANCH_MISMATCH",
      error: "Group does not belong to branch",
    })));

    await expect(apiRequest("/api/students")).rejects.toMatchObject({
      status: 409,
      code: "GROUP_BRANCH_MISMATCH",
      message: "Group does not belong to branch",
    });
  });

  it("attaches both selected codes to later scoped requests", async () => {
    let request;
    vi.stubGlobal("fetch", vi.fn(async (url, options) => {
      request = { url, options };
      return jsonResponse(204);
    }));

    await apiRequest("/api/students/123/stop", {
      method: "POST",
      body: { name: "Student", grade: "Y3", groupCode: "MK HAPPY" },
      branchCode: "MK",
      groupCode: "MK HAPPY",
    });

    expect(request).toEqual({
      url: "/api/students/123/stop",
      options: {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Branch-Code": "MK",
          "X-Group-Code": "MK HAPPY",
        },
        body: JSON.stringify({ name: "Student", grade: "Y3", groupCode: "MK HAPPY" }),
      },
    });
  });

  it("encodes a Chinese teacher group into a browser-safe request header", async () => {
    let request;
    vi.stubGlobal("fetch", vi.fn(async (url, options) => {
      request = new Request(`https://example.test${url}`, options);
      return jsonResponse(204);
    }));

    await expect(apiRequest("/api/students/student-id/profile", {
      method: "PATCH",
      body: { updatedAt: "2026-08-01T00:00:00.000Z", profile: { school: "Test" } },
      branchCode: "STP",
      groupCode: "巧恩 STP",
    })).resolves.toBeNull();

    expect(request.headers.get("X-Branch-Code")).toBe("STP");
    expect(request.headers.get("X-Group-Code")).toBe(encodeURIComponent("巧恩 STP"));
  });
});

describe("Google account login", () => {
  afterEach(() => {
    cleanup();
    document.getElementById("google-identity-services")?.remove();
    vi.unstubAllGlobals();
  });

  it("shows only the official Google button and recovers after a rejected credential", async () => {
    let finishFirstLogin;
    const firstLoginResponse = new Promise((resolve) => {
      finishFirstLogin = resolve;
    });
    let googleCallback;
    const renderButton = vi.fn((container) => {
      const button = document.createElement("button");
      button.textContent = "使用 Google 登录";
      container.append(button);
    });
    const initialize = vi.fn((options) => {
      googleCallback = options.callback;
    });
    vi.stubGlobal("google", {
      accounts: { id: { initialize, renderButton } },
    });
    const googleRequests = [];
    vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
      if (url === "/api/session") return jsonResponse(401, { error: "Authentication required" });
      if (url === "/api/session/config") {
        return jsonResponse(200, { googleClientId: "test-client.apps.googleusercontent.com" });
      }
      if (url === "/api/session/google") {
        googleRequests.push(JSON.parse(options.body));
        return googleRequests.length === 1
          ? firstLoginResponse
          : jsonResponse(204);
      }
      if (url === "/api/catalog") return jsonResponse(200, catalog);
      throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
    }));

    render(<App />);
    expect(await screen.findByRole("heading", { name: "登录点名系统" })).toBeVisible();
    expect(screen.getByText("请使用授权的 Google 帐号登录")).toBeVisible();
    expect(screen.getByLabelText("Google 登录")).toBeVisible();
    expect(screen.queryByLabelText("系统密码")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("紧急密码")).not.toBeInTheDocument();
    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({
      client_id: "test-client.apps.googleusercontent.com",
      callback: expect.any(Function),
    }));
    expect(renderButton).toHaveBeenCalledTimes(1);

    await act(async () => {
      googleCallback({ credential: "first-google-token" });
    });
    expect(googleRequests).toEqual([{ credential: "first-google-token" }]);
    expect(await screen.findByText("登录中…")).toBeVisible();

    await act(async () => {
      finishFirstLogin(jsonResponse(401, { error: "Invalid Google credential" }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Google 登录失败，请重试");

    await act(async () => {
      await googleCallback({ credential: "second-google-token" });
    });
    expect(await screen.findByRole("heading", { name: "请选择分院" })).toBeVisible();
    expect(googleRequests).toEqual([
      { credential: "first-google-token" },
      { credential: "second-google-token" },
    ]);
  });

  it("shows retry guidance when the Google script cannot load", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (url === "/api/session") return jsonResponse(401, { error: "Authentication required" });
      if (url === "/api/session/config") {
        return jsonResponse(200, { googleClientId: "test-client.apps.googleusercontent.com" });
      }
      throw new Error(`Unexpected request: GET ${url}`);
    }));

    render(<App />);
    expect(await screen.findByRole("heading", { name: "登录点名系统" })).toBeVisible();
    const script = document.getElementById("google-identity-services");
    expect(script).toHaveAttribute("src", "https://accounts.google.com/gsi/client?hl=zh_CN");
    fireEvent.error(script);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Google 登录暂时无法载入，请刷新重试",
    );
  });
});
