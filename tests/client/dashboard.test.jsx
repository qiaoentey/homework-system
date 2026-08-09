// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardScreen } from "../../src/features/dashboard/DashboardScreen.jsx";

const dashboard = {
  date: "2026-07-27",
  groups: [
    {
      branchCode: "MK",
      groupCode: "MK HAPPY",
      groupLabel: "HAPPY",
      summary: {
        expected: 4,
        arrived: 1,
        notArrived: 2,
        absent: 1,
        unmarked: 2,
      },
      students: [
        { id: "1", name: "AMY", grade: "Y1", status: "arrived" },
        { id: "2", name: "BEN", grade: "Y2", status: "absent" },
        { id: "3", name: "CARA", grade: "Y3", status: "unmarked" },
        { id: "4", name: "DAN", grade: "Y4", status: "unmarked" },
      ],
    },
    {
      branchCode: "WS",
      groupCode: "WS HUILING",
      groupLabel: "HUILING",
      summary: {
        expected: 1,
        arrived: 0,
        notArrived: 1,
        absent: 0,
        unmarked: 1,
      },
      students: [{ id: "5", name: "EVA", grade: "Y5", status: "unmarked" }],
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("daily Dashboard", () => {
  it("opens the current class immediately when entered from its roster", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, dashboard)));

    render(
      <DashboardScreen
        date="2026-07-27"
        initialGroupCode="MK HAPPY"
        onBack={vi.fn()}
      />,
    );

    const mkCard = await screen.findByRole("article", { name: "MK HAPPY" });
    expect(within(mkCard).getByRole("button", { name: "收起 MK HAPPY 名单" })).toBeVisible();
    expect(within(mkCard).getByText("AMY")).toBeVisible();
    expect(within(mkCard).getByText("Y1 · 已到")).toBeVisible();
  });

  it("loads all groups, filters branches, and expands one class into student statuses", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, dashboard));
    vi.stubGlobal("fetch", fetchMock);

    render(<DashboardScreen date="2026-07-27" onBack={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    expect(await screen.findByRole("article", { name: "MK HAPPY" })).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dashboard?date=2026-07-27",
      expect.objectContaining({ credentials: "same-origin" }),
    );

    const mkCard = screen.getByRole("article", { name: "MK HAPPY" });
    expect(within(mkCard).getByText("应到").nextSibling).toHaveTextContent("4");
    expect(within(mkCard).getByText("已到").nextSibling).toHaveTextContent("1");
    expect(within(mkCard).getByText("还没有").nextSibling).toHaveTextContent("2");
    expect(within(mkCard).getByText("缺席").nextSibling).toHaveTextContent("1");
    expect(within(mkCard).getByText("未点").nextSibling).toHaveTextContent("2");
    expect(within(mkCard).queryByText("KOKO", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("AMY")).not.toBeInTheDocument();

    fireEvent.click(within(mkCard).getByRole("button", { name: "展开 MK HAPPY 名单" }));
    expect(within(mkCard).getByText("AMY")).toBeVisible();
    expect(within(mkCard).getByText("Y1 · 已到")).toBeVisible();
    expect(within(mkCard).getByText("Y2 · 缺席")).toBeVisible();
    expect(within(mkCard).getByText("Y3 · 未点")).toBeVisible();
    expect(within(mkCard).getByText("Y4 · 未点")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "WS" }));
    expect(screen.queryByRole("article", { name: "MK HAPPY" })).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "WS HUILING" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "全部" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("shows a retry action when the dashboard request fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(500, { error: "failed" }))
      .mockResolvedValueOnce(jsonResponse(200, dashboard));
    vi.stubGlobal("fetch", fetchMock);

    render(<DashboardScreen date="2026-07-27" onBack={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Dashboard 载入失败，请重试");
    fireEvent.click(screen.getByRole("button", { name: "重新载入" }));
    await waitFor(() => expect(screen.getByRole("article", { name: "MK HAPPY" })).toBeVisible());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
