import { useEffect, useRef, useState } from "react";
import { rosterApi } from "../../api/client.js";
import {
  EMPTY_PROFILE,
} from "../../domain/profile.js";
import { STUDENT_GRADE_OPTIONS } from "../../domain/profileOptions.js";
import { LifecycleDialog } from "./LifecycleDialog.jsx";
import { StudentProfileFields } from "./StudentProfileFields.jsx";

export function EnrolDialog({
  branchCode,
  groupCode,
  groups,
  onClose,
  onEnrolled,
}) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(groupCode);
  const [profile, setProfile] = useState({ ...EMPTY_PROFILE });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const nameRef = useRef(null);
  const enrolmentKeyRef = useRef(crypto.randomUUID());
  const activeRef = useRef(true);
  const scopeRef = useRef(`${branchCode}\u0000${groupCode}`);
  scopeRef.current = `${branchCode}\u0000${groupCode}`;

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  const valid = Boolean(name.trim() && grade && selectedGroup);

  async function submit(event) {
    event.preventDefault();
    if (!valid || status === "saving") return;
    const requestScope = scopeRef.current;
    setStatus("saving");
    setError("");
    try {
      const created = await rosterApi.enrolStudent({
        branchCode,
        groupCode: selectedGroup,
        name: name.trim(),
        grade,
        profile,
        enrolmentKey: enrolmentKeyRef.current,
      });
      if (!activeRef.current || requestScope !== scopeRef.current) return;
      onEnrolled(created);
    } catch {
      if (!activeRef.current || requestScope !== scopeRef.current) return;
      setStatus("error");
      setError("学生加入失败，请检查资料后重试");
    }
  }

  return (
    <LifecycleDialog
      title="Enrol 学生"
      titleId="enrol-title"
      initialFocusRef={nameRef}
      onClose={onClose}
    >
      <form className="lifecycle-form" onSubmit={submit}>
        <div className="lifecycle-form__grid lifecycle-form__grid--identity">
          <label>
            <span>学生姓名</span>
            <input
              ref={nameRef}
              required
              disabled={status === "saving"}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            <span>年级</span>
            <select
              required
              disabled={status === "saving"}
              value={grade}
              onChange={(event) => {
                setGrade(event.target.value);
                setProfile((current) => ({ ...current, schoolClass: "" }));
              }}
            >
              <option value="">请选择年级</option>
              {STUDENT_GRADE_OPTIONS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span>老师班级</span>
            <select
              required
              disabled={status === "saving"}
              value={selectedGroup}
              onChange={(event) => setSelectedGroup(event.target.value)}
            >
              {groups.map((group) => (
                <option key={group.code} value={group.code}>{group.code}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="lifecycle-form__profile">
          <legend>学生个人资料</legend>
          <StudentProfileFields
            branchCode={branchCode}
            grade={grade}
            values={profile}
            disabled={status === "saving"}
            fieldTestId="enrol-profile-field"
            onChange={(field, value) => setProfile((current) => ({
              ...current,
              [field]: value,
            }))}
          />
        </fieldset>

        <p className="form-error" role="alert">{error}</p>
        <button
          className="primary-button"
          type="submit"
          disabled={!valid || status === "saving"}
        >
          {status === "saving" ? "保存中…" : "保存学生"}
        </button>
      </form>
    </LifecycleDialog>
  );
}
