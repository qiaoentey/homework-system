export type Grade = 1 | 2 | 3;
export type Subject = "华文" | "国语" | "数学" | "科学";
export type VideoLink = {
  label: string;
  duration: string;
  videoId: string;
  /** External availability is deliberately not implied by catalog inclusion. */
  linkStatus: "external-unverified";
  catalogReviewedOn: string;
};
export type AnswerResource = {
  id: string;
  grade: Grade;
  subject: Subject;
  pdfPath: string;
  videos: VideoLink[];
};

const videos = (
  entries: ReadonlyArray<readonly [label: string, duration: string, videoId: string]>,
): VideoLink[] => entries.map(([label, duration, videoId]) => ({
  label,
  duration,
  videoId,
  linkStatus: "external-unverified",
  catalogReviewedOn: "2026-07-27",
}));

const pdfPath = (grade: Grade, subject: Subject) =>
  `pdf/${grade}年级_${subject}_活动本答案影片索引.pdf`;

const resource = (
  id: string,
  grade: Grade,
  subject: Subject,
  entries: ReadonlyArray<readonly [label: string, duration: string, videoId: string]>,
): AnswerResource => ({
  id,
  grade,
  subject,
  pdfPath: pdfPath(grade, subject),
  videos: videos(entries),
});

export const ANSWER_RESOURCES: AnswerResource[] = [
  resource("1-chinese", 1, "华文", [
    ["下册完整版", "42:20", "G9HVvzhPtTk"], ["上册完整版", "42:21", "nTLnzUXU7zk"],
    ["下册快速版", "3:51", "681yp19nZBM"], ["上册快速版", "3:51", "OJug4NJxqJw"],
  ]),
  resource("1-malay", 1, "国语", [
    ["下册完整版", "38:20", "ny_RadBlf0g"], ["上册完整版", "38:21", "P8eEdOz4y38"],
    ["下册快速版", "3:31", "Keyy5R_NayQ"], ["上册快速版", "3:31", "tWyrRQaLcPU"],
  ]),
  resource("1-mathematics", 1, "数学", [
    ["下册完整版", "45:21", "-ukU8RoBV-Q"], ["上册完整版", "1:02:21", "DgRklqnMEHI"],
    ["下册快速版", "4:06", "BlE6sIxzXvw"], ["上册快速版", "5:31", "vpajeLAr8bU"],
  ]),
  resource("1-science", 1, "科学", [["完整版", "32:21", "RPnSzMHUVBM"], ["快速版", "3:01", "Uu0lD7xrREg"]]),
  resource("2-chinese", 2, "华文", [
    ["下册完整版", "42:21", "pV1L8AT0s4w"], ["上册完整版", "42:21", "CJf5M2ptlhQ"],
    ["下册快速版", "3:50", "AeoMa2D2bzE"], ["上册快速版", "3:50", "QqxSfx8mNTs"],
  ]),
  resource("2-malay", 2, "国语", [
    ["下册完整版", "43:21", "TQSUQT1NnCk"], ["上册完整版", "43:21", "X6AAAnHNo9I"],
    ["下册快速版", "3:50", "3G25_5LBgVc"], ["上册快速版", "3:50", "t45VdtZbe7A"],
  ]),
  resource("2-mathematics", 2, "数学", [["完整版", "1:18:21", "_6-CMY0lIhI"], ["快速版", "6:45", "yqIXHBjYz-c"]]),
  resource("2-science", 2, "科学", [["完整版", "43:20", "Gsn7Y9eR2mg"], ["快速版", "3:50", "3_DiUohIqE0"]]),
  resource("3-chinese", 3, "华文", [
    ["下册完整版", "43:20", "014P1XavOSc"], ["上册完整版", "43:20", "XNt5cFUKcFQ"],
    ["下册快速版", "7:30", "cqZdp5Zluws"], ["上册快速版", "7:30", "XYS23HEUw_o"],
  ]),
  resource("3-malay", 3, "国语", [["下册完整版", "43:20", "h9tA-QQg5jA"], ["上册完整版", "43:21", "kwFZZuDQc8Q"]]),
  resource("3-mathematics", 3, "数学", [["完整版", "1:19:20", "CKrCzJwoPK8"]]),
  resource("3-science", 3, "科学", [["完整版", "47:20", "nP0HGVFNQ3M"]]),
];

export const getResources = (filters: { grade?: Grade; subject?: Subject }) =>
  ANSWER_RESOURCES.filter(
    (item) =>
      (filters.grade === undefined || item.grade === filters.grade) &&
      (filters.subject === undefined || item.subject === filters.subject),
  );
