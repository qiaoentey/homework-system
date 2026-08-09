// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { schoolClassesFor } from "../../src/domain/profileOptions.js";
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
  careProgram: "",
  homeworkArrivalTime: "",
  homeworkDepartureTime: "",
  homeworkMonday: "",
  homeworkTuesday: "",
  homeworkWednesday: "",
  homeworkThursday: "",
  homeworkFriday: "",
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

function renderProfile(selectedStudent = student(), branchCode = "WS") {
  render(
    <ProfilePanel
      branchCode={branchCode}
      groupCode={branchCode === "MK" ? "MK HAPPY" : "WS HUILING"}
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
  it("uses every exact MK school class supplied for Year 1 through Year 6", () => {
    const classesBySchool = {
      一校: {
        Y1: ["1B", "1M", "1U"],
        Y2: ["2B", "2M", "2U"],
        Y3: ["3J", "3B", "3M", "3U"],
        Y4: ["4B", "4M", "4U"],
        Y5: ["5B", "5M", "5U"],
        Y6: ["6B", "6M", "6U"],
      },
      二校: {
        Y1: ["1W", "1I", "1S"],
        Y2: ["2W", "2I", "2S"],
        Y3: ["3W", "3I", "3S"],
        Y4: ["4W", "4I", "4S"],
        Y5: ["5W", "5I", "5S"],
        Y6: ["6W", "6I", "6S"],
      },
      启智: {
        Y1: ["1C", "1J", "1B"],
        Y2: ["2C", "2J", "2B"],
        Y3: ["3C", "3J", "3B"],
        Y4: ["4C", "4J", "4B"],
        Y5: ["5C", "5J", "5B"],
        Y6: ["6C", "6J", "6B"],
      },
    };

    for (const [school, grades] of Object.entries(classesBySchool)) {
      for (const [grade, expectedClasses] of Object.entries(grades)) {
        expect(schoolClassesFor("MK", school, grade)).toEqual(expectedClasses);
      }
    }
    expect(schoolClassesFor("MK", "南益", "Y3")).toEqual([]);
    expect(schoolClassesFor("MK", "姚贞暖", "Y3")).toEqual([]);
    expect(schoolClassesFor("MK", "一校", "三年级")).toEqual([
      "3J", "3B", "3M", "3U",
    ]);
  });

  it("shows only the approved MK schools and clears a deprecated MK selection", () => {
    renderProfile(student({
      branchCode: "MK",
      groupCode: "MK HAPPY",
      profile: {
        ...EMPTY_PROFILE,
        school: "南益",
        schoolClass: "3K",
      },
    }), "MK");

    const school = screen.getByRole("combobox", { name: "学校" });
    expect(within(school).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "请选择学校",
      "一校",
      "二校",
      "启智",
      "姚贞暖",
    ]);
    expect(school).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "学校班级" })).toHaveValue("");

    fireEvent.change(school, { target: { value: "一校" } });
    expect(within(screen.getByRole("combobox", { name: "学校班级" }))
      .getAllByRole("option").map((option) => option.textContent)).toEqual([
      "请选择学校班级",
      "3J",
      "3B",
      "3M",
      "3U",
    ]);

    fireEvent.change(school, { target: { value: "姚贞暖" } });
    const emptySchoolClass = screen.getByRole("combobox", { name: "学校班级" });
    expect(within(emptySchoolClass).getAllByRole("option").map((option) => (
      option.textContent
    ))).toEqual(["请选择学校班级"]);
    expect(emptySchoolClass).toHaveValue("");
  });

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
      "Uncle Liew",
      "Uncle Chan",
      "Aunty Airine",
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

  it("keeps each branch-specific Van driver list isolated", () => {
    const sharedDrivers = [
      "Tong",
      "Lam",
      "Lim",
      "Kent",
      "Wong",
      "Boon",
      "Aunty Lily",
      "Liew",
    ];
    const mkDrivers = [
      "Mr Kent",
      "Uncle Yeow",
      "Uncle Sam",
      "Uncle Leong",
      "Uncle Ting",
      "Uncle Tan",
      "Uncle Law",
    ];
    const wsDrivers = [
      "Uncle Liew",
      "Uncle Chan",
      "Aunty Airine",
    ];
    renderProfile(student({
      branchCode: "MK",
      groupCode: "MK HAPPY",
      profile: { ...EMPTY_PROFILE, pickupMethod: "Van" },
    }), "MK");

    const mkDriver = screen.getByRole("combobox", { name: "Van 司机" });
    expect(within(mkDriver).getAllByRole("option").map((option) => option.textContent))
      .toEqual(["请选择司机", ...sharedDrivers, ...mkDrivers]);

    cleanup();
    renderProfile(student({
      profile: { ...EMPTY_PROFILE, pickupMethod: "Van" },
    }), "WS");
    const wsDriver = screen.getByRole("combobox", { name: "Van 司机" });
    expect(within(wsDriver).getAllByRole("option").map((option) => option.textContent))
      .toEqual(["请选择司机", ...sharedDrivers, ...wsDrivers]);

    cleanup();
    renderProfile(student({
      branchCode: "STP",
      groupCode: "STP QIAO EN",
      profile: { ...EMPTY_PROFILE, pickupMethod: "Van" },
    }), "STP");
    const stpDriver = screen.getByRole("combobox", { name: "Van 司机" });
    expect(within(stpDriver).getAllByRole("option").map((option) => option.textContent))
      .toEqual(["请选择司机", ...sharedDrivers]);
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

  it("shows a one-tap homework schedule only for homework-class students and clears it when hidden", () => {
    renderProfile();

    const careProgram = screen.getByRole("combobox", { name: "学生类型" });
    expect(within(careProgram).getAllByRole("option").map((option) => option.textContent))
      .toEqual(["请选择", "Full Daycare", "功课班"]);
    expect(screen.queryByLabelText("来校时间")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("回家时间")).not.toBeInTheDocument();

    fireEvent.change(careProgram, { target: { value: "功课班" } });
    const arrival = screen.getByLabelText("来校时间");
    const departure = screen.getByLabelText("回家时间");
    expect(arrival).toHaveAttribute("type", "time");
    expect(departure).toHaveAttribute("type", "time");

    const monday = screen.getByRole("checkbox", { name: "星期一" });
    const wednesday = screen.getByRole("checkbox", { name: "星期三" });
    const friday = screen.getByRole("checkbox", { name: "星期五" });
    expect(monday).not.toBeChecked();
    expect(friday).not.toBeChecked();

    fireEvent.change(arrival, { target: { value: "14:00" } });
    fireEvent.change(departure, { target: { value: "18:00" } });
    fireEvent.click(monday);
    fireEvent.click(wednesday);
    fireEvent.click(friday);
    expect(monday).toBeChecked();
    expect(wednesday).toBeChecked();
    expect(friday).toBeChecked();

    fireEvent.change(careProgram, { target: { value: "Full Daycare" } });
    expect(screen.queryByLabelText("来校时间")).not.toBeInTheDocument();
    fireEvent.change(careProgram, { target: { value: "功课班" } });
    expect(screen.getByLabelText("来校时间")).toHaveValue("");
    expect(screen.getByLabelText("回家时间")).toHaveValue("");
    for (const day of ["星期一", "星期二", "星期三", "星期四", "星期五"]) {
      expect(screen.getByRole("checkbox", { name: day })).not.toBeChecked();
    }
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
