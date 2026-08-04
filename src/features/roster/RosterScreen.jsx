import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rosterApi } from "../../api/client.js";
import { EMPTY_SUMMARY, nextAttendanceEvents } from "../../domain/attendance.js";
import { SummaryBar } from "../dashboard/SummaryBar.jsx";
import { MessageDialog } from "../messages/MessageDialog.jsx";
import { EnrolDialog } from "../students/EnrolDialog.jsx";
import { ProfilePanel } from "../students/ProfilePanel.jsx";
import { RestoreDialog } from "../students/RestoreDialog.jsx";
import { StopDialog } from "../students/StopDialog.jsx";
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
  groups = [{ code: groupCode, label: groupCode }],
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
  const [attendanceStatus, setAttendanceStatus] = useState("loading");
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [summaryStatus, setSummaryStatus] = useState("loading");
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [profileNavigationRequest, setProfileNavigationRequest] = useState(0);
  const [saveStates, setSaveStates] = useState({});
  const [messageOpen, setMessageOpen] = useState(false);
  const [lifecycleDialog, setLifecycleDialog] = useState(null);
  const [toast, setToast] = useState("");
  const requestGeneration = useRef(0);
  const attendanceRequestGeneration = useRef(0);
  const attendanceMutationVersions = useRef(new Map());
  const summaryRequestGeneration = useRef(0);
  const profilePanelRef = useRef(null);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, students],
  );

  useEffect(() => {
    if (!selectedStudentId || !profileNavigationRequest) return;
    const panel = profilePanelRef.current;
    panel?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    panel?.querySelector("select:not(:disabled), input:not(:disabled)")?.focus({ preventScroll: true });
  }, [profileNavigationRequest, selectedStudentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadSummary = useCallback(async () => {
    const request = ++summaryRequestGeneration.current;
    setSummaryStatus("loading");
    try {
      const nextSummary = await rosterApi.summary({ branchCode, groupCode, date });
      if (request !== summaryRequestGeneration.current) return;
      setSummary(nextSummary);
      setSummaryStatus("ready");
    } catch {
      if (request !== summaryRequestGeneration.current) return;
      setSummaryStatus("error");
    }
  }, [branchCode, date, groupCode]);

  const loadAttendance = useCallback(async () => {
    const request = ++attendanceRequestGeneration.current;
    const startingVersions = new Map(attendanceMutationVersions.current);
    setAttendanceStatus("loading");
    try {
      const response = await rosterApi.attendance({ branchCode, groupCode, date });
      if (request !== attendanceRequestGeneration.current) return;
      const loadedAttendance = eventsByStudent(response.items);
      setAttendance((current) => {
        for (const [studentId, version] of attendanceMutationVersions.current) {
          if (startingVersions.get(studentId) !== version) {
            loadedAttendance[studentId] = current[studentId] ?? [];
          }
        }
        return loadedAttendance;
      });
      setAttendanceStatus("ready");
    } catch {
      if (request !== attendanceRequestGeneration.current) return;
      setAttendanceStatus("error");
    }
  }, [branchCode, date, groupCode]);

  const loadFirstPage = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setRosterStatus("loading");
    setStudents([]);
    setNextCursor(null);
    setLoadingMore(false);
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
    attendanceMutationVersions.current = new Map();
    setAttendance({});
    setSaveStates({});
    loadAttendance();
    loadSummary();
    return () => {
      attendanceRequestGeneration.current += 1;
      summaryRequestGeneration.current += 1;
    };
  }, [loadAttendance, loadSummary]);

  useEffect(() => {
    setLifecycleDialog(null);
    setToast("");
  }, [branchCode, groupCode]);

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
    attendanceMutationVersions.current.set(
      studentId,
      (attendanceMutationVersions.current.get(studentId) ?? 0) + 1,
    );
    const previous = attendance[studentId] ?? [];
    const active = !previous.includes(eventCode);
    const next = nextAttendanceEvents(previous, eventCode, active);
    setAttendance((current) => ({ ...current, [studentId]: next }));
    saveAttendance(studentId, { type: "event", eventCode, active, previous });
  }

  function clearDay(studentId) {
    attendanceMutationVersions.current.set(
      studentId,
      (attendanceMutationVersions.current.get(studentId) ?? 0) + 1,
    );
    const previous = attendance[studentId] ?? [];
    setAttendance((current) => ({ ...current, [studentId]: [] }));
    saveAttendance(studentId, { type: "clear", previous });
  }

  function retry(studentId) {
    const operation = saveStates[studentId]?.operation;
    if (!operation) return;
    attendanceMutationVersions.current.set(
      studentId,
      (attendanceMutationVersions.current.get(studentId) ?? 0) + 1,
    );
    const optimistic = operation.type === "clear"
      ? []
      : nextAttendanceEvents(
        operation.previous,
        operation.eventCode,
        operation.active,
      );
    setAttendance((current) => ({ ...current, [studentId]: optimistic }));
    saveAttendance(studentId, operation);
  }

  function selectStudent(studentId) {
    setSelectedStudentId(studentId);
    setProfileNavigationRequest((current) => current + 1);
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

  function refreshCurrentGroup() {
    loadFirstPage();
    loadAttendance();
    loadSummary();
  }

  function enrolled() {
    setLifecycleDialog(null);
    setToast("学生已加入");
    refreshCurrentGroup();
  }

  function stopped(stoppedStudent) {
    setLifecycleDialog(null);
    setToast("学生已停补");
    if (stoppedStudent.groupCode !== groupCode) return;
    refreshCurrentGroup();
  }

  function restored() {
    setLifecycleDialog(null);
    setToast("学生已恢复");
    refreshCurrentGroup();
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

      <SummaryBar summary={summary} loading={summaryStatus === "loading"} />

      <div className="roster-lifecycle-actions" aria-label="学生管理">
        <button className="primary-button" type="button" onClick={() => setLifecycleDialog("enrol")}>
          Enrol 学生
        </button>
        <button className="secondary-button" type="button" onClick={() => setLifecycleDialog("stop")}>
          停补学生
        </button>
        <button className="secondary-button" type="button" onClick={() => setLifecycleDialog("restore")}>
          恢复学生
        </button>
      </div>

      {toast ? <div className="lifecycle-toast" role="status">{toast}</div> : null}

      {(attendanceStatus === "error" || summaryStatus === "error") ? (
        <div className="roster-support-errors">
          {attendanceStatus === "error" ? (
            <div className="support-error" role="alert" aria-label="点名资料错误">
              <span>点名资料载入失败</span>
              <button className="retry-button" type="button" onClick={loadAttendance}>
                重试点名资料
              </button>
            </div>
          ) : null}
          {summaryStatus === "error" ? (
            <div className="support-error" role="alert" aria-label="统计错误">
              <span>统计载入失败</span>
              <button className="retry-button" type="button" onClick={loadSummary}>
                重试统计
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

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
        panelRef={profilePanelRef}
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
      {lifecycleDialog === "enrol" ? (
        <EnrolDialog
          branchCode={branchCode}
          groupCode={groupCode}
          groups={groups}
          onClose={() => setLifecycleDialog(null)}
          onEnrolled={enrolled}
        />
      ) : null}
      {lifecycleDialog === "stop" ? (
        <StopDialog
          branchCode={branchCode}
          groupCode={groupCode}
          groups={groups}
          onClose={() => setLifecycleDialog(null)}
          onStopped={stopped}
        />
      ) : null}
      {lifecycleDialog === "restore" ? (
        <RestoreDialog
          branchCode={branchCode}
          groupCode={groupCode}
          onClose={() => setLifecycleDialog(null)}
          onRestored={restored}
        />
      ) : null}
    </section>
  );
}
