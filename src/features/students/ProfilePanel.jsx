import { useEffect, useRef, useState } from "react";
import { rosterApi } from "../../api/client.js";
import {
  EMPTY_PROFILE,
  normalizeProfile,
} from "../../domain/profile.js";
import { StudentProfileFields } from "./StudentProfileFields.jsx";

export function ProfilePanel({
  panelRef,
  branchCode,
  groupCode,
  student,
  noResults,
  onSaved,
  onOpenMessages,
}) {
  const [values, setValues] = useState(EMPTY_PROFILE);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const requestGeneration = useRef(0);
  const activeStudentId = useRef(student?.id ?? null);

  if (activeStudentId.current !== (student?.id ?? null)) {
    activeStudentId.current = student?.id ?? null;
    requestGeneration.current += 1;
  }

  useEffect(() => {
    setValues(student ? normalizeProfile(student.profile) : { ...EMPTY_PROFILE });
    setStatus("idle");
    setError("");
  }, [student?.id]);

  async function save(event) {
    event.preventDefault();
    if (!student || status === "saving") return;
    const request = ++requestGeneration.current;
    const studentId = student.id;
    setStatus("saving");
    setError("");
    try {
      const updated = await rosterApi.saveProfile({
        branchCode,
        groupCode,
        studentId: student.id,
        updatedAt: student.updatedAt,
        profile: values,
      });
      if (
        request !== requestGeneration.current ||
        studentId !== activeStudentId.current
      ) {
        return;
      }
      onSaved(updated);
      setStatus("saved");
    } catch {
      if (
        request !== requestGeneration.current ||
        studentId !== activeStudentId.current
      ) {
        return;
      }
      setStatus("error");
      setError("资料保存失败，请重试");
    }
  }

  return (
    <section ref={panelRef} className="profile-panel" aria-labelledby="profile-title">
      <div className="profile-panel__heading">
        <div>
          <span className="eyebrow">学生资料</span>
          <h2 id="profile-title">{student?.name ?? "请选择学生"}</h2>
        </div>
        {student ? (
          <button className="secondary-button" type="button" onClick={onOpenMessages}>
            写留言
          </button>
        ) : null}
      </div>

      {noResults ? <p className="profile-panel__empty">找不到学生</p> : null}

      <form className="profile-form" onSubmit={save}>
        <StudentProfileFields
          grade={student?.grade ?? ""}
          values={values}
          disabled={!student || status === "saving"}
          fieldTestId="profile-field"
          onChange={(field, value) => setValues((current) => ({
            ...current,
            [field]: value,
          }))}
        />
        {student ? (
          <div className="profile-form__actions">
            <button className="primary-button" type="submit" disabled={status === "saving"}>
              {status === "saving" ? "保存中…" : "保存学生资料"}
            </button>
            <span className="profile-form__status" role="status">
              {status === "saved" ? "资料已保存" : error}
            </span>
          </div>
        ) : null}
      </form>
    </section>
  );
}
