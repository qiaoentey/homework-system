import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rosterApi } from "../../api/client.js";
import { EMPTY_SUMMARY } from "../../domain/attendance.js";
import { SummaryBar } from "../dashboard/SummaryBar.jsx";
import { MessageDialog } from "../messages/MessageDialog.jsx";
import { ProfilePanel } from "../students/ProfilePanel.jsx";
import { StudentVirtualList } from "./StudentVirtualList.jsx";

function localDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function eventsByStudent(items) {
  const grouped = {};
  for (const item of items) {
    if (!item.active) continue;
    grouped[item.studentId] ??= [];
    grouped[item.studentId].push(item.eventCode);
  }
  return grouped;
}

export function RosterScreen({
  branchCode,
  groupCode,
  date = localDate(),
  onBackGroups,
  onBackBranches,
}) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [total, setTotal] = useState(0);
  const [rosterStatus, setRosterStatus] = useState("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [attendance, setAttendance] = useState({});
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [saveStates, setSaveStates] = useState({});
  const [messageOpen, setMessageOpen] = useState(false);
  const requestGeneration = useRef(0);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, students],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const nextSummary = await rosterApi.summary({ branchCode, groupCode, date });
      setSummary(nextSummary);
    } catch {
      // Attendance is already durable; a summary read failure must not roll it back.
    } finally {
      setSummaryLoading(false);
    }
  }, [branchCode, date, groupCode]);

  const loadFirstPage = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setRosterStatus("loading");
    setStudents([]);
    setNextCursor(null);
    setLoadMoreError(false);
    setTotal(0);
    setSelectedStudentId(null);
    setMessageOpen(false);
    try {
      const response = await rosterApi.students({
        branchCode,
        groupCode,
        search,
        limit: 50,
      });
      if (generation !== requestGeneration.current) return;
      setStudents(response.items);
      setNextCursor(response.nextCursor);
      setTotal(response.total);
      setRosterStatus("ready");
      if (!response.items.length) setSelectedStudentId(null);
    } catch {
      if (generation !== requestGeneration.current) return;
      setRosterStatus("error");
    }
  }, [branchCode, groupCode, search]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  useEffect(() => {
    let current = true;
    setAttendance({});
    setSaveStates({});
    setSummaryLoading(true);
    rosterApi.attendance({ branchCode, groupCode, date }).then((response) => {
      if (!current) return;
      setAttendance(eventsByStudent(response.items));
    }).catch(() => {});
    rosterApi.summary({ branchCode, groupCode, date }).then((response) => {
      if (!current) return;
      setSummary(response);
    }).catch(() => {}).finally(() => {
      if (!current) return;
      setSummaryLoading(false);
    });
    return () => {
      current = false;
    };
  }, [branchCode, date, groupCode]);

  const loadMore = useCallback(async (retry = false) => {
    if (!nextCursor || loadingMore || (loadMoreError && !retry)) return;
    const cursor = nextCursor;
    const generation = requestGeneration.current;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const response = await rosterApi.students({
        branchCode,
        groupCode,
        search,
        cursor,
        limit: 50,
      });
      if (generation !== requestGeneration.current) return;
      setStudents((current) => {
        const known = new Set(current.map((student) => student.id));
        return [...current, ...response.items.filter((student) => !known.has(student.id))];
      });
      setNextCursor(response.nextCursor);
      setTotal(response.total);
    } catch {
      if (generation === requestGeneration.current) setLoadMoreError(true);
    } finally {
      if (generation === requestGeneration.current) setLoadingMore(false);
    }
  }, [branchCode, groupCode, loadMoreError, loadingMore, nextCursor, search]);

  const saveAttendance = useCallback(async (studentId, operation) => {
    setSaveStates((current) => ({
      ...current,
      [studentId]: { status: "saving", operation },
    }));
    try {
      if (operation.type === "clear") {
        await rosterApi.clearAttendance({ branchCode, groupCode, studentId, date });
      } else {
        await rosterApi.setAttendance({
          branchCode,
          groupCode,
          studentId,
          date,
          eventCode: operation.eventCode,
          active: operation.active,
        });
      }
      setSaveStates((current) => ({
        ...current,
        [studentId]: { status: "saved", operation },
      }));
      await loadSummary();
    } catch {
      setAttendance((current) => ({
        ...current,
        [studentId]: operation.previous,
      }));
      setSaveStates((current) => ({
        ...current,
        [studentId]: { status: "error", operation },
      }));
    }
  }, [branchCode, date, groupCode, loadSummary]);

  function toggleEvent(studentId, eventCode) {
    const previous = attendance[studentId] ?? [];
    const active = !previous.includes(eventCode);
    const next = active
      ? [...previous, eventCode]
      : previous.filter((code) => code !== eventCode);
    setAttendance((current) => ({ ...current, [studentId]: next }));
    saveAttendance(studentId, { type: "event", eventCode, active, previous });
  }

  function clearDay(studentId) {
    const previous = attendance[studentId] ?? [];
    setAttendance((current) => ({ ...current, [studentId]: [] }));
    saveAttendance(studentId, { type: "clear", previous });
  }

  function retry(studentId) {
    const operation = saveStates[studentId]?.operation;
    if (!operation) return;
    const optimistic = operation.type === "clear"
      ? []
      : operation.active
        ? [...operation.previous.filter((code) => code !== operation.eventCode), operation.eventCode]
        : operation.previous.filter((code) => code !== operation.eventCode);
    setAttendance((current) => ({ ...current, [studentId]: optimistic }));
    saveAttendance(studentId, operation);
  }

  function selectStudent(studentId) {
    setSelectedStudentId(studentId);
    setMessageOpen(false);
  }

  function changeSearch(event) {
    setSearchInput(event.target.value);
    setSelectedStudentId(null);
    setMessageOpen(false);
  }

  function profileSaved(updatedStudent) {
    setStudents((current) => current.map((student) => (
      student.id === updatedStudent.id ? updatedStudent : student
    )));
  }

  return (
    <section className="roster-screen">
      {(onBackGroups || onBackBranches) ? (
        <nav className="roster-screen__actions" aria-label="名单返回">
          {onBackGroups ? (
            <button type="button" className="back-button" onClick={onBackGroups}>
              <span aria-hidden="true">←</span>
              返回老师
            </button>
          ) : null}
          {onBackBranches ? (
            <button type="button" className="back-button" onClick={onBackBranches}>
              返回分院
            </button>
          ) : null}
        </nav>
      ) : null}

      <header className="roster-screen__heading">
        <div>
          <span className="eyebrow">{branchCode} 分院</span>
          <h1>{groupCode}</h1>
          <p>只显示当前老师的在读学生 · 共 {total} 名</p>
        </div>
        <label className="roster-search">
          <span className="sr-only">搜索当前班级学生</span>
          <input
            type="search"
            placeholder="搜索当前班级学生"
            value={searchInput}
            onChange={changeSearch}
          />
        </label>
      </header>

      <SummaryBar summary={summary} loading={summaryLoading} />

      {rosterStatus === "loading" ? (
        <div className="roster-loading" role="status">正在载入名单…</div>
      ) : null}
      {rosterStatus === "error" ? (
        <div className="roster-error" role="alert">
          <p>名单载入失败，请重试</p>
          <button className="primary-button" type="button" onClick={loadFirstPage}>
            重新加载
          </button>
        </div>
      ) : null}
      {rosterStatus === "ready" && students.length ? (
        <StudentVirtualList
          students={students}
          nextCursor={nextCursor}
          loadingMore={loadingMore}
          loadMoreError={loadMoreError}
          onLoadMore={loadMore}
          onRetryLoadMore={() => loadMore(true)}
          selectedStudentId={selectedStudentId}
          attendanceByStudent={attendance}
          saveStates={saveStates}
          onSelect={selectStudent}
          onToggleEvent={toggleEvent}
          onClear={clearDay}
          onRetry={retry}
        />
      ) : null}
      <ProfilePanel
        branchCode={branchCode}
        groupCode={groupCode}
        student={selectedStudent}
        noResults={rosterStatus === "ready" && !students.length}
        onSaved={profileSaved}
        onOpenMessages={() => setMessageOpen(true)}
      />

      {messageOpen && selectedStudent ? (
        <MessageDialog
          branchCode={branchCode}
          groupCode={groupCode}
          student={selectedStudent}
          date={date}
          onClose={() => setMessageOpen(false)}
        />
      ) : null}
    </section>
  );
}
