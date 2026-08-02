from pathlib import Path
import json
import tempfile
import unittest

from scripts.answer_data import (
    AnswerBook,
    AnswerEntry,
    SourceReview,
    load_answer_book,
    load_catalog,
    validate_answer_book,
)


ROOT = Path(__file__).resolve().parents[2]


class AnswerDataTests(unittest.TestCase):
    def test_catalog_uses_the_reviewed_playlist_for_each_grade(self):
        catalog = load_catalog(ROOT / "answer-data/catalog.json")

        self.assertEqual(
            {resource.grade: resource.playlist_url for resource in catalog.resources},
            {
                1: "https://youtube.com/playlist?list=PLLWa_lzrwn3lwW1dGq-JB0NnvUZu2A9ML",
                2: "https://youtube.com/playlist?list=PLLWa_lzrwn3ktsgcODd4DcehkQxrhN7QM",
                3: "https://youtube.com/playlist?list=PLLWa_lzrwn3k3W0xqVMWOi3oX9TwkNePv",
            },
        )

    def test_catalog_has_twelve_reference_pdfs_and_thirty_four_videos(self):
        catalog = load_catalog(ROOT / "answer-data/catalog.json")

        self.assertEqual(len(catalog.resources), 12)
        self.assertEqual(sum(len(resource.videos) for resource in catalog.resources), 34)
        self.assertTrue(
            all(resource.pdf_file.endswith("_活动本答案参考.pdf") for resource in catalog.resources)
        )
        self.assertTrue(
            all("影片索引" not in resource.pdf_file for resource in catalog.resources)
        )

    def test_link_only_book_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "book.json"
            path.write_text(
                json.dumps(
                    {
                        "resourceId": "1-mathematics",
                        "grade": 1,
                        "subject": "数学",
                        "updatedOn": "2026-08-01",
                        "sourceReviews": [],
                        "entries": [],
                    }
                ),
                encoding="utf-8",
            )

            book = load_answer_book(path)

        self.assertIn("entries must not be empty", validate_answer_book(book, resource=None))

    def test_validation_rejects_blank_answer_and_page(self):
        book = AnswerBook(
            resource_id="1-mathematics",
            grade=1,
            subject="数学",
            updated_on="2026-08-01",
            source_reviews=(),
            entries=(
                AnswerEntry("上册", "第一单元", "", "1", "", "", "verified", "DgRklqnMEHI", "00:01:00"),
            ),
        )

        self.assertIn(
            "answer entries require volume, page, question, and answer",
            validate_answer_book(book, resource=None),
        )

    def test_validation_rejects_unsupported_confidence(self):
        book = AnswerBook(
            resource_id="1-mathematics",
            grade=1,
            subject="数学",
            updated_on="2026-08-01",
            source_reviews=(),
            entries=(
                AnswerEntry("上册", "第一单元", "1", "1", "1", "", "draft", "DgRklqnMEHI", "00:01:00"),
            ),
        )

        self.assertIn("unsupported confidence: draft", validate_answer_book(book, resource=None))

    def test_validation_rejects_timecode_outside_the_source_duration(self):
        resource = load_catalog(ROOT / "answer-data/catalog.json").resources[2]
        book = AnswerBook(
            resource_id=resource.id,
            grade=resource.grade,
            subject=resource.subject,
            updated_on="2026-08-01",
            source_reviews=tuple(
                SourceReview(video.video_id, video.duration_seconds) for video in resource.videos if video.primary_source
            ),
            entries=(
                AnswerEntry("上册", "第一单元", "1", "1", "1", "", "verified", "DgRklqnMEHI", "01:02:22"),
            ),
        )

        self.assertIn(
            "source timecode exceeds video duration: DgRklqnMEHI",
            validate_answer_book(book, resource),
        )

    def test_validation_requires_complete_primary_video_reviews(self):
        resource = load_catalog(ROOT / "answer-data/catalog.json").resources[2]
        book = AnswerBook(
            resource_id=resource.id,
            grade=resource.grade,
            subject=resource.subject,
            updated_on="2026-08-01",
            source_reviews=(SourceReview("DgRklqnMEHI", 3730),),
            entries=(
                AnswerEntry("上册", "第一单元", "1", "1", "1", "", "verified", "DgRklqnMEHI", "00:01:00"),
            ),
        )

        errors = validate_answer_book(book, resource)
        self.assertIn("source reviews must cover every primary video exactly", errors)
        self.assertIn("primary video review is incomplete: DgRklqnMEHI", errors)

    def test_validation_rejects_duplicate_primary_video_review_records(self):
        resource = load_catalog(ROOT / "answer-data/catalog.json").resources[3]
        complete_review = SourceReview("RPnSzMHUVBM", 1941)
        book = AnswerBook(
            resource_id=resource.id,
            grade=resource.grade,
            subject=resource.subject,
            updated_on="2026-08-01",
            source_reviews=(complete_review, complete_review),
            entries=(
                AnswerEntry("上册", "第一单元", "1", "1", "1", "", "verified", "RPnSzMHUVBM", "00:01:00"),
            ),
        )

        self.assertIn(
            "source review IDs must be unique",
            validate_answer_book(book, resource),
        )


if __name__ == "__main__":
    unittest.main()
