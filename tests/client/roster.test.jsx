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
import { MessageDialog } from "../../src/features/messages/MessageDialog.jsx";
import { RosterScreen } from "../../src/features/roster/RosterScreen.jsx";

const EMPTY_PROFILE = {
  school: "",
  schoolClass: "",
  usualPickupTime: "",
  pickupMethod: "",
  vanDriver: "",
  vanHomeTime: "",
  lateStayMonday: "",
  lateStayTuesday: "",
  lateStayWednesday: "",
  lateStayThursday: "",
  lateStayFriday: "",
};

function student(index, overrides = {}) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    name: `Student ${String(index).padStart(3, "0")}`,
    grade: "Y3",
    branchCode: "STP",
    groupCode: "PS STP",
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

function rosterSupport(url) {
  if (url.startsWith("/api/attendance?")) return jsonResponse(200, { items: [] });
  if (url.startsWith("/api/summary?")) {
    return jsonResponse(200, {
      expected: 121,
      arrived: 0,
      notArrived: 121,
      absent: 0,
      koko: 0,
      unmarked: 121,
    });
  }
  throw new Error(`Unexpected request: GET ${url}`);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("virtualized current-group roster", () => {
  it("mounts fewer than 30 cards for 121 students and requests 50 rows at a time", async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => student(index + 1));
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (url.startsWith("/api/students?")) {
        expect(url).toContain("branch=STP");
        expect(url).toContain("group=PS+STP");
        expect(url).toContain("status=active");
        expect(url).toContain("limit=50");
        return jsonResponse(200, {
          items: firstPage,
          nextCursor: "next-50",
          total: 121,
        });
      }
      return rosterSupport(url);
    }));

    render(<RosterScreen branchCode="STP" groupCode="PS STP" />);

    expect(await screen.findByText("Student 001")).toBeVisible();
    expect(screen.getAllByTestId("student-card").length).toBeLessThan(30);
    expect(screen.getAllByTestId("student-list")).toHaveLength(1);
  });

  it("loads the next cursor when scrolling into the final five virtual items", async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => student(index + 1));
    const secondPage = Array.from({ length: 50 }, (_, index) => student(index + 51));
    const secondPageRequest = deferred();
    const fetchMock = vi.fn(async (url) => {
      if (url.startsWith("/api/students?")) {
        const cursor = new URL(url, "http://test.local").searchParams.get("cursor");
        if (cursor === "next-50") return secondPageRequest.promise;
        if (cursor === "next-100") {
          return jsonResponse(200, {
            items: Array.from({ length: 21 }, (_, index) => student(index + 101)),
            nextCursor: null,
            total: 121,
          });
        }
        return jsonResponse(200, {
          items: firstPage,
          nextCursor: "next-50",
          total: 121,
        });
      }
      return rosterSupport(url);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<RosterScreen branchCode="STP" groupCode="PS STP" />);
    await screen.findByText("Student 001");

    const list = screen.getByTestId("student-list");
    Object.defineProperty(list, "scrollTop", { configurable: true, value: 14_000 });
    fireEvent.scroll(list);

    await waitFor(() => {
      const nextPageCalls = fetchMock.mock.calls.filter(([url]) => (
        url.startsWith("/api/students?") && url.includes("cursor=next-50")
      ));
      expect(nextPageCalls).toHaveLength(1);
      const requestUrl = new URL(nextPageCalls[0][0], "http://test.local");
      expect(Object.fromEntries(requestUrl.searchParams)).toMatchObject({
        branch: "STP",
        group: "PS STP",
        status: "active",
        cursor: "next-50",
        limit: "50",
      });
      expect(nextPageCalls[0][1].headers).toMatchObject({
        "X-Branch-Code": "STP",
        "X-Group-Code": "PS STP",
      });
    });

    fireEvent.scroll(list);
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("cursor=next-50"))).toHaveLength(1);

    await act(async () => {
      secondPageRequest.resolve(jsonResponse(200, {
        items: secondPage,
        nextCursor: "next-100",
        total: 121,
      }));
    });
    Object.defineProperty(list, "scrollTop", { configurable: true, value: 28_500 });
    fireEvent.scroll(list);

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => url.includes("cursor=next-100")))
        .toHaveLength(1);
      expect(fetchMock.mock.calls.filter(([url]) => url.includes("cursor=next-50")))
        .toHaveLength(1);
    });
  });

  it("keeps an initial failure inside the current selection and retries that same scope", async () => {
    let rosterAttempts = 0;
    const fetchMock = vi.fn(async (url) => {
      if (url.startsWith("/api/students?")) {
        rosterAttempts += 1;
        if (rosterAttempts === 1) return jsonResponse(503, { error: "database unavailable" });
        return jsonResponse(200, {
          items: [student(1)],
          nextCursor: null,
          total: 1,
        });
      }
      return rosterSupport(url);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<RosterScreen branchCode="STP" groupCode="PS STP" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("名单载入失败，请重试");
    expect(screen.queryByTestId("student-list")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));

    expect(await screen.findByText("Student 001")).toBeVisible();
    const rosterUrls = fetchMock.mock.calls
      .map(([url]) => url)
      .filter((url) => url.startsWith("/api/students?"));
    expect(rosterUrls).toHaveLength(2);
    expect(rosterUrls.every((url) => (
      url.includes("branch=STP") && url.includes("group=PS+STP")
    ))).toBe(true);
  });
});

