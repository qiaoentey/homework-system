import { useEffect, useState } from "react";
import type { AnswerResource } from "./catalog";

type AnswerCardProps = { resource: AnswerResource };

export function AnswerCard({ resource }: AnswerCardProps) {
  const gradeLabel = resource.grade === 1 ? "一年级" : resource.grade === 2 ? "二年级" : "三年级";
  const title = `${gradeLabel}${resource.subject}`;
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const markOnline = () => setIsOnline(true);
    const markOffline = () => setIsOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  return (
    <article className="answer-card" aria-label={`${title}答案资源`}>
      <div className="answer-card__heading">
        <p className="eyebrow">活动本答案</p>
        <h3>{title}</h3>
        <p>PDF 内含答案参考；影片仅供补充讲解</p>
      </div>
      <div className="answer-card__actions">
        <a href={resource.pdfPath} target="_blank" rel="noreferrer" aria-label={`打开${title}答案 PDF`}>
          打开答案 PDF
        </a>
        <a href={resource.pdfPath} download aria-label={`下载${title}答案 PDF`}>
          下载答案 PDF
        </a>
      </div>
      <section aria-label={`${title}补充讲解影片`}>
        <h4>补充讲解影片</h4>
        <ul className="video-list">
          {!isOnline && <li><span>补充讲解影片需要联网</span></li>}
          {isOnline && resource.videos.map((video) => (
            <li key={video.videoId}>
              <a
                href={`https://www.youtube.com/watch?v=${video.videoId}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`打开${title}${video.label}补充讲解影片，${video.duration}`}
              >
                <span>{video.label}</span>
                <span>{video.duration}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
