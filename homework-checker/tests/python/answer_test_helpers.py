"""Shared real-data fixtures for answer PDF tests."""

from __future__ import annotations

import json
from pathlib import Path

from scripts.answer_data import (
    AnswerBook,
    AnswerEntry,
    CatalogResource,
    SourceReview,
    load_answer_book,
    load_catalog,
    validate_answer_book,
)


ROOT = Path(__file__).resolve().parents[2]
CATALOG_PATH = ROOT / "answer-data" / "catalog.json"


def resource_for(id: str) -> CatalogResource:
    return next(resource for resource in load_catalog(CATALOG_PATH).resources if resource.id == id)


def load_named_book(id: str) -> AnswerBook:
    return load_answer_book(ROOT / "answer-data" / "books" / f"{id}.json")


def validate_named_book(book: AnswerBook) -> list[str]:
    return validate_answer_book(book, resource_for(book.resource_id))


def sample_resource() -> CatalogResource:
    return resource_for("1-mathematics")


def sample_math_book(answer: str = "47 + 28 = 75", checking_note: str = "个位先算 7 + 8") -> AnswerBook:
    resource = sample_resource()
    return AnswerBook(
        resource_id=resource.id,
        grade=resource.grade,
        subject=resource.subject,
        updated_on="2026-08-01",
        source_reviews=tuple(
            SourceReview(video.video_id, video.duration_seconds)
            for video in resource.videos if video.primary_source
        ),
        entries=(
            AnswerEntry(
                volume="上册",
                unit="第一单元",
                page="1",
                question="47 + 28",
                answer=answer,
                checking_note=checking_note,
                confidence="verified",
                source_video_id="DgRklqnMEHI",
                source_timecode="00:01:00",
            ),
        ),
    )


def write_sample_project(root: Path) -> tuple[Path, Path, Path]:
    catalog_path = root / "answer-data" / "catalog.json"
    books_dir = root / "answer-data" / "books"
    pdf_dir = root / "public" / "pdf"
    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    books_dir.mkdir(parents=True, exist_ok=True)
    pdf_dir.mkdir(parents=True, exist_ok=True)
    catalog_path.write_text(CATALOG_PATH.read_text(encoding="utf-8"), encoding="utf-8")
    book = sample_math_book()
    (books_dir / "1-mathematics.json").write_text(
        json.dumps({
            "resourceId": book.resource_id,
            "grade": book.grade,
            "subject": book.subject,
            "updatedOn": book.updated_on,
            "sourceReviews": [
                {"sourceVideoId": review.source_video_id, "reviewedThroughSeconds": review.reviewed_through_seconds}
                for review in book.source_reviews
            ],
            "entries": [{
                "volume": entry.volume,
                "unit": entry.unit,
                "page": entry.page,
                "question": entry.question,
                "answer": entry.answer,
                "checkingNote": entry.checking_note,
                "confidence": entry.confidence,
                "sourceVideoId": entry.source_video_id,
                "sourceTimecode": entry.source_timecode,
            } for entry in book.entries],
        }, ensure_ascii=False),
        encoding="utf-8",
    )
    return catalog_path, books_dir, pdf_dir
