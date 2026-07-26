import { useEffect, useRef, useState } from "react";
import { rosterApi } from "../../api/client.js";

export function MessageDialog({
  branchCode,
  groupCode,
  student,
  date,
  onClose,
}) {
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const bodyLength = Array.from(body).length;
  const dialogRef = useRef(null);
  const editorRef = useRef(null);
  const returnFocusRef = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  );
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    let current = true;
    rosterApi.messages({
      branchCode,
      groupCode,
      studentId: student.id,
    }).then((response) => {
      if (!current) return;
      setMessages(response.items);
      setStatus("idle");
    }).catch(() => {
      if (!current) return;
      setStatus("error");
      setError("留言载入失败，请关闭后重试");
    });
    return () => {
      current = false;
    };
  }, [branchCode, groupCode, student.id]);

  useEffect(() => {
    const returnFocus = returnFocusRef.current;
    editorRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(dialogRef.current?.querySelectorAll(
        'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ) ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      returnFocus?.focus();
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!body.trim() || bodyLength > 2000 || status === "saving") return;
    setStatus("saving");
    setError("");
    try {
      const created = await rosterApi.createMessage({
        branchCode,
        groupCode,
        studentId: student.id,
        date,
        body,
      });
      setMessages((current) => [created, ...current]);
      setBody("");
      setStatus("saved");
    } catch {
      setStatus("error");
      setError("留言保存失败，请重试");
    }
  }

  return (
    <div className="dialog-backdrop">
      <section
        className="message-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-title"
      >
        <header className="message-dialog__header">
          <h2 id="message-title">{student.name} 留言</h2>
          <button className="text-button" type="button" onClick={onClose}>
            关闭
          </button>
        </header>
        <form onSubmit={submit}>
          <label>
            <span>留言内容</span>
            <textarea
              aria-label="留言内容"
              ref={editorRef}
              rows={5}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            <small>{bodyLength} / 2000</small>
          </label>
          <button
            className="primary-button"
            type="submit"
            disabled={!body.trim() || bodyLength > 2000 || status === "saving"}
          >
            {status === "saving" ? "保存中…" : "保存留言"}
          </button>
        </form>
        <p className="form-error" role="status">{error}</p>
        <div className="message-history" aria-label="留言记录">
          {messages.map((message) => (
            <article key={message.id}>
              <time>{message.date}</time>
              <p>{message.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
