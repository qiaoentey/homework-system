// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RosterScreen } from "../../src/features/roster/RosterScreen.jsx";

const GROUPS = [
  { code: "WS HUILING", label: "HUILING" },
  { code: "WS JIA WEN", label: "JIA WEN" },
  { code: "WS MIXIN", label: "MIXIN" },
];

const EMPTY_PROFILE = {
  school: "",
  schoolClass: "",
  usualPickupTime: "",
  pickupMethod: "",
  lateStayMonday: "",
  lateStayTuesday: "",
  lateStayWednesday: "",
  lateStayThursday: "",
  lateStayFriday: "",
};

function student(index, overrides = {}) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    name: `STUDENT ${index}`,
    grade: "Y3",
    branchCode: "WS",
    groupCode: "WS HUILING",
    status: "active",
    profile: { ...EMPTY_PROFILE },
    updatedAt: "2026-07-27T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return body === undefined ? "" : JSON.stringify(body);
    },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function supportResponse(url) {
  if (url.startsWith("/api/attendance?")) return jsonResponse(200, { items: [] });
  if (url.startsWith("/api/summary?")) {
    return jsonResponse(200, {
      expected: 1,
      arrived: 0,
      notArrived: 1,
      absent: 0,
      koko: 0,
      unmarked: 1,
    });
  }
  return null;
}

function renderRoster(props = {}) {
  return render(
    <RosterScreen
      branchCode="WS"
      groupCode="WS HUILING"
      groups={GROUPS}
      date="2026-07-27"
      {...props}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("student enrolment", () => {
  it("requires identity, offers only authenticated branch groups, sends every profile field once, and refreshes only the current group", async () => {
    const current = student(1, { name: "CURRENT STUDENT" });
    const enrolled = student(2, { name: "NEW STUDENT" });
    let activeReads = 0;
    let enrolRequest;
    const enrolResponse = deferred();
    const fetchMock = vi.fn(async (url, options = {}) => {
      const support = supportResponse(url);
      if (support) return support;
      if (url.startsWith("/api/students?") && (options.method ?? "GET") === "GET") {
        const query = new URL(url, "http://test.local").searchParams;
        expect(query.get("branch")).toBe("WS");
        expect(query.get("group")).toBe("WS HUILING");
        expect(query.get("status")).toBe("active");
        activeReads += 1;
        return jsonResponse(200, {
          items: activeReads === 1 ? [current] : [current, enrolled],
          nextCursor: null,
          total: activeReads === 1 ? 1 : 2,
        });
      }
      if (url === "/api/students" && options.method === "POST") {
        enrolRequest = { url, options };
        return enrolResponse.promise;
      }
      throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderRoster();

    await screen.findByText("CURRENT STUDENT");
    fireEvent.click(screen.getByRole("button", { name: "Enrol 学生" }));

    const dialog = screen.getByRole("dialog", { name: "Enrol 学生" });
    const group = within(dialog).getByLabelText("老师班级");
    expect(group).toHaveValue("WS HUILING");
    expect(within(group).getAllByRole("option").map((option) => option.value)).toEqual([
      "WS HUILING",
      "WS JIA WEN",
      "WS MIXIN",
    ]);
    expect(within(dialog).queryByRole("option", { name: "MK HAPPY" })).not.toBeInTheDocument();
    expect(within(dialog).getAllByTestId("enrol-profile-field")).toHaveLength(9);
    expect(within(dialog).getByRole("button", { name: "保存学生" })).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("学生姓名"), {
      target: { value: " NEW STUDENT " },
    });
    fireEvent.change(within(dialog).getByLabelText("年级"), { target: { value: "Y3" } });
    fireEvent.change(within(dialog).getByLabelText("学校"), {
      target: { value: "SJKC Example" },
    });
    const save = within(dialog).getByRole("button", { name: "保存学生" });
    fireEvent.click(save);
    fireEvent.click(save);

    expect(await within(dialog).findByRole("button", { name: "保存中…" })).toBeDisabled();
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/students")).toHaveLength(1);
    expect(enrolRequest.options.headers).toMatchObject({
      "X-Branch-Code": "WS",
      "X-Group-Code": "WS HUILING",
    });
    expect(JSON.parse(enrolRequest.options.body)).toEqual({
      name: "NEW STUDENT",
      grade: "Y3",
      branchCode: "WS",
      groupCode: "WS HUILING",
      profile: {
        ...EMPTY_PROFILE,
        school: "SJKC Example",
      },
    });

    await act(async () => {
      enrolResponse.resolve(jsonResponse(201, enrolled));
    });

    expect(await screen.findByText("学生已加入")).toBeVisible();
    expect(await screen.findByText("NEW STUDENT")).toBeVisible();
    expect(activeReads).toBe(2);
    expect(fetchMock.mock.calls
      .filter(([url]) => url.startsWith("/api/students?"))
      .every(([url]) => !url.includes("branch=MK") && !url.includes("group=WS+JIA+WEN")))
      .toBe(true);
  });

  it("ignores a completed enrol request after its dialog closes", async () => {
    const saving = deferred();
    let activeReads = 0;
    vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
      const support = supportResponse(url);
      if (support) return support;
      if (url.startsWith("/api/students?")) {
        activeReads += 1;
        return jsonResponse(200, {
          items: [student(1)],
          nextCursor: null,
          total: 1,
        });
      }
      if (url === "/api/students" && options.method === "POST") return saving.promise;
      throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
    }));
    renderRoster();
    await screen.findByText("STUDENT 1");
    fireEvent.click(screen.getByRole("button", { name: "Enrol 学生" }));
    fireEvent.change(screen.getByLabelText("学生姓名"), { target: { value: "LATE" } });
    fireEvent.change(screen.getByLabelText("年级"), { target: { value: "Y2" } });
    fireEvent.click(screen.getByRole("button", { name: "保存学生" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));

    await act(async () => {
      saving.resolve(jsonResponse(201, student(2, { name: "LATE" })));
    });

    expect(screen.queryByText("学生已加入")).not.toBeInTheDocument();
    expect(activeReads).toBe(1);
  });

  it("ignores a completed enrol request after the roster scope switches", async () => {
    const saving = deferred();
    vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
      const support = supportResponse(url);
      if (support) return support;
      if (url.startsWith("/api/students?")) {
        const query = new URL(url, "http://test.local").searchParams;
        const isWs = query.get("branch") === "WS";
        return jsonResponse(200, {
          items: [student(isWs ? 1 : 3, isWs ? {} : {
            name: "STP STUDENT",
            branchCode: "STP",
            groupCode: "PS STP",
          })],
          nextCursor: null,
          total: 1,
        });
      }
      if (url === "/api/students" && options.method === "POST") return saving.promise;
      throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
    }));
    const view = renderRoster();
    await screen.findByText("STUDENT 1");
    fireEvent.click(screen.getByRole("button", { name: "Enrol 学生" }));
    fireEvent.change(screen.getByLabelText("学生姓名"), { target: { value: "LATE WS" } });
    fireEvent.change(screen.getByLabelText("年级"), { target: { value: "Y2" } });
    fireEvent.click(screen.getByRole("button", { name: "保存学生" }));

    view.rerender(
      <RosterScreen
        branchCode="STP"
        groupCode="PS STP"
        groups={[{ code: "PS STP", label: "PS" }]}
        date="2026-07-27"
      />,
    );
    expect(await screen.findByText("STP STUDENT")).toBeVisible();

    await act(async () => {
      saving.resolve(jsonResponse(201, student(2, { name: "LATE WS" })));
    });

    expect(screen.queryByText("学生已加入")).not.toBeInTheDocument();
    expect(screen.queryByText("LATE WS")).not.toBeInTheDocument();
  });
});