describe("attendance controls and summary", () => {
  it("hides pickup and switches arrive and absent exclusively before saving", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
      if (url.startsWith("/api/students?")) {
        return jsonResponse(200, { items: [student(1)], nextCursor: null, total: 1 });
      }
      if (url.startsWith("/api/attendance?")) {
        return jsonResponse(200, {
          items: [{
            studentId: student(1).id,
            date: "2026-07-27",
            eventCode: "absent",
            active: true,
            updatedBy: "teacher@example.com",
            updatedAt: "2026-07-27T00:00:00.000Z",
          }],
        });
      }
      if (url.startsWith("/api/summary?")) {
        return jsonResponse(200, {
          expected: 1, arrived: 1, notArrived: 0, absent: 0, koko: 0, unmarked: 0,
        });
      }
      if (url.includes("/attendance/") && options.method === "PUT") {
        return jsonResponse(200, {
          studentId: student(1).id,
          date: "2026-07-27",
          eventCode: "arrive",
          active: true,
          updatedBy: "teacher@example.com",
          updatedAt: "2026-07-27T01:00:00.000Z",
        });
      }
      throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
    }));

    render(<RosterScreen branchCode="STP" groupCode="PS STP" date="2026-07-27" />);
    const card = await screen.findByTestId("student-card");
    const arrive = within(card).getByRole("button", { name: "到" });
    const absent = within(card).getByRole("button", { name: "缺席" });
    await waitFor(() => expect(absent).toHaveAttribute("aria-pressed", "true"));

    expect(within(card).queryByRole("button", { name: "接" })).not.toBeInTheDocument();
    fireEvent.click(arrive);
    expect(arrive).toHaveAttribute("aria-pressed", "true");
    expect(absent).toHaveAttribute("aria-pressed", "false");
    expect(await within(card).findByText("已保存")).toBeVisible();
  });

  it("does not let a stale initial attendance response overwrite a newer saved event", async () => {
    const initialAttendance = deferred();
    vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
      if (url.startsWith("/api/students?")) {
        return jsonResponse(200, { items: [student(1)], nextCursor: null, total: 1 });
      }
      if (url.startsWith("/api/attendance?")) return initialAttendance.promise;
      if (url.startsWith("/api/summary?")) {
        return jsonResponse(200, {
          expected: 1, arrived: 1, notArrived: 0, absent: 0, koko: 0, unmarked: 0,
        });
      }
      if (url.includes("/attendance/") && options.method === "PUT") {
        return jsonResponse(200, {
          studentId: student(1).id,
          date: "2026-07-27",
          eventCode: "arrive",
          active: true,
          updatedBy: "teacher@example.com",
          updatedAt: "2026-07-27T01:00:00.000Z",
        });
      }
      throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
    }));

    render(<RosterScreen branchCode="STP" groupCode="PS STP" date="2026-07-27" />);
    const card = await screen.findByTestId("student-card");
    const arrive = within(card).getByRole("button", { name: "到" });
    fireEvent.click(arrive);
    expect(await within(card).findByText("已保存")).toBeVisible();

    await act(async () => {
      initialAttendance.resolve(jsonResponse(200, { items: [] }));
    });

    expect(arrive).toHaveAttribute("aria-pressed", "true");
  });

  it("does not let an older initial summary overwrite a newer post-save summary", async () => {
    const initialSummary = deferred();
    let summaryCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
      if (url.startsWith("/api/students?")) {
        return jsonResponse(200, { items: [student(1)], nextCursor: null, total: 1 });
      }
      if (url.startsWith("/api/attendance?")) return jsonResponse(200, { items: [] });
      if (url.startsWith("/api/summary?")) {
        summaryCalls += 1;
        if (summaryCalls === 1) return initialSummary.promise;
        return jsonResponse(200, {
          expected: 1, arrived: 1, notArrived: 0, absent: 0, koko: 0, unmarked: 0,
        });
      }
      if (url.includes("/attendance/") && options.method === "PUT") {
        return jsonResponse(200, {
          studentId: student(1).id,
          date: "2026-07-27",
          eventCode: "arrive",
          active: true,
          updatedBy: "teacher@example.com",
          updatedAt: "2026-07-27T01:00:00.000Z",
        });
      }
      throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
    }));

    render(<RosterScreen branchCode="STP" groupCode="PS STP" date="2026-07-27" />);
    const card = await screen.findByTestId("student-card");
    fireEvent.click(within(card).getByRole("button", { name: "到" }));
    expect(await screen.findByText("已到 1")).toBeVisible();

    await act(async () => {
      initialSummary.resolve(jsonResponse(200, {
        expected: 1, arrived: 0, notArrived: 1, absent: 0, koko: 0, unmarked: 1,
      }));
    });

    expect(screen.getByText("已到 1")).toBeVisible();
    expect(screen.queryByText("已到 0")).not.toBeInTheDocument();
  });

  it("shows scoped attendance and summary bootstrap failures with independent retries", async () => {
    let attendanceCalls = 0;
    let summaryCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (url.startsWith("/api/students?")) {
        return jsonResponse(200, { items: [student(1)], nextCursor: null, total: 1 });
      }
      if (url.startsWith("/api/attendance?")) {
        attendanceCalls += 1;
        return attendanceCalls === 1
          ? jsonResponse(503, { error: "attendance unavailable" })
          : jsonResponse(200, { items: [] });
      }
      if (url.startsWith("/api/summary?")) {
        summaryCalls += 1;
        return summaryCalls === 1
          ? jsonResponse(503, { error: "summary unavailable" })
          : jsonResponse(200, {
            expected: 1, arrived: 0, notArrived: 1, absent: 0, koko: 0, unmarked: 1,
          });
      }
      throw new Error(`Unexpected request: GET ${url}`);
    }));

    render(<RosterScreen branchCode="STP" groupCode="PS STP" date="2026-07-27" />);
    expect(await screen.findByText("Student 001")).toBeVisible();
    expect(screen.getByRole("alert", { name: "点名资料错误" }))
      .toHaveTextContent("点名资料载入失败");
    expect(screen.getByRole("alert", { name: "统计错误" }))
      .toHaveTextContent("统计载入失败");
    expect(screen.getByTestId("student-list")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "重试点名资料" }));
    fireEvent.click(screen.getByRole("button", { name: "重试统计" }));

    await waitFor(() => {
      expect(screen.queryByRole("alert", { name: "点名资料错误" })).not.toBeInTheDocument();
      expect(screen.queryByRole("alert", { name: "统计错误" })).not.toBeInTheDocument();
    });
    expect(attendanceCalls).toBe(2);
    expect(summaryCalls).toBe(2);
  });

  it("rolls back a failed optimistic event, retries it, disables only that student, and refreshes summary", async () => {
    let eventAttempts = 0;
    let summaryCalls = 0;
    let finishFirstEvent;
    const firstEvent = new Promise((resolve) => {
      finishFirstEvent = resolve;
    });
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.startsWith("/api/students?")) {
        return jsonResponse(200, {
          items: [student(1), student(2)],
          nextCursor: null,
          total: 2,
        });
      }
      if (url.startsWith("/api/attendance?")) return jsonResponse(200, { items: [] });
      if (url.startsWith("/api/summary?")) {
        summaryCalls += 1;
        return jsonResponse(200, {
          expected: 2,
          arrived: summaryCalls > 1 ? 1 : 0,
          notArrived: summaryCalls > 1 ? 1 : 2,
          absent: 0,
          koko: 0,
          unmarked: summaryCalls > 1 ? 1 : 2,
        });
      }
      if (url.includes("/attendance/") && options.method === "PUT") {
        eventAttempts += 1;
        expect(options.headers).toMatchObject({
          "X-Branch-Code": "STP",
          "X-Group-Code": "PS STP",
        });
        if (eventAttempts === 1) return firstEvent;
        return jsonResponse(200, {
          studentId: student(1).id,
          date: "2026-07-27",
          eventCode: "arrive",
          active: true,
          updatedAt: "2026-07-27T01:00:00.000Z",
          updatedBy: "teacher@example.com",
        });
      }
      throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <RosterScreen
        branchCode="STP"
        groupCode="PS STP"
        date="2026-07-27"
      />,
    );
    const cards = await screen.findAllByTestId("student-card");
    const firstCard = cards[0];
    const secondCard = cards[1];
    const arrive = within(firstCard).getByRole("button", { name: "到" });

    fireEvent.click(arrive);
    expect(arrive).toHaveAttribute("aria-pressed", "true");
    expect(within(firstCard).getByRole("button", { name: "冲" })).toBeDisabled();
    expect(within(secondCard).getByRole("button", { name: "冲" })).toBeEnabled();

    await act(async () => {
      finishFirstEvent(jsonResponse(500, { error: "save failed" }));
    });

    expect(await within(firstCard).findByRole("button", { name: "重试" })).toBeVisible();
    expect(arrive).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(within(firstCard).getByRole("button", { name: "重试" }));

    expect(await within(firstCard).findByText("已保存")).toBeVisible();
    expect(arrive).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(summaryCalls).toBe(2));
    expect(screen.getByText("已到 1")).toBeVisible();
  });

  it("clears one student's day with scoped headers and refreshes the active-only summary", async () => {
    let summaryCalls = 0;
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.startsWith("/api/students?")) {
        return jsonResponse(200, { items: [student(1)], nextCursor: null, total: 1 });
      }
      if (url.startsWith("/api/attendance?")) {
        return jsonResponse(200, {
          items: [{
            studentId: student(1).id,
            date: "2026-07-27",
            eventCode: "shower",
            active: true,
            updatedBy: "teacher@example.com",
            updatedAt: "2026-07-27T00:00:00.000Z",
          }],
        });
      }
      if (url.startsWith("/api/summary?")) {
        summaryCalls += 1;
        return jsonResponse(200, {
          expected: 1,
          arrived: 0,
          notArrived: 1,
          absent: 0,
          koko: 0,
          unmarked: 1,
        });
      }
      if (url.includes("/attendance/2026-07-27") && options.method === "DELETE") {
        expect(options.headers).toMatchObject({
          "X-Branch-Code": "STP",
          "X-Group-Code": "PS STP",
        });
        return jsonResponse(200, { cleared: 1 });
      }
      throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <RosterScreen branchCode="STP" groupCode="PS STP" date="2026-07-27" />,
    );
    const card = await screen.findByTestId("student-card");
    expect(within(card).getByRole("button", { name: "冲" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(card).getByRole("button", { name: "清除今日" }));

    await waitFor(() => {
      expect(within(card).getByRole("button", { name: "冲" }))
        .toHaveAttribute("aria-pressed", "false");
      expect(summaryCalls).toBe(2);
    });
  });
});

