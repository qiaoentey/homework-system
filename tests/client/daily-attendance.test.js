import { describe, expect, it } from "vitest";
import { dailyAttendanceResult, primaryStatusFor } from "../../shared/dailyAttendance.js";
import { EVENT_BUTTONS, nextAttendanceEvents } from "../../src/domain/attendance.js";

describe("daily primary attendance contract", () => {
  it("uses the approved point-marking order and makes primary statuses exclusive", () => {
    expect(EVENT_BUTTONS.map(([code]) => code)).toEqual([
      "arrive",
      "absent",
      "shower",
      "meal",
      "homework",
      "supplement",
    ]);
    expect(nextAttendanceEvents(["arrive", "meal"], "absent", true))
      .toEqual(["meal", "absent"]);
  });

  it("classifies legacy KOKO-only records as unmarked", () => {
    expect(primaryStatusFor(["arrive", "absent", "koko"])).toBe("absent");
    expect(primaryStatusFor(["arrive", "koko"])).toBe("arrived");
    expect(primaryStatusFor(["koko"])).toBe("unmarked");
    expect(primaryStatusFor([])).toBe("unmarked");
  });

  it("calculates the five approved totals and one status per student", () => {
    expect(dailyAttendanceResult([
      {
        id: "a",
        name: "ARRIVED",
        grade: "Y1",
        events: ["supplement", "arrive", "homework", "meal", "shower"],
      },
      { id: "b", name: "ABSENT", grade: "Y2", events: ["absent"] },
      { id: "c", name: "KOKO", grade: "Y3", events: ["koko"] },
      { id: "d", name: "UNMARKED", grade: "Y4", events: [] },
    ])).toEqual({
      summary: {
        expected: 4,
        arrived: 1,
        notArrived: 2,
        absent: 1,
        unmarked: 2,
      },
      students: [
        {
          id: "a",
          name: "ARRIVED",
          grade: "Y1",
          status: "arrived",
          events: ["arrive", "shower", "meal", "homework", "supplement"],
        },
        { id: "b", name: "ABSENT", grade: "Y2", status: "absent", events: ["absent"] },
        { id: "c", name: "KOKO", grade: "Y3", status: "unmarked", events: [] },
        { id: "d", name: "UNMARKED", grade: "Y4", status: "unmarked", events: [] },
      ],
    });
  });
});