describe("stop-supplement", () => {
  it("resolves one exact UUID, shows the exact confirmation, and removes only that active card", async () => {
    const current = student(1, {
      name: "CURRENT STUDENT",
      grade: "Y4",
    });
    let stopRequest;
    vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
      const support = supportResponse(url);
      if (support) return support;
      if (url.startsWith("/api/students?")) {
        const query = new URL(url, "http://test.local").searchParams;
        if (query.get("search") === "CURRENT STUDENT") {
          expect(query.get("status")).toBe("active");
          return jsonResponse(200, { items: [current], nextCursor: null, total: 1 });
        }
        return jsonResponse(200, { items: [current], nextCursor: null, total: 1 });
      }
      if (url === `/api/students/${current.id}/stop` && options.method === "POST") {
        stopRequest = { url, options };
        return jsonResponse(200, { ...current, status: "stopped" });
      }
      throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
    }));
    renderRoster();

    await screen.findByText("CURRENT STUDENT");
    fireEvent.click(screen.getByRole("button", { name: "停补学生" }));
    fireEvent.change(screen.getByLabelText("学生姓名"), {
      target: { value: "CURRENT STUDENT" },
    });
    fireEvent.change(screen.getByLabelText("年级"), { target: { value: "Y4" } });
    fireEvent.click(screen.getByRole("button", { name: "查找学生" }));

    expect(await screen.findByText("CURRENT STUDENT · Y4 · WS HUILING")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "确认停补" }));

    expect(await screen.findByText("学生已停补")).toBeVisible();
    expect(screen.queryByText("CURRENT STUDENT")).not.toBeInTheDocument();
    expect(stopRequest.url).toBe(`/api/students/${current.id}/stop`);
    expect(stopRequest.options.headers).toMatchObject({
      "X-Branch-Code": "WS",
      "X-Group-Code": "WS HUILING",
    });
    expect(JSON.parse(stopRequest.options.body)).toEqual({
      name: "CURRENT STUDENT",
      grade: "Y4",
      groupCode: "WS HUILING",
    });
  });

  it("requires an explicit UUID choice when exact identity has multiple candidates", async () => {
    const first = student(1, { name: "SAME NAME", grade: "Y3" });
    const second = student(2, { name: "SAME NAME", grade: "Y3" });
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      const support = supportResponse(url);
      if (support) return support;
      if (url.startsWith("/api/students?")) {
        const query = new URL(url, "http://test.local").searchParams;
        return jsonResponse(200, query.get("search") === "SAME NAME"
          ? { items: [first, second], nextCursor: null, total: 2 }
          : { items: [first], nextCursor: null, total: 1 });
      }
      throw new Error(`Unexpected request: GET ${url}`);
    }));
    renderRoster();

    await screen.findByText("SAME NAME");
    fireEvent.click(screen.getByRole("button", { name: "停补学生" }));
    fireEvent.change(screen.getByLabelText("学生姓名"), { target: { value: "SAME NAME" } });
    fireEvent.change(screen.getByLabelText("年级"), { target: { value: "Y3" } });
    fireEvent.click(screen.getByRole("button", { name: "查找学生" }));

    expect(await screen.findByText("找到多位学生，请选择正确的学生")).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "确认停补" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(first.id) }));
    expect(screen.getByRole("button", { name: "确认停补" })).toBeEnabled();
  });
});