describe("one on-demand message editor", () => {
  it("renders no textarea per row and opens exactly one editor for the selected student", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
      if (url.startsWith("/api/students?")) {
        return jsonResponse(200, {
          items: [student(1), student(2)],
          nextCursor: null,
          total: 2,
        });
      }
      if (url.startsWith("/api/attendance?")) return jsonResponse(200, { items: [] });
      if (url.startsWith("/api/summary?")) {
        return jsonResponse(200, {
          expected: 2, arrived: 0, notArrived: 2, absent: 0, koko: 0, unmarked: 2,
        });
      }
      if (url.endsWith("/messages") && (options.method ?? "GET") === "GET") {
        expect(options.headers).toMatchObject({
          "X-Branch-Code": "STP",
          "X-Group-Code": "PS STP",
        });
        return jsonResponse(200, { items: [] });
      }
      throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
    }));

    render(<RosterScreen branchCode="STP" groupCode="PS STP" date="2026-07-27" />);
    const cards = await screen.findAllByTestId("student-card");
    expect(screen.queryByRole("textbox", { name: "留言内容" })).not.toBeInTheDocument();

    fireEvent.click(within(cards[0]).getByRole("button", { name: /选择 Student 001/ }));
    fireEvent.click(screen.getByRole("button", { name: "写留言" }));

    expect(await screen.findByRole("dialog", { name: "Student 001 留言" })).toBeVisible();
    expect(screen.getAllByRole("textbox", { name: "留言内容" })).toHaveLength(1);
  });

  it("enters and traps focus, closes on Escape, and restores focus to the opener", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (url.endsWith("/messages")) return jsonResponse(200, { items: [] });
      throw new Error(`Unexpected request: GET ${url}`);
    }));

    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>打开留言</button>
          {open ? (
            <MessageDialog
              branchCode="STP"
              groupCode="PS STP"
              student={student(1)}
              date="2026-07-27"
              onClose={() => setOpen(false)}
            />
          ) : null}
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole("button", { name: "打开留言" });
    opener.focus();
    fireEvent.click(opener);

    const editor = await screen.findByRole("textbox", { name: "留言内容" });
    const close = screen.getByRole("button", { name: "关闭" });
    await waitFor(() => expect(editor).toHaveFocus());

    opener.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    editor.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(editor).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
