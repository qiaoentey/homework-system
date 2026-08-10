import { useRef, useState } from "react";
import {
  ABSENCE_REASON_OPTIONS,
  normalizeAbsenceReason,
} from "../../../shared/absenceReasons.js";
import { LifecycleDialog } from "../students/LifecycleDialog.jsx";

export function AbsenceReasonDialog({ studentName, onConfirm, onClose }) {
  const [choice, setChoice] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const firstOptionRef = useRef(null);
  const reason = choice === "其他" ? normalizeAbsenceReason(otherReason) : choice;

  function submit(event) {
    event.preventDefault();
    if (!reason) return;
    onConfirm(reason);
  }

  return (
    <LifecycleDialog
      title="选择缺席原因"
      titleId="absence-reason-title"
      initialFocusRef={firstOptionRef}
      onClose={onClose}
    >
      <form className="absence-reason-form" onSubmit={submit}>
        <p><strong>{studentName}</strong> 今天为什么缺席？</p>
        <fieldset className="absence-reason-options">
          <legend>缺席原因</legend>
          {ABSENCE_REASON_OPTIONS.map((option, index) => (
            <label key={option}>
              <input
                ref={index === 0 ? firstOptionRef : null}
                checked={choice === option}
                name="absenceReason"
                type="radio"
                value={option}
                onChange={() => setChoice(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
        {choice === "其他" ? (
          <label className="absence-reason-other">
            <span>其他原因</span>
            <input
              autoFocus
              maxLength={100}
              type="text"
              value={otherReason}
              onChange={(event) => setOtherReason(event.target.value)}
            />
          </label>
        ) : null}
        <button className="primary-button" disabled={!reason} type="submit">
          确认缺席
        </button>
      </form>
    </LifecycleDialog>
  );
}
