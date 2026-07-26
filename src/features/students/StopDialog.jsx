import { useEffect, useRef, useState } from "react";
import { rosterApi } from "../../api/client.js";
import { LifecycleDialog } from "./LifecycleDialog.jsx";

const GRADES = [
  "K1", "K2", "K1+K2", "F1", "F2", "F3",
  "Y1", "Y2", "Y3", "Y4", "Y5", "Y6",
  "幼儿班", "一年级", "二年级", "三年级", "四年级", "五年级", "六年级",
];

function identity(student) {
  return `${student.name} · ${student.grade} · ${student.groupCode}`;
}

export function StopDialog({
  branchCode,
  groupCode,
  groups,
  onClose,
  onStopped,
}) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(groupCode);
  const [candidates, setCandidates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const nameRef = useRef(null);
  const activeRef = useRef(true);
  const requestGeneration = useRef(0);
  const scopeRef = useRef(`${branchCode}\u0000${groupCode}`);
  scopeRef.current = `${branchCode}\u0000${groupCode}`;

  useEffect(() => () => {
    activeRef.current = false;
    requestGeneration.current += 1;
  }, []);

  const selected = candidates.find((student) => student.id === selectedId) ?? null;
  const valid = Boolean(name.trim() && grade && selectedGroup);

  function resetResolution(update) {
    update();
    requestGeneration.current += 1;
    setCandidates([]);
    setSelectedId("");
    setError("");
    setStatus("idle");
  }

  async function findStudent(event) {
    event.preventDefault();
    if (!valid || status === "loading" || status === "saving") return;
    const request = ++requestGeneration.current;
    const requestScope = scopeRef.current;
    setStatus("loading");
    setError("");
    setCandidates([]);
    setSelectedId("");
    try {
      const response = await rosterApi.findStudents({
        branchCode,
        groupCode: selectedGroup,
        status: "active",
        search: name.trim(),
      });
      if (
        !activeRef.current ||
        request !== requestGeneration.current ||
        requestScope !== scopeRef.current
      ) return;
      const exact = response.items.filter((student) => (
        student.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase() &&
        student.grade.trim().toLocaleLowerCase() === grade.trim().toLocaleLowerCase() &&
        student.groupCode === selectedGroup
      ));
      setCandidates(exact);
      if (exact.length === 1) setSelectedId(exact[0].id);
      if (!exact.length) {
        setError("找不到符合姓名、年级和老师班级的学生");
        setStatus("error");
      } else {
        setStatus("resolved");
      }
    } catch {
      if (
        !activeRef.current ||
        request !== requestGeneration.current ||
        requestScope !== scopeRef.current
      ) return;
      setStatus("error");
      setError("学生查找失败，请重试");
    }
  }

  async function confirm() {
    if (!selected || status === "saving") return;
    const request = ++requestGeneration.current;
    const requestScope = scopeRef.current;
    setStatus("saving");
    setError("");
    try {
      const stopped = await rosterApi.stopStudent({
        branchCode,
        groupCode: selected.groupCode,
        studentId: selected.id,
        name: selected.name,
        grade: selected.grade,
      });
      if (
        !activeRef.current ||
        request !== requestGeneration.current ||
        requestScope !== scopeRef.current
      ) return;
      onStopped(stopped);
    } catch {
      if (
        !activeRef.current ||
        request !== requestGeneration.current ||
        requestScope !== scopeRef.current
      ) return;
      setStatus("error");
      setError("学生停补失败，请重新确认后重试");
    }
  }

  return (
    <LifecycleDialog
      title="停补学生"
      titleId="stop-title"
      initialFocusRef={nameRef}
      onClose={onClose}
    >
      <form className="lifecycle-form" onSubmit={findStudent}>
        <div className="lifecycle-form__grid lifecycle-form__grid--identity">
          <label>
            <span>学生姓名</span>
            <input
              ref={nameRef}
              required
              disabled={status === "loading" || status === "saving"}
              value={name}
              onChange={(event) => resetResolution(() => setName(event.target.value))}
            />
          </label>
          <label>
            <span>年级</span>
            <select
              required
              disabled={status === "loading" || status === "saving"}
              value={grade}
              onChange={(event) => resetResolution(() => setGrade(event.target.value))}
            >
              <option value="">请选择年级</option>
              {GRADES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>老师班级</span>
            <select
              required
              disabled={status === "loading" || status === "saving"}
              value={selectedGroup}
              onChange={(event) => resetResolution(() => setSelectedGroup(event.target.value))}
            >
              {groups.map((group) => (
                <option key={group.code} value={group.code}>{group.code}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="secondary-button"
          type="submit"
          disabled={!valid || status === "loading" || status === "saving"}
        >
          {status === "loading" ? "查找中…" : "查找学生"}
        </button>
      </form>

      {candidates.length > 1 ? (
        <fieldset className="candidate-list">
          <legend>找到多位学生，请选择正确的学生</legend>
          {candidates.map((student) => (
            <label key={student.id}>
              <input
                type="radio"
                name="stop-candidate"
                value={student.id}
                checked={selectedId === student.id}
                disabled={status === "saving"}
                onChange={() => setSelectedId(student.id)}
              />
              <span>{identity(student)} · {student.id}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {selected ? (
        <div className="lifecycle-confirmation">
          <span>请确认停补学生</span>
          <strong>{identity(selected)}</strong>
        </div>
      ) : null}

      <p className="form-error" role="alert">{error}</p>
      <button
        className="primary-button lifecycle-dialog__confirm"
        type="button"
        disabled={!selected || status === "saving"}
        onClick={confirm}
      >
        {status === "saving" ? "停补中…" : "确认停补"}
      </button>
    </LifecycleDialog>
  );
}
