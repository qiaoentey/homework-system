// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    expect(schoolClassesFor("MK", "幼儿园", "Y3")).toEqual([]);
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
      "幼儿园",
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

    fireEvent.change(school, { target: { value: "幼儿园" } });
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
    for (const day of ["星期一", "星期二", "星期三", "星期四", "星期五"]) {
      const vanTime = screen.getByRole("combobox", { name: `${day} Van 时间` });
      expect(within(vanTime).getAllByRole("option").map((option) => option.textContent)).toEqual([
        "不需要",
        "5:30 PM",
        "7:00 PM",
        "8:45 PM",
      ]);
      expect(vanTime).toHaveValue("");
    }
    fireEvent.change(screen.getByRole("combobox", { name: "星期一 Van 时间" }), {
      target: { value: "17:30" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "星期三 Van 时间" }), {
      target: { value: "19:00" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "星期五 Van 时间" }), {
      target: { value: "20:45" },
    });
    expect(screen.getByRole("combobox", { name: "星期一 Van 时间" })).toHaveValue("17:30");
    expect(screen.getByRole("combobox", { name: "星期三 Van 时间" })).toHaveValue("19:00");
    expect(screen.getByRole("combobox", { name: "星期五 Van 时间" })).toHaveValue("20:45");
    expect(screen.queryByRole("combobox", { name: "Van 载送时间" })).not.toBeInTheDocument();

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

  it("shows legacy Van weekdays with their saved shared return time", () => {
    renderProfile(student({
      profile: {
        ...EMPTY_PROFILE,
        pickupMethod: "Van",
        vanHomeTime: "19:00",
        vanMonday: "需要",
        vanWednesday: "需要",
      },
    }));

    expect(screen.getByRole("combobox", { name: "星期一 Van 时间" })).toHaveValue("19:00");
    expect(screen.getByRole("combobox", { name: "星期二 Van 时间" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "星期三 Van 时间" })).toHaveValue("19:00");
  });

  it("replaces 3:30 PM with 3:20 PM for every MK 二校 stay-time selector", () => {
    renderProfile(student({
      branchCode: "MK",
      groupCode: "MK HAPPY",
      profile: { ...EMPTY_PROFILE, school: "二校" },
    }), "MK");

    for (const day of ["星期一", "星期二", "星期三", "星期四", "星期五"]) {
      expect(within(screen.getByRole("combobox", { name: day }))
        .getAllByRole("option").map((option) => option.textContent)).toEqual([
        "不留校",
        "3:20 PM",
        "4:00 PM",
        "5:00 PM",
      ]);
    }
  });

  it("adds 2:00 PM to every MK 启智 stay-time selector", () => {
    renderProfile(student({
      branchCode: "MK",
      groupCode: "MK HAPPY",
      profile: { ...EMPTY_PROFILE, school: "启智" },
    }), "MK");

    for (const day of ["星期一", "星期二", "星期三", "星期四", "星期五"]) {
      expect(within(screen.getByRole("combobox", { name: day }))
        .getAllByRole("option").map((option) => option.textContent)).toEqual([
        "不留校",
        "2:00 PM",
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
      .toEqual(["请选择司机", ...sharedDrivers, "Aunty Airine"]);
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
        .toEqual(["不需要", "小", "大"]);
    }

    fireEvent.change(screen.getByRole("combobox", { name: "星期一晚餐" }), {
      target: { value: "小" },
    });
    expect(screen.getByRole("combobox", { name: "星期一晚餐" })).toHaveValue("小");

    fireEvent.change(dinnerRequired, { target: { value: "不需要" } });
    expect(screen.queryByRole("combobox", { name: "星期一晚餐" }))
      .not.toBeInTheDocument();

    fireEvent.change(dinnerRequired, { target: { value: "需要" } });
    expect(screen.getByRole("combobox", { name: "星期一晚餐" })).toHaveValue("不需要");
  });

  it("keeps a legacy dinner requirement visible until a teacher chooses a portion", () => {
    renderProfile(student({
      profile: {
        ...EMPTY_PROFILE,
        dinnerRequired: "需要",
        dinnerMonday: "需要",
      },
    }));

    const monday = screen.getByRole("combobox", { name: "星期一晚餐" });
    expect(monday).toHaveValue("需要");
    expect(within(monday).getAllByRole("option").map((option) => option.textContent))
      .toEqual(["不需要", "小", "大", "需要（未选大小）"]);
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
        vanHomeTime: "17:00",
        vanMonday: "17:00",
        lateStayMonday: "18:00",
      },
    }));

    expect(screen.getByRole("combobox", { name: "学校" })).toHaveValue("其他学校");
    expect(screen.getByRole("option", { name: "其他学校（现有资料）" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "学校班级" })).toHaveValue("3Z");
    expect(screen.getByRole("option", { name: "3Z（现有资料）" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Van 司机" })).toHaveValue("其他司机");
    expect(screen.getByRole("option", { name: "其他司机（现有资料）" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "星期一 Van 时间" })).toHaveValue("17:00");
    expect(screen.getByRole("option", { name: "17:00（现有资料）" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "星期一" })).toHaveValue("18:00");
    expect(screen.getByRole("option", { name: "18:00（现有资料）" })).toBeInTheDocument();
  });

  it("records multiple detention choices while keeping not-allowed mutually exclusive", async () => {
    let submittedProfile;
    vi.stubGlobal("fetch", vi.fn(async (_url, options = {}) => {
      submittedProfile = JSON.parse(options.body).profile;
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify(student({ profile: submittedProfile }));
        },
      };
    }));
    renderProfile();

    expect(screen.queryByRole("combobox", { name: "留堂" })).not.toBeInTheDocument();
    const spelling = screen.getByRole("checkbox", { name: "听写留堂" });
    const homework = screen.getByRole("checkbox", { name: "功课留堂" });
    const notAllowed = screen.getByRole("checkbox", { name: "不可以留堂" });

    fireEvent.click(spelling);
    fireEvent.click(homework);
    expect(spelling).toBeChecked();
    expect(homework).toBeChecked();
    expect(notAllowed).not.toBeChecked();

    fireEvent.click(notAllowed);
    expect(spelling).not.toBeChecked();
    expect(homework).not.toBeChecked();
    expect(notAllowed).toBeChecked();

    fireEvent.click(spelling);
    fireEvent.click(homework);
    expect(spelling).toBeChecked();
    expect(homework).toBeChecked();
    expect(notAllowed).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "保存学生资料" }));
    await waitFor(() => expect(submittedProfile?.detentionType)
      .toBe("听写留堂|功课留堂"));
  });

  it("records multiple special notes and custom note text", () => {
    renderProfile();

    for (const note of [
      "高c",
      "一定要每天拍照功课进群组给家长",
      "来不及完成功课一定要通知家长",
    ]) {
      const checkbox = screen.getByRole("checkbox", { name: note, exact: true });
      expect(checkbox).not.toBeChecked();
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
    }

    const other = screen.getByRole("textbox", { name: "其他备注" });
    fireEvent.change(other, { target: { value: "放学前提醒带水壶" } });
    expect(other).toHaveValue("放学前提醒带水壶");
  });

  it("records whether the student needs a shower", () => {
    renderProfile();

    const shower = screen.getByRole("combobox", { name: "洗澡" });
    expect(within(shower).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "请选择",
      "需要",
      "不需要",
    ]);
    fireEvent.change(shower, { target: { value: "不需要" } });
    expect(shower).toHaveValue("不需要");
  });
});
