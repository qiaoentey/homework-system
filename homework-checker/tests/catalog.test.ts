import { describe, expect, it } from "vitest";
import { ANSWER_RESOURCES, getResources } from "../src/answer-library/catalog";

describe("answer catalog", () => {
  it("contains exactly 12 unique grade-subject PDF paths", () => {
    expect(ANSWER_RESOURCES).toHaveLength(12);
    expect(new Set(ANSWER_RESOURCES.map((item) => item.pdfPath)).size).toBe(12);
    expect(ANSWER_RESOURCES.every((item) =>
      item.pdfPath.startsWith("pdf/") && !item.pdfPath.startsWith("/pdf/")
    )).toBe(true);
  });

  it("keeps the complete external-video inventory intentional and status-labelled", () => {
    const inventory = ANSWER_RESOURCES.flatMap((resource) => resource.videos.map((video) =>
      `${resource.id}|${video.label}|${video.duration}|${video.videoId}`,
    ));
    expect(inventory).toEqual([
      "1-chinese|下册完整版|42:20|G9HVvzhPtTk",
      "1-chinese|上册完整版|42:21|nTLnzUXU7zk",
      "1-chinese|下册快速版|3:51|681yp19nZBM",
      "1-chinese|上册快速版|3:51|OJug4NJxqJw",
      "1-malay|下册完整版|38:20|ny_RadBlf0g",
      "1-malay|上册完整版|38:21|P8eEdOz4y38",
      "1-malay|下册快速版|3:31|Keyy5R_NayQ",
      "1-malay|上册快速版|3:31|tWyrRQaLcPU",
      "1-mathematics|下册完整版|45:21|-ukU8RoBV-Q",
      "1-mathematics|上册完整版|1:02:21|DgRklqnMEHI",
      "1-mathematics|下册快速版|4:06|BlE6sIxzXvw",
      "1-mathematics|上册快速版|5:31|vpajeLAr8bU",
      "1-science|完整版|32:21|RPnSzMHUVBM",
      "1-science|快速版|3:01|Uu0lD7xrREg",
      "2-chinese|下册完整版|42:21|pV1L8AT0s4w",
      "2-chinese|上册完整版|42:21|CJf5M2ptlhQ",
      "2-chinese|下册快速版|3:50|AeoMa2D2bzE",
      "2-chinese|上册快速版|3:50|QqxSfx8mNTs",
      "2-malay|下册完整版|43:21|TQSUQT1NnCk",
      "2-malay|上册完整版|43:21|X6AAAnHNo9I",
      "2-malay|下册快速版|3:50|3G25_5LBgVc",
      "2-malay|上册快速版|3:50|t45VdtZbe7A",
      "2-mathematics|完整版|1:18:21|_6-CMY0lIhI",
      "2-mathematics|快速版|6:45|yqIXHBjYz-c",
      "2-science|完整版|43:20|Gsn7Y9eR2mg",
      "2-science|快速版|3:50|3_DiUohIqE0",
      "3-chinese|下册完整版|43:20|014P1XavOSc",
      "3-chinese|上册完整版|43:20|XNt5cFUKcFQ",
      "3-chinese|下册快速版|7:30|cqZdp5Zluws",
      "3-chinese|上册快速版|7:30|XYS23HEUw_o",
      "3-malay|下册完整版|43:20|h9tA-QQg5jA",
      "3-malay|上册完整版|43:21|kwFZZuDQc8Q",
      "3-mathematics|完整版|1:19:20|CKrCzJwoPK8",
      "3-science|完整版|47:20|nP0HGVFNQ3M",
    ]);
    expect(new Set(ANSWER_RESOURCES.flatMap((resource) => resource.videos.map((video) => video.videoId))).size).toBe(34);
    expect(ANSWER_RESOURCES.flatMap((resource) => resource.videos)
      .every((video) => video.linkStatus === "external-unverified" && video.catalogReviewedOn === "2026-07-27")).toBe(true);
  });

  it("filters grade 2 mathematics to one resource", () => {
    expect(getResources({ grade: 2, subject: "数学" })).toMatchObject([
      { grade: 2, subject: "数学" },
    ]);
  });
});
