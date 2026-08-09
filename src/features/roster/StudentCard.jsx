import { EVENT_BUTTONS } from "../../domain/attendance.js";
import {
  studentProfileLabels,
  studentSchoolSummary,
} from "./studentProfileLabels.js";

export function StudentCard({
  student,
  activeEvents = [],
  selected,
  saveState,
  onSelect,
  onToggleEvent,
  onRetry,
}) {
  const saving = saveState?.status === "saving";
  const eventSet = new Set(activeEvents);
  const schoolSummary = studentSchoolSummary(student.profile);
  const profileLabels = studentProfileLabels(student.profile);

  return (
    <article
      className={`student-card${selected ? " student-card--selected" : ""}`}
      data-testid="student-card"
    >
      <header className="student-card__header">
        <div className="student-card__identity-area">
          <button
            className="student-card__identity"
            type="button"
            aria-label={`选择 ${student.name}`}
            aria-pressed={selected}
            onClick={() => onSelect(student.id)}
          >
            <span className="student-card__name-line">
              <strong>{student.name}</strong>
              <span className="student-card__grade">{student.grade}</span>
            </span>
            {schoolSummary ? (
              <span className="student-card__school">{schoolSummary}</span>
            ) : null}
          </button>
          {profileLabels.length > 0 ? (
            <div
              aria-label={`${student.name} 资料标签`}
              className="student-card__labels"
              role="list"
            >
              {profileLabels.map((label) => (
                <span
                  aria-label={label.ariaLabel}
                  className={`profile-label profile-label--${label.kind}`}
                  key={label.kind}
                  role="listitem"
                >
                  <span aria-hidden="true" className="profile-label__icon">{label.icon}</span>
                  <span className="profile-label__text">{label.text}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="student-card__pickup">
          <span>接送</span>
          <strong>{student.profile?.usualPickupTime || "未填写"}</strong>
          {student.profile?.pickupMethod ? <small>{student.profile.pickupMethod}</small> : null}
        </div>
      </header>

      <div className="event-grid" aria-label={`${student.name} 今日点名`}>
        {EVENT_BUTTONS.map(([code, label]) => (
          <button
            className="event-button"
            key={code}
            type="button"
            aria-pressed={eventSet.has(code)}
            disabled={saving}
            onClick={() => onToggleEvent(student.id, code)}
          >
            {label}
          </button>
        ))}
      </div>

      <footer className="student-card__footer">
        <div className="student-card__footer-actions">
          <button
            className="profile-shortcut-button"
            type="button"
            aria-label={`填写 ${student.name} 资料`}
            onClick={() => onSelect(student.id)}
          >
            填写资料
          </button>
        </div>
        <div className="student-card__save-state" role="status">
          {saveState?.status === "saving" ? "保存中…" : null}
          {saveState?.status === "saved" ? "已保存" : null}
          {saveState?.status === "error" ? (
            <>
              <span>保存失败</span>
              <button className="retry-button" type="button" onClick={() => onRetry(student.id)}>
                重试
              </button>
            </>
          ) : null}
        </div>
      </footer>
    </article>
  );
}
