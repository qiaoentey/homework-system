export const EVENT_BUTTONS = [
  ["arrive", "到"],
  ["absent", "缺席"],
  ["shower", "冲"],
  ["meal", "餐"],
  ["homework", "功"],
  ["supplement", "补"],
  ["review", "复"],
  ["koko", "KOKO"],
];

export function nextAttendanceEvents(previous, eventCode, active) {
  const opposite = eventCode === "arrive"
    ? "absent"
    : eventCode === "absent"
      ? "arrive"
      : null;
  const withoutCurrent = previous.filter((code) => code !== eventCode);
  if (!active) return withoutCurrent;
  const compatible = opposite
    ? withoutCurrent.filter((code) => code !== opposite)
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
