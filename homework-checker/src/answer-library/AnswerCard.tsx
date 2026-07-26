import type { AnswerResource } from "./catalog";

type AnswerCardProps = { resource: AnswerResource };

export function AnswerCard({ resource }: AnswerCardProps) {
  const gradeLabel = resource.grade === 1 ? "一年级" : resource.grade === 2 ? "二年级" : "三年级";
  const title = `${gradeLabel}${resource.subject}`;

  return (
    <article className="answer-card" aria-label={`${title}答案资源`}>
      <div className="answer-card__heading">
        <p className="eyebrow">活动本答案</p>
        <h3>{title}</h3>
      </div>
      <div className="answer-card__actions">
        <a href={resource.pdfPath} target="_blank" rel="noreferrer" aria-label={`打开${title} PDF`}>
          打开 PDF
        </a>
        <a href={resource.pdfPath} download aria-label={`下载${title} PDF`}>
          下载 PDF
        </a>
      </div>
      <section aria-label={`${title}答案影片`}>
        <h4>答案影片</h4>
        <ul className="video-list">
          {resource.videos.map((video) => (
            <li key={video.videoId}>
              <a
                href={`https://www.youtube.com/watch?v=${video.videoId}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`打开${title}${video.label}答案影片，${video.duration}`}
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