describe("restore", () => {
  it("lists only stopped students in the current scope, requires selection and confirmation, then refreshes active roster", async () => {
    const active = student(1, { name: "ACTIVE STUDENT" });
    const stopped = student(2, {
      name: "STOPPED STUDENT",
      grade: "Y5",
      status: "stopped",
    });
    let activeReads = 0;
    let restoreRequest;
    vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
      const support = supportResponse(url);
      if (support) return support;
      if (url.startsWith("/api/students?")) {
        const query = new URL(url, "http://test.local").searchParams;
        expect(options.headers).toMatchObject({
          "X-Branch-Code": "WS",
          "X-Group-Code": "WS HUILING",
        });
        if (query.get("status") === "stopped") {
          expect(query.get("branch")).toBe("WS");
          expect(query.get("group")).toBe("WS HUILING");
          return jsonResponse(200, { items: [stopped], nextCursor: null, total: 1 });
        }
        activeReads += 1;
        return jsonResponse(200, {
          items: activeReads === 1 ? [active] : [active, { ...stopped, status: "active" }],
          nextCursor: null,
          total: activeReads === 1 ? 1 : 2,
        });
      }
      if (url === `/api/students/${stopped.id}/restore` && options.method === "POST") {
        restoreRequest = { url, options };
        return jsonResponse(200, { ...stopped, status: "active" });
      }
      throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
    }));
    renderRoster();

    await screen.findByText("ACTIVE STUDENT");
    fireEvent.click(screen.getByRole("button", { name: "恢复学生" }));
    const dialog = await screen.findByRole("dialog", { name: "恢复学生" });
    const confirm = within(dialog).getByRole("button", { name: "确认恢复" });
    expect(await within(dialog).findByText("STOPPED STUDENT · Y5 · WS HUILING")).toBeVisible();
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("radio", { name: /STOPPED STUDENT/ }));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    expect(await screen.findByText("学生已恢复")).toBeVisible();
    expect(await screen.findByText("STOPPED STUDENT")).toBeVisible();
    expect(activeReads).toBe(2);
    expect(restoreRequest.url).toBe(`/api/students/${stopped.id}/restore`);
    expect(restoreRequest.options.headers).toMatchObject({
      "X-Branch-Code": "WS",
      "X-Group-Code": "WS HUILING",
    });
    expect(JSON.parse(restoreRequest.options.body)).toEqual({});
  });
});

describe("lifecycle dialog accessibility", () => {
  it("keeps focus inside Restore while its candidate list is loading", async () => {
    const stoppedStudents = deferred();
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      const support = supportResponse(url);
      if (support) return support;
      if (url.startsWith("/api/students?")) {
        const status = new URL(url, "http://test.local").searchParams.get("status");
        if (status === "stopped") return stoppedStudents.promise;
        return jsonResponse(200, { items: [student(1)], nextCursor: null, total: 1 });
      }
      throw new Error(`Unexpected request: GET ${url}`);
    }));
    renderRoster();
    await screen.findByText("STUDENT 1");
    fireEvent.click(screen.getByRole("button", { name: "恢复学生" }));

    const dialog = screen.getByRole("dialog", { name: "恢复学生" });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement));
  });

  it("moves and traps focus, closes on Escape, and restores focus", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      const support = supportResponse(url);
      if (support) return support;
      if (url.startsWith("/api/students?")) {
        return jsonResponse(200, { items: [student(1)], nextCursor: null, total: 1 });
      }
      throw new Error(`Unexpected request: GET ${url}`);
    }));
    renderRoster();
    await screen.findByText("STUDENT 1");
    const opener = screen.getByRole("button", { name: "Enrol 学生" });
    opener.focus();
    fireEvent.click(opener);

    const name = screen.getByLabelText("学生姓名");
    const close = screen.getByRole("button", { name: "关闭" });
    await waitFor(() => expect(name).toHaveFocus());

    opener.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();
    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
