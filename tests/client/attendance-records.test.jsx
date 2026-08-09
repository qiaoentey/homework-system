// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RosterScreen } from "../../src/features/roster/RosterScreen.jsx";

const PROFILE = {
  school: "",
  schoolClass: "",
  usualPickupTime: "",
  pickupMethod: "",
  vanDriver: "",
  vanHomeTime: "",
  vanMonday: "",
  vanTuesday: "",
  vanWednesday: "",
  vanThursday: "",
  vanFriday: "",
  dinnerRequired: "",
  dinnerMonday: "",
  dinnerTuesday: "",
  dinnerWednesday: "",
  dinnerThursday: "",
  dinnerFriday: "",
  lateStayMonday: "",
  lateStayTuesday: "",
  lateStayWednesday: "",
  lateStayThursday: "",
  lateStayFriday: "",
  careProgram: "",
  homeworkArrivalTime: "",
  homeworkDepartureTime: "",
  homeworkMonday: "",
  homeworkTuesday: "",
  homeworkWednesday: "",
  homeworkThursday: "",
  homeworkFriday: "",
  showerRequired: "",
  detentionType: "",
  specialNoteHighC: "",
  specialNoteDailyHomeworkPhoto: "",
  specialNoteNotifyIncompleteHomework: "",
  specialNoteOther: "",
};

const CURRENT = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "CURRENT STUDENT",
  grade: "Y3",
  branchCode: "STP",
  groupCode: "PS STP",
  status: "active",
  profile: PROFILE,
  updatedAt: "2026-07-27T00:00:00.000Z",
};

const READY_RECORD = {
  date: "2026-07-27",
  counts: { present: 1, absent: 1, unmarked: 1, conflicts: 0 },
  present: [{ id: "10000000-0000-4000-8000-000000000001", name: "PRESENT ONE", grade: "Y1" }],
  absent: [{ id: "10000000-0000-4000-8000-000000000002", name: "ABSENT ONE", grade: "Y2" }],
  unmarked: [{ id: "10000000-0000-4000-8000-000000000003", name: "UNMARKED ONE", grade: "Y3" }],
  conflicts: [],
};

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return body === undefined ? "" : JSON.stringify(body);
    },
  };
}

function supportFetch(recordHandler) {
  return vi.fn(async (url) => {
    if (url.startsWith("/api/students?")) {
      return jsonResponse(200, { items: [CURRENT], nextCursor: null, total: 1 });
    }
    if (url.startsWith("/api/attendance?")) return jsonResponse(200, { items: [] });
    if (url.startsWith("/api/summary?")) {
      return jsonResponse(200, {
        expected: 1, arrived: 0, notArrived: 1, absent: 0, unmarked: 1,
      });
    }
    if (url.startsWith("/api/attendance-records?")) return recordHandler(url);
    throw new Error(`Unexpected request: GET ${url}`);
  });
}

function renderRoster() {
  render(<RosterScreen branchCode="STP" groupCode="PS STP" date="2026-07-27" />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("daily attendance records", () => {
  it("opens the current class record and reloads automatically when the date changes", async () => {
    const recordUrls = [];
    vi.stubGlobal("fetch", supportFetch((url) => {
      recordUrls.push(url);
      const date = new URL(url, "http://test.local").searchParams.get("date");
      return jsonResponse(200, date === "2026-07-27" ? READY_RECORD : {
        date,
        counts: { present: 0, absent: 0, unmarked: 0, conflicts: 0 },
        present: [], absent: [], unmarked: [], conflicts: [],
      });
    }));
    renderRoster();

    await screen.findByText("CURRENT STUDENT");
    fireEvent.click(screen.getByRole("button", { name: "点名记录" }));

    const dialog = await screen.findByRole("dialog", { name: "点名记录" });
    expect(within(dialog).getByText("PS STP")).toBeVisible();
    expect(within(dialog).getByLabelText("记录日期")).toHaveValue("2026-07-27");
    expect(within(dialog).getByRole("heading", { name: "出席 1" })).toBeVisible();
    expect(within(dialog).getByRole("heading", { name: "缺席 1" })).toBeVisible();
    expect(within(dialog).getByRole("heading", { name: "未点名 1" })).toBeVisible();
    expect(within(dialog).getByText("PRESENT ONE")).toBeVisible();
    expect(within(dialog).getByText("ABSENT ONE")).toBeVisible();
    expect(within(dialog).getByText("UNMARKED ONE")).toBeVisible();

    fireEvent.change(within(dialog).getByLabelText("记录日期"), {
      target: { value: "2026-07-26" },
    });
    await waitFor(() => expect(recordUrls).toHaveLength(2));
    expect(recordUrls[1]).toContain("branch=STP");
    expect(recordUrls[1]).toContain("group=PS+STP");
    expect(recordUrls[1]).toContain("date=2026-07-26");
    expect(within(dialog).getByRole("heading", { name: "出席 0" })).toBeVisible();
  });

  it("shows empty lists and isolates legacy arrive-absent conflicts", async () => {
    vi.stubGlobal("fetch", supportFetch(() => jsonResponse(200, {
      date: "2026-07-27",
      counts: { present: 0, absent: 0, unmarked: 0, conflicts: 1 },
      present: [],
      absent: [],
      unmarked: [],
      conflicts: [{
        id: "10000000-0000-4000-8000-000000000004",
        name: "CHECK THIS STUDENT",
        grade: "Y4",
      }],
    })));
    renderRoster();

    await screen.findByText("CURRENT STUDENT");
    fireEvent.click(screen.getByRole("button", { name: "点名记录" }));
    const dialog = await screen.findByRole("dialog", { name: "点名记录" });

    expect(within(dialog).getAllByText("没有学生")).toHaveLength(3);
    expect(within(dialog).getByRole("alert")).toHaveTextContent("需要确认");
    expect(within(dialog).getByText(/CHECK THIS STUDENT/)).toBeVisible();
  });

  it("retries a failed record without disturbing the roster and restores opener focus", async () => {
    let attempts = 0;
    vi.stubGlobal("fetch", supportFetch(() => {
      attempts += 1;
      return attempts === 1
        ? jsonResponse(503, { error: "unavailable" })
        : jsonResponse(200, READY_RECORD);
    }));
    renderRoster();

    await screen.findByText("CURRENT STUDENT");
    const opener = screen.getByRole("button", { name: "点名记录" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "点名记录" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("点名记录载入失败");
    expect(screen.getByText("CURRENT STUDENT")).toBeVisible();

    fireEvent.click(within(dialog).getByRole("button", { name: "重新载入" }));
    expect(await within(dialog).findByRole("heading", { name: "出席 1" })).toBeVisible();
    expect(attempts).toBe(2);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "点名记录" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
