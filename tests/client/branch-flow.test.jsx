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
    expect(screen.getByRole("button", { name: "返回分院" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "HAPPY" }));
    expect(await screen.findByRole("heading", { name: "MK HAPPY" })).toBeVisible();
    expect(screen.getByRole("button", { name: "返回老师" })).toBeVisible();
    expect(screen.getByRole("button", { name: "返回分院" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "返回分院" }));
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
});

describe("shared password login", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("uses one account-free password form and recovers after a failed attempt", async () => {
    let finishFirstLogin;
    const firstLoginResponse = new Promise((resolve) => {
      finishFirstLogin = resolve;
    });
    const passwordRequests = [];
    vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
      if (url === "/api/session") return jsonResponse(401, { error: "Authentication required" });
      if (url === "/api/session/password") {
        passwordRequests.push(JSON.parse(options.body));
        return passwordRequests.length === 1
          ? firstLoginResponse
          : jsonResponse(204);
      }
      if (url === "/api/catalog") return jsonResponse(200, catalog);
      throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
    }));

    render(<App />);
    expect(await screen.findByRole("heading", { name: "登录点名系统" })).toBeVisible();
    expect(screen.getByText("请输入系统密码")).toBeVisible();
    expect(screen.queryByLabelText("Google 登录")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("紧急密码")).not.toBeInTheDocument();

    const password = screen.getByLabelText("系统密码");
    fireEvent.change(password, { target: { value: "private-access" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "登录中…" })).toBeDisabled());
    expect(passwordRequests).toEqual([{ password: "private-access" }]);

    await act(async () => {
      finishFirstLogin(jsonResponse(401, { error: "Invalid password" }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("密码错误，请重试");
    expect(password).toHaveValue("");
    expect(password).toBeEnabled();
    expect(screen.getByRole("button", { name: "登录" })).toBeDisabled();

    fireEvent.change(password, { target: { value: "later-access" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(await screen.findByRole("heading", { name: "请选择分院" })).toBeVisible();
    expect(passwordRequests).toEqual([
      { password: "private-access" },
      { password: "later-access" },
    ]);
  });
});
