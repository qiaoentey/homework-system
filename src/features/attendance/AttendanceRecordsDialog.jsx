import { useCallback, useEffect, useRef, useState } from "react";
import { rosterApi } from "../../api/client.js";
import { formatAbsenceReason } from "../../../shared/absenceReasons.js";
import { LifecycleDialog } from "../students/LifecycleDialog.jsx";

function localToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function StudentList({ title, count, students }) {
  return (
    <section className="attendance-records__card">
      <h3>{title} {count}</h3>
      {students.length ? (
        <ul>
          {students.map((student) => (
            <li key={student.id}>
              <strong>{student.name}</strong>
              <span>{student.grade}</span>
              {student.absenceReason ? (
                <span className="attendance-records__absence-reason">
                  缺席原因：{formatAbsenceReason(student.absenceReason)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="attendance-records__empty">没有学生</p>}
    </section>
  );
}

export function AttendanceRecordsDialog({
  branchCode,
  groupCode,
  initialDate,
  onClose,
}) {
  const [date, setDate] = useState(initialDate);
  const [record, setRecord] = useState(null);
  const [status, setStatus] = useState("loading");
  const requestGeneration = useRef(0);
  const dateInputRef = useRef(null);

  const loadRecord = useCallback(async () => {
    const request = ++requestGeneration.current;
    setStatus("loading");
    try {
      const response = await rosterApi.attendanceRecords({
        branchCode,
        groupCode,
        date,
      });
      if (request !== requestGeneration.current) return;
      setRecord(response);
      setStatus("ready");
    } catch {
      if (request !== requestGeneration.current) return;
      setStatus("error");
    }
  }, [branchCode, date, groupCode]);

  useEffect(() => {
    loadRecord();
    return () => {
      requestGeneration.current += 1;
    };
  }, [loadRecord]);

  return (
    <LifecycleDialog
      title="点名记录"
      titleId="attendance-records-title"
      initialFocusRef={dateInputRef}
      onClose={onClose}
    >
      <div className="attendance-records">
        <div className="attendance-records__toolbar">
          <p className="attendance-records__group">{groupCode}</p>
          <label className="attendance-records__date">
            <span>记录日期</span>
            <input
              ref={dateInputRef}
              type="date"
              max={localToday()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        </div>

        {status === "loading" ? (
          <div className="attendance-records__loading" role="status">
            正在载入点名记录…
          </div>
        ) : null}

        {status === "error" ? (
          <div className="attendance-records__error" role="alert">
            <span>点名记录载入失败，请重试</span>
            <button className="secondary-button" type="button" onClick={loadRecord}>
              重新载入
            </button>
          </div>
        ) : null}

        {status === "ready" && record ? (
          <>
            <div className="attendance-records__lists">
              <StudentList
                title="出席"
                count={record.counts.present}
                students={record.present}
              />
              <StudentList
                title="缺席"
                count={record.counts.absent}
                students={record.absent}
              />
              <StudentList
                title="未点名"
                count={record.counts.unmarked}
                students={record.unmarked}
              />
            </div>
            {record.conflicts.length ? (
              <div className="attendance-records__conflicts" role="alert">
                <strong>需要确认</strong>
                <p>以下学生的旧记录同时包含出席和缺席，请重新点名：</p>
                <ul>
                  {record.conflicts.map((student) => (
                    <li key={student.id}>{student.name} · {student.grade}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </LifecycleDialog>
  );
}
