import { EMPTY_SUMMARY } from "../../domain/attendance.js";

const SUMMARY_ITEMS = [
  ["expected", "应到"],
  ["arrived", "已到"],
  ["notArrived", "未到"],
  ["absent", "缺席"],
  ["unmarked", "未标记"],
];

export function SummaryBar({ summary = EMPTY_SUMMARY, loading = false }) {
  return (
    <section className="summary-bar" aria-label="当前班级统计" aria-busy={loading}>
      {SUMMARY_ITEMS.map(([key, label]) => (
        <div className="summary-bar__item" key={key}>
          <span>{label}</span>
          <strong>{summary[key] ?? 0}</strong>
          <span className="sr-only">{`${label} ${summary[key] ?? 0}`}</span>
        </div>
      ))}
    </section>
  );
}
