import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { StudentCard } from "./StudentCard.jsx";

const ESTIMATED_CARD_HEIGHT = 292;

function observeListRect(instance, callback) {
  const element = instance.scrollElement;
  callback({
    width: element?.clientWidth || 640,
    height: element?.clientHeight || 620,
  });
  if (!element || typeof ResizeObserver === "undefined") return () => {};
  const observer = new ResizeObserver(() => {
    callback({
      width: element.clientWidth || 640,
      height: element.clientHeight || 620,
    });
  });
  observer.observe(element);
  return () => observer.disconnect();
}

function observeListOffset(instance, callback) {
  const element = instance.scrollElement;
  if (!element) return () => {};
  const onScroll = () => callback(element.scrollTop, true);
  callback(element.scrollTop, false);
  element.addEventListener("scroll", onScroll, { passive: true });
  return () => element.removeEventListener("scroll", onScroll);
}

export function StudentVirtualList({
  students,
  nextCursor,
  loadingMore,
  loadMoreError,
  onLoadMore,
  onRetryLoadMore,
  selectedStudentId,
  attendanceByStudent,
  saveStates,
  onSelect,
  onToggleEvent,
  onRetry,
}) {
  const scrollRef = useRef(null);
  const count = students.length + (nextCursor ? 1 : 0);
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    measureElement: (element) => (
      element.getBoundingClientRect().height || ESTIMATED_CARD_HEIGHT
    ),
    overscan: 3,
    initialRect: { width: 640, height: 620 },
    observeElementRect: observeListRect,
    observeElementOffset: observeListOffset,
    getItemKey: (index) => students[index]?.id ?? "load-more",
  });
  const virtualItems = virtualizer.getVirtualItems();
  const lastVirtualIndex = virtualItems.at(-1)?.index ?? -1;

  useEffect(() => {
    if (
      nextCursor &&
      !loadingMore &&
      !loadMoreError &&
      lastVirtualIndex >= Math.max(0, students.length - 5)
    ) {
      onLoadMore();
    }
  }, [
    lastVirtualIndex,
    loadingMore,
    loadMoreError,
    nextCursor,
    onLoadMore,
    students.length,
  ]);

  return (
    <div className="student-list" data-testid="student-list" ref={scrollRef}>
      <div
        className="student-list__canvas"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualItems.map((virtualItem) => {
          const rosterStudent = students[virtualItem.index];
          return (
            <div
              className="student-list__row"
              data-index={virtualItem.index}
              key={virtualItem.key}
              ref={virtualizer.measureElement}
              style={{ transform: `translateY(${virtualItem.start}px)` }}
            >
              {rosterStudent ? (
                <StudentCard
                  student={rosterStudent}
                  activeEvents={attendanceByStudent[rosterStudent.id] ?? []}
                  selected={selectedStudentId === rosterStudent.id}
                  saveState={saveStates[rosterStudent.id]}
                  onSelect={onSelect}
                  onToggleEvent={onToggleEvent}
                  onRetry={onRetry}
                />
              ) : (
                <div className="loading-more" role="status">
                  {loadingMore ? "正在载入更多…" : null}
                  {loadMoreError ? (
                    <button className="retry-button" type="button" onClick={onRetryLoadMore}>
                      重试载入更多
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
