export const PRIMARY_ATTENDANCE_EVENTS = ["arrive", "absent", "koko"];

const STATUS_PRIORITY = [
  ["absent", "absent"],
  ["arrive", "arrived"],
  ["koko", "koko"],
];

export function primaryStatusFor(events) {
  const active = new Set(events ?? []);
  return STATUS_PRIORITY.find(([eventCode]) => active.has(eventCode))?.[1] ?? "unmarked";
}

export function dailyAttendanceResult(students) {
  const summary = {
    expected: students.length,
    arrived: 0,
    notArrived: 0,
    absent: 0,
    koko: 0,
    unmarked: 0,
  };
  const items = students.map(({ id, name, grade, events }) => {
    const status = primaryStatusFor(events);
    summary[status] += 1;
    return { id, name, grade, status };
  });
  summary.notArrived = summary.koko + summary.unmarked;
  return { summary, students: items };
}
