// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfilePanel } from "../../src/features/students/ProfilePanel.jsx";

const EMPTY_PROFILE = {
  school: "",
  schoolClass: "",
  usualPickupTime: "",
  pickupMethod: "家长",
  vanDriver: "",
  vanHomeTime: "",
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
};

function student(overrides = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "TEST STUDENT",
    grade: "Y3",
    branchCode: "WS",
    groupCode: "WS HUILING",
    status: "active",
    profile: EMPTY_PROFILE,
    updatedAt: "2026-08-02T00:00:00.000Z",
    ...overrides,
  };
}

function renderProfile(selectedStudent = student()) {
  render(
    <ProfilePanel
      branchCode="WS"
      groupCode="WS HUILING"
      student={selectedStudent}
      noResults={false}
      onSaved={vi.fn()}
      onOpenMessages={vi.fn()}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("restored student profile choices", () => {
  it("links the six original schools to grade-matched classes and clears an incompatible class", () => {
    renderProfile();

    const school = screen.getByRole("combobox", { name: "学校" });
    expect(within(school).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "请选择学校",
      "南益",
      "民义",
      "旺小",
      "桥南",
      "中华小学",
      "中华中学",
    ]);

    fireEvent.change(school, { target: { value: "南益" } });
    const schoolClass = screen.getByRole("combobox", { name: "学校班级" });
    expect(within(schoolClass).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "请选择学校班级",
      "3K",
      "3H",
      "3B",
      "3M",
      "3U",
      "3J",
      "3C",
    ]);

    fireEvent.change(schoolClass, { target: { value: "3C" } });
    fireEvent.change(school, { target: { value: "民义" } });
    expect(schoolClass).toHaveValue("");
    expect(within(schoolClass).queryByRole("option", { name: "3C" })).not.toBeInTheDocument();
  });

  it("maps Chinese primary and F grades to the correct school classes", () => {
    const { rerender } = render(
      <ProfilePanel
        branchCode="WS"
        groupCode="WS HUILING"
        student={student({
          grade: "三年级",
          profile: { ...EMPTY_PROFILE, school: "旺小" },
        })}
        noResults={false}
        onSaved={vi.fn()}
        onOpenMessages={vi.fn()}
      />,
    );

    expect(within(screen.getByRole("combobox", { name: "学校班级" }))
      .getAllByRole("option").map((option) => option.textContent)).toEqual([
      "请选择学校班级",
      "3坚",
      "3持",
      "3传",
      "3承",
      "3延",
      "3续",
    ]);

    rerender(
      <ProfilePanel
        branchCode="WS"
        groupCode="WS HUILING"
        student={student({
          id: "00000000-0000-4000-8000-000000000002",
          grade: "F2",
          profile: { ...EMPTY_PROFILE, school: "中华中学" },
        })}
        noResults={false}
        onSaved={vi.fn()}
        onOpenMessages={vi.fn()}
      />,
    );

    expect(within(screen.getByRole("combobox", { name: "学校班级" }))
      .getAllByRole("option").map((option) => option.textContent)).toEqual([
      "请选择学校班级",
      "F2S",
      "F2M",
      "F2J",
      "F2K",
      "F2C",
      "F2H",
      "F2O",
      "F2N",
      "F2G",
      "F2W",
      "F2A",
    ]);
  });

  it("restores time, transport, Van, driver, and weekday stay controls", () => {
    renderProfile();

    expect(screen.getByLabelText("平常回家时间")).toHaveAttribute("type", "time");
    const transport = screen.getByRole("combobox", { name: "回家载送" });
    expect(within(transport).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "家长",
      "Van",
    ]);
    expect(screen.queryByRole("combobox", { name: "Van 司机" })).not.toBeInTheDocument();

    fireEvent.change(transport, { target: { value: "Van" } });
    const driver = screen.getByRole("combobox", { name: "Van 司机" });
    expect(within(driver).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "请选择司机",
      "Tong",
      "Lam",
      "Lim",
      "Kent",
      "Wong",
      "Boon",
      "Aunty Lily",
      "Liew",
    ]);
    expect(screen.getByLabelText("Van 回程时间")).toHaveAttribute("type", "time");

    for (const day of ["星期一", "星期二", "星期三", "星期四", "星期五"]) {
      expect(within(screen.getByRole("combobox", { name: day }))
        .getAllByRole("option").map((option) => option.textContent)).toEqual([
        "不留校",
        "3:30 PM",
        "4:00 PM",
        "5:00 PM",
      ]);
    }
  });

  it("reveals weekday dinner choices only when dinner is required and clears hidden days", () => {
    renderProfile();

    const dinnerRequired = screen.getByRole("combobox", { name: "是否需要晚餐" });
    expect(within(dinnerRequired).getAllByRole("option").map((option) => option.textContent))
      .toEqual(["请选择", "不需要", "需要"]);
    expect(screen.queryByRole("combobox", { name: "星期一晚餐" }))
      .not.toBeInTheDocument();

    fireEvent.change(dinnerRequired, { target: { value: "需要" } });
    for (const day of ["星期一", "星期二", "星期三", "星期四", "星期五"]) {
      const dinner = screen.getByRole("combobox", { name: `${day}晚餐` });
      expect(dinner).toHaveValue("不需要");
      expect(within(dinner).getAllByRole("option").map((option) => option.textContent))
        .toEqual(["不需要", "需要"]);
    }

    fireEvent.change(screen.getByRole("combobox", { name: "星期一晚餐" }), {
      target: { value: "需要" },
    });
    expect(screen.getByRole("combobox", { name: "星期一晚餐" })).toHaveValue("需要");

    fireEvent.change(dinnerRequired, { target: { value: "不需要" } });
    expect(screen.queryByRole("combobox", { name: "星期一晚餐" }))
      .not.toBeInTheDocument();

    fireEvent.change(dinnerRequired, { target: { value: "需要" } });
    expect(screen.getByRole("combobox", { name: "星期一晚餐" })).toHaveValue("不需要");
  });

  it("preserves non-catalog values as existing profile choices", () => {
    renderProfile(student({
      profile: {
        ...EMPTY_PROFILE,
        school: "其他学校",
        schoolClass: "3Z",
        pickupMethod: "Van",
        vanDriver: "其他司机",
        lateStayMonday: "18:00",
      },
    }));

    expect(screen.getByRole("combobox", { name: "学校" })).toHaveValue("其他学校");
    expect(screen.getByRole("option", { name: "其他学校（现有资料）" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "学校班级" })).toHaveValue("3Z");
    expect(screen.getByRole("option", { name: "3Z（现有资料）" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Van 司机" })).toHaveValue("其他司机");
    expect(screen.getByRole("option", { name: "其他司机（现有资料）" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "星期一" })).toHaveValue("18:00");
    expect(screen.getByRole("option", { name: "18:00（现有资料）" })).toBeInTheDocument();
  });
});
