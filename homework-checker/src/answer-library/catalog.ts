import rawCatalog from "../../answer-data/catalog.json";

export type Grade = 1 | 2 | 3;
export type Subject = "华文" | "国语" | "数学" | "科学";
export type VideoLink = {
  label: string;
  duration: string;
  durationSeconds: number;
  videoId: string;
  primarySource: boolean;
  /** External availability is deliberately not implied by catalog inclusion. */
  linkStatus: "external-unverified";
  catalogReviewedOn: string;
};
export type AnswerResource = {
  id: string;
  grade: Grade;
  subject: Subject;
  pdfPath: string;
  playlistUrl: string;
  videos: VideoLink[];
};

const isGrade = (value: unknown): value is Grade => value === 1 || value === 2 || value === 3;
const isSubject = (value: unknown): value is Subject =>
  value === "华文" || value === "国语" || value === "数学" || value === "科学";

const catalog = rawCatalog as {
  resources: Array<{
    id: unknown;
    grade: unknown;
    subject: unknown;
    pdfFile: unknown;
    playlistUrl: unknown;
    videos: Array<{
      label: unknown;
      duration: unknown;
      durationSeconds: unknown;
      videoId: unknown;
      primarySource: unknown;
      linkStatus: unknown;
      catalogReviewedOn: unknown;
    }>;
  }>;
};

const string = (value: unknown, field: string): string => {
  if (typeof value !== "string") throw new Error(`Invalid answer catalog ${field}`);
  return value;
};

const resource = (item: (typeof catalog.resources)[number]): AnswerResource => {
  if (!isGrade(item.grade)) throw new Error("Invalid answer catalog grade");
  if (!isSubject(item.subject)) throw new Error("Invalid answer catalog subject");
  return {
    id: string(item.id, "resource id"),
    grade: item.grade,
    subject: item.subject,
    pdfPath: `pdf/${string(item.pdfFile, "PDF file")}`,
    playlistUrl: string(item.playlistUrl, "playlist URL"),
    videos: item.videos.map((video) => {
      if (typeof video.durationSeconds !== "number" || !Number.isInteger(video.durationSeconds)) {
        throw new Error("Invalid answer catalog video durationSeconds");
      }
      if (typeof video.primarySource !== "boolean") {
        throw new Error("Invalid answer catalog video primarySource");
      }
      if (video.linkStatus !== "external-unverified") {
        throw new Error("Invalid answer catalog video linkStatus");
      }
      return {
        label: string(video.label, "video label"),
        duration: string(video.duration, "video duration"),
        durationSeconds: video.durationSeconds,
        videoId: string(video.videoId, "video ID"),
        primarySource: video.primarySource,
        linkStatus: video.linkStatus,
        catalogReviewedOn: string(video.catalogReviewedOn, "video review date"),
      };
    }),
  };
};

export const ANSWER_RESOURCES: AnswerResource[] = catalog.resources.map(resource);

export const getResources = (filters: { grade?: Grade; subject?: Subject }) =>
  ANSWER_RESOURCES.filter(
    (item) =>
      (filters.grade === undefined || item.grade === filters.grade) &&
      (filters.subject === undefined || item.subject === filters.subject),
  );
