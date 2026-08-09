import { useCallback, useEffect, useMemo, useState } from "react";
import { rosterApi } from "../../api/client.js";

const FILTERS = [
  ["ALL", "全部"],
  ["MK", "MK"],
  ["STP", "STP"],
  ["WS", "WS"],
];

const METRICS = [
  ["expected", "应到"],
  ["arrived", "已到"],
  ["notArrived", "还没有"],
  ["absent", "缺席"],
  ["koko", "KOKO"],
  ["unmarked", "未点"],
];

const STATUS_LABELS = {
  arrived: "已到",
  absent: "缺席",
  koko: "KOKO",
  unmarked: "未点",
};

function localToday() {
  const today = new Date();
  const year = String(today.getFullYear()).padStart(4, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DashboardScreen({ date = localToday(), onBack }) {
  const [dashboard, setDashboard] = useState(null);
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [expandedGroups, setExpandedGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDashboard(await rosterApi.dashboard({ date }));
    } catch {
      setError("Dashboard 载入失败，请重试");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const visibleGroups = useMemo(() => (
    (dashboard?.groups ?? []).filter((group) => (
      branchFilter === "ALL" || group.branchCode === branchFilter
    ))
  ), [branchFilter, dashboard]);

  function toggleGroup(groupCode) {
    setExpandedGroups((current) => (
      current.includes(groupCode)
        ? current.filter((code) => code !== groupCode)
        : [...current, groupCode]
    ));
  }

  return (
    <section className="dashboard-screen">
      <div className="dashboard-screen__actions">
        <button aria-label="返回分院" className="back-button" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span>
          返回分院
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={loading}
          onClick={loadDashboard}
        >
          {loading ? "载入中…" : "刷新"}
        </button>
      </div>

      <header className="dashboard-screen__heading">
        <div>
          <span className="eyebrow">当天点名总览</span>
          <h1>Dashboard</h1>
          <p>{date} · 每个托育班当天状态</p>
        </div>
      </header>

      <div className="dashboard-filters" role="group" aria-label="分院筛选">
        {FILTERS.map(([code, label]) => (
          <button
            aria-pressed={branchFilter === code}
            key={code}
            type="button"
            onClick={() => setBranchFilter(code)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && !dashboard ? (
        <div className="dashboard-error" role="alert">
          <p>{error}</p>
          <button className="primary-button" type="button" onClick={loadDashboard}>
            重新载入
          </button>
        </div>
      ) : null}

      {loading && !dashboard ? (
        <div className="dashboard-loading" role="status">正在载入 Dashboard…</div>
      ) : null}

      {dashboard ? (
        <div className="dashboard-groups">
          {visibleGroups.map((group) => {
            const expanded = expandedGroups.includes(group.groupCode);
            const title = `${group.branchCode} ${group.groupLabel}`;
            return (
              <article
                aria-label={title}
                className="dashboard-group"
                key={group.groupCode}
              >
                <button
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "收起" : "展开"} ${title} 名单`}
                  className="dashboard-group__toggle"
                  type="button"
                  onClick={() => toggleGroup(group.groupCode)}
                >
                  <span>
                    <small>{group.branchCode}</small>
                    <strong>{group.groupLabel}</strong>
                  </span>
                  <span aria-hidden="true">{expanded ? "−" : "+"}</span>
                </button>

                <div className="dashboard-metrics" aria-label={`${title} 当天统计`}>
                  {METRICS.map(([key, label]) => (
                    <div className={`dashboard-metric dashboard-metric--${key}`} key={key}>
                      <span>{label}</span>
                      <strong>{group.summary[key] ?? 0}</strong>
                    </div>
                  ))}
                </div>

                {expanded ? (
                  <ul className="dashboard-students">
                    {group.students.length ? group.students.map((student) => (
                      <li className={`dashboard-student dashboard-student--${student.status}`} key={student.id}>
                        <strong>{student.name}</strong>
                        <span>{student.grade} · {STATUS_LABELS[student.status]}</span>
                      </li>
                    )) : (
                      <li className="dashboard-students__empty">这个班目前没有在读学生</li>
                    )}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
