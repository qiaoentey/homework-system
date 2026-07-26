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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RosterScreen } from "../../src/features/roster/RosterScreen.jsx";

const PROFILE = {
  school: "SJKC Example",
  schoolClass: "3A",
  usualPickupTime: "13:30",
  pickupMethod: "家长",
  lateStayMonday: "17:00",
  lateStayTuesday: "",
  lateStayWednesday: "17:30",
  lateStayThursday: "",
  lateStayFriday: "16:30",
};

const HAYDEN = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "HAYDEN CHIN",
  grade: "Y3",
  branchCode: "WS",
  groupCode: "WS HUILING",
  status: "active",
  profile: PROFILE,
  updatedAt: "2026-07-27T00:00:00.000Z",
};

const PROFILE_LABELS = [
  "学校",
  "学校班级",
  "平时接送时间",
  "接送方式",
  "星期一延时",
  "星期二延时",
  "星期三延时",
  "星期四延时",
  "星期五延时",
];

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return body === undefined ? "" : JSON.stringify(body);
    },
  };
}

function setupFetch() {
  return vi.fn(async (url, options = {}) => {
    if (url.startsWith("/api/students?")) {
      const search = new URL(url, "http://test.local").searchParams.get("search");
      return jsonResponse(200, search === "ZZZ_NO_MATCH"
        ? { items: [], nextCursor: null, total: 0 }
        : { items: [HAYDEN], nextCursor: null, total: 1 });
    }
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
    if (url.includes("/profile") && options.method === "PATCH") {
      return jsonResponse(200, {
        ...HAYDEN,
        profile: JSON.parse(options.body).profile,
        updatedAt: "2026-07-27T01:00:00.000Z",
      });
    }
    throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("current-group search and safe profile selection", () => {
  it("debounces for 250ms, clears the selected id and every form value on no result, and removes save", async () => {
    const fetchMock = setupFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<RosterScreen branchCode="WS" groupCode="WS HUILING" date="2026-07-27" />);

    const card = await screen.findByTestId("student-card");
    fireEvent.click(within(card).getByRole("button", { name: /选择 HAYDEN CHIN/ }));
    expect(screen.getByRole("button", { name: "保存学生资料" })).toBeEnabled();
    expect(screen.getByLabelText("学校")).toHaveValue("SJKC Example");

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "ZZZ_NO_MATCH" },
    });

    await act(async () => {
      vi.advanceTimersByTime(249);
    });
    expect(fetchMock.mock.calls.filter(([url]) => (
      url.startsWith("/api/students?") && url.includes("ZZZ_NO_MATCH")
    ))).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(await screen.findByText("找不到学生")).toBeVisible();
    expect(screen.queryByRole("button", { name: "保存学生资料" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "写留言" })).not.toBeInTheDocument();
    for (const label of PROFILE_LABELS) {
      expect(screen.getByLabelText(label)).toHaveValue("");
    }

    const searchUrl = fetchMock.mock.calls
      .map(([url]) => url)
      .find((url) => url.startsWith("/api/students?") && url.includes("ZZZ_NO_MATCH"));
    expect(searchUrl).toContain("branch=WS");
    expect(searchUrl).toContain("group=WS+HUILING");
  });

  it("renders exactly the nine profile contract fields and saves only the selected UUID with scope", async () => {
    let profileRequest;
    const fetchMock = setupFetch();
    vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
      if (url.includes("/profile")) profileRequest = { url, options };
      return fetchMock(url, options);
    }));
    render(<RosterScreen branchCode="WS" groupCode="WS HUILING" date="2026-07-27" />);

    const card = await screen.findByTestId("student-card");
    fireEvent.click(within(card).getByRole("button", { name: /选择 HAYDEN CHIN/ }));
    for (const label of PROFILE_LABELS) {
      expect(screen.getByLabelText(label)).toBeVisible();
    }
    expect(screen.getAllByTestId("profile-field")).toHaveLength(9);

    fireEvent.change(screen.getByLabelText("学校班级"), { target: { value: "3B" } });
    fireEvent.click(screen.getByRole("button", { name: "保存学生资料" }));

    expect(await screen.findByText("资料已保存")).toBeVisible();
    expect(profileRequest.url).toBe(`/api/students/${HAYDEN.id}/profile`);
    expect(profileRequest.options.headers).toMatchObject({
      "X-Branch-Code": "WS",
      "X-Group-Code": "WS HUILING",
    });
    expect(JSON.parse(profileRequest.options.body)).toEqual({
      updatedAt: HAYDEN.updatedAt,
      profile: {
        ...PROFILE,
        schoolClass: "3B",
      },
    });
  });
});
