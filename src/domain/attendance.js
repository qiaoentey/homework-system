import { PRIMARY_ATTENDANCE_EVENTS } from "../../shared/dailyAttendance.js";

export const EVENT_BUTTONS = [
  ["arrive", "到"],
  ["absent", "缺席"],
  ["koko", "KOKO"],
  ["shower", "冲"],
  ["meal", "餐"],
  ["homework", "功"],
  ["supplement", "补"],
];

export function nextAttendanceEvents(previous, eventCode, active) {
  const withoutCurrent = previous.filter((code) => code !== eventCode);
  if (!active) return withoutCurrent;
  const compatible = PRIMARY_ATTENDANCE_EVENTS.includes(eventCode)
    ? withoutCurrent.filter((code) => !PRIMARY_ATTENDANCE_EVENTS.includes(code))
    : withoutCurrent;
  return [...compatible, eventCode];
}

export const EMPTY_SUMMARY = {
  expected: 0,
  arrived: 0,
  notArrived: 0,
  absent: 0,
  koko: 0,
  unmarked: 0,
};
