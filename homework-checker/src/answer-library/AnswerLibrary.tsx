import { useMemo, useState } from "react";
import { AnswerCard } from "./AnswerCard";
import { getResources, type Grade, type Subject } from "./catalog";

const GRADES: Grade[] = [1, 2, 3];
const SUBJECTS: Subject[] = ["华文", "国语", "数学", "科学"];

type AnswerLibraryProps = { onBack: () => void };

export function AnswerLibrary({ onBack }: AnswerLibraryProps) {
  const [grade, setGrade] = useState<Grade | undefined>();
  const [subject, setSubject] = useState<Subject | undefined>();
  const resources = useMemo(() => getResources({ grade, subject }), [grade, subject]);

  return (
    <main className="page-shell">
      <header className="page-header">
        <button className="text-button" type="button" onClick={onBack} aria-label="返回首页">
          ← 返回首页
        </button>
        <p className="eyebrow">活动本答案资料库</p>
        <h1>快速查答案</h1>
        <p>选择年级与科目，直接打开答案 PDF 或影片。</p>
      </header>

      <section className="filters" aria-label="答案筛选">
        <fieldset>
          <legend>年级</legend>
          <div className="filter-options">
            {GRADES.map((item) => (
              <button
                key={item}
                className="filter-button"
                type="button"
                aria-label={item === 1 ? "一年级" : item === 2 ? "二年级" : "三年级"}
                aria-pressed={grade === item}
                onClick={() => setGrade((current) => (current === item ? undefined : item))}
              >
                {item === 1 ? "一年级" : item === 2 ? "二年级" : "三年级"}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>科目</legend>
          <div className="filter-options">
            {SUBJECTS.map((item) => (
              <button
                key={item}
                className="filter-button"
                type="button"
                aria-label={item}
                aria-pressed={subject === item}
                onClick={() => setSubject((current) => (current === item ? undefined : item))}
              >
                {item}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <p className="result-count" aria-live="polite">找到 {resources.length} 份答案资料</p>
      <section className="answer-grid" aria-label="答案资料">
        {resources.map((resource) => <AnswerCard key={resource.id} resource={resource} />)}
      </section>
    </main>
  );
}
