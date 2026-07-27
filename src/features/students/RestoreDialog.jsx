import { useCallback, useEffect, useRef, useState } from "react";
import { rosterApi } from "../../api/client.js";
import { LifecycleDialog } from "./LifecycleDialog.jsx";

function identity(student) {
  return `${student.name} · ${student.grade} · ${student.groupCode}`;
}

export function RestoreDialog({
  branchCode,
  groupCode,
  onClose,
  onRestored,
}) {
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const firstChoiceRef = useRef(null);
  const activeRef = useRef(true);
  const requestGeneration = useRef(0);
  const scopeRef = useRef(`${branchCode}\u0000${groupCode}`);
  scopeRef.current = `${branchCode}\u0000${groupCode}`;

  useEffect(() => () => {
    activeRef.current = false;
    requestGeneration.current += 1;
  }, []);

  const load = useCallback(async () => {
    const request = ++requestGeneration.current;
    const requestScope = scopeRef.current;
    setStatus("loading");
    setError("");
    setStudents([]);
    setSelectedId("");
    try {
      const stoppedById = new Map();
      const seenCursors = new Set();
      let cursor;
      do {
        const response = await rosterApi.findStudents({
          branchCode,
          groupCode,
          status: "stopped",
          search: "",
          cursor,
          limit: 50,
        });
        if (
          !activeRef.current ||
          request !== requestGeneration.current ||
          requestScope !== scopeRef.current
        ) return;
        for (const student of response.items) {
          if (
            student.status === "stopped" &&
            student.branchCode === branchCode &&
            student.groupCode === groupCode
          ) {
            stoppedById.set(student.id, student);
          }
        }
        cursor = response.nextCursor;
        if (cursor && seenCursors.has(cursor)) {
          throw new Error("Repeated stopped-student cursor");
        }
        if (cursor) seenCursors.add(cursor);
      } while (cursor);
      setStudents([...stoppedById.values()]);
      setStatus("ready");
    } catch {
      if (
        !activeRef.current ||
        request !== requestGeneration.current ||
        requestScope !== scopeRef.current
      ) return;
      setStatus("error");
      setError("停补学生载入失败，请重试");
    }
  }, [branchCode, groupCode]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = students.find((student) => student.id === selectedId) ?? null;

  async function confirm() {
    if (!selected || status === "saving") return;
    const request = ++requestGeneration.current;
    const requestScope = scopeRef.current;
    setStatus("saving");
    setError("");
    try {
      const restored = await rosterApi.restoreStudent({
        branchCode,
        groupCode,
        studentId: selected.id,
      });
      if (
        !activeRef.current ||
        request !== requestGeneration.current ||
        requestScope !== scopeRef.current
      ) return;
      onRestored(restored);
    } catch {
      if (
        !activeRef.current ||
        request !== requestGeneration.current ||
        requestScope !== scopeRef.current
      ) return;
      setStatus("error");
      setError("学生恢复失败，请重试");
    }
  }

  return (
    <LifecycleDialog
      title="恢复学生"
      titleId="restore-title"
      initialFocusRef={firstChoiceRef}
      onClose={onClose}
    >
      {status === "loading" ? <p role="status">正在载入停补学生…</p> : null}
      {status !== "loading" && students.length ? (
        <fieldset className="candidate-list">
          <legend>请选择要恢复的学生</legend>
          {students.map((student, index) => (
            <label key={student.id}>
              <input
                ref={index === 0 ? firstChoiceRef : undefined}
                type="radio"
                name="restore-candidate"
                value={student.id}
                checked={selectedId === student.id}
                disabled={status === "saving"}
                onChange={() => setSelectedId(student.id)}
              />
              <span>{identity(student)}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {status === "ready" && !students.length ? (
        <p className="lifecycle-dialog__empty">当前老师没有停补学生</p>
      ) : null}
      {selected ? (
        <div className="lifecycle-confirmation">
          <span>请确认恢复学生</span>
          <strong>{identity(selected)}</strong>
        </div>
      ) : null}
      <p className="form-error" role="alert">{error}</p>
      {status === "error" ? (
        <button className="secondary-button" type="button" onClick={load}>
          重新载入
        </button>
      ) : null}
      <button
        className="primary-button lifecycle-dialog__confirm"
        type="button"
        disabled={!selected || status === "saving"}
        onClick={confirm}
      >
        {status === "saving" ? "恢复中…" : "确认恢复"}
      </button>
    </LifecycleDialog>
  );
}
