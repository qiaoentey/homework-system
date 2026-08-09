import { describe, expect, it } from "vitest";
import { dailyAttendanceResult, primaryStatusFor } from "../../shared/dailyAttendance.js";
import { EVENT_BUTTONS, nextAttendanceEvents } from "../../src/domain/attendance.js";

describe("daily primary attendance contract", () => {
  it("uses the approved point-marking order and makes primary statuses exclusive", () => {
    expect(EVENT_BUTTONS.map(([code]) => code)).toEqual([
      "arrive",
      "absent",
      "koko",
      "shower",
      "meal",
      "homework",
      "supplement",
    ]);
    expect(nextAttendanceEvents(["arrive", "meal"], "koko", true))
      .toEqual(["meal", "koko"]);
    expect(nextAttendanceEvents(["koko", "shower"], "absent", true))
      .toEqual(["shower", "absent"]);
  });

  it("classifies legacy conflicts by absent, arrive, then KOKO", () => {
    expect(primaryStatusFor(["arrive", "absent", "koko"])).toBe("absent");
    expect(primaryStatusFor(["arrive", "koko"])).toBe("arrived");
    expect(primaryStatusFor(["koko"])).toBe("koko");
    expect(primaryStatusFor([])).toBe("unmarked");
  });

  it("calculates the six approved totals and one status per student", () => {
    expect(dailyAttendanceResult([
      { id: "a", name: "ARRIVED", grade: "Y1", events: ["arrive"] },
      { id: "b", name: "ABSENT", grade: "Y2", events: ["absent"] },
      { id: "c", name: "KOKO", grade: "Y3", events: ["koko"] },
      { id: "d", name: "UNMARKED", grade: "Y4", events: [] },
    ])).toEqual({
      summary: {
        expected: 4,
        arrived: 1,
        notArrived: 2,
        absent: 1,
        koko: 1,
        unmarked: 1,
      },
      students: [
        { id: "a", name: "ARRIVED", grade: "Y1", status: "arrived" },
        { id: "b", name: "ABSENT", grade: "Y2", status: "absent" },
        { id: "c", name: "KOKO", grade: "Y3", status: "koko" },
        { id: "d", name: "UNMARKED", grade: "Y4", status: "unmarked" },
      ],
    });
  });
});
