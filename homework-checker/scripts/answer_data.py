"""Strict loading and validation for answer-reference data."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import re
from typing import Any, Literal, Mapping


@dataclass(frozen=True)
class CatalogVideo:
    label: str
    duration: str
    duration_seconds: int
    video_id: str
    primary_source: bool
    link_status: str
    catalog_reviewed_on: str


@dataclass(frozen=True)
class CatalogResource:
    id: str
    grade: int
    subject: str
    pdf_file: str
    playlist_url: str
    videos: tuple[CatalogVideo, ...]


@dataclass(frozen=True)
class Catalog:
    resources: tuple[CatalogResource, ...]


@dataclass(frozen=True)
class SourceReview:
    source_video_id: str
    reviewed_through_seconds: int


@dataclass(frozen=True)
class AnswerEntry:
    volume: str
    unit: str
    page: str
    question: str
    answer: str
    checking_note: str
    confidence: Literal["verified", "review"]
    source_video_id: str
    source_timecode: str


@dataclass(frozen=True)
class AnswerBook:
    resource_id: str
    grade: int
    subject: str
    updated_on: str
    source_reviews: tuple[SourceReview, ...]
    entries: tuple[AnswerEntry, ...]


def _object(value: Any, context: str) -> Mapping[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{context} must be an object")
    return value


def _list(value: Any, context: str) -> list[Any]:
    if not isinstance(value, list):
        raise ValueError(f"{context} must be a list")
    return value


def _string(value: Any, context: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{context} must be a string")
    return value


def _integer(value: Any, context: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"{context} must be an integer")
    return value


def _boolean(value: Any, context: str) -> bool:
    if not isinstance(value, bool):
        raise ValueError(f"{context} must be a boolean")
    return value


def _required(mapping: Mapping[str, Any], field: str, context: str) -> Any:
    if field not in mapping:
        raise ValueError(f"{context} is missing {field}")
    return mapping[field]


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ValueError(f"invalid JSON in {path}: {error.msg}") from error


def load_catalog(path: Path) -> Catalog:
    root = _object(_read_json(path), "catalog")
    resources: list[CatalogResource] = []
    for index, raw_resource in enumerate(_list(_required(root, "resources", "catalog"), "catalog.resources")):
        context = f"catalog.resources[{index}]"
        item = _object(raw_resource, context)
        videos: list[CatalogVideo] = []
        for video_index, raw_video in enumerate(_list(_required(item, "videos", context), f"{context}.videos")):
            video_context = f"{context}.videos[{video_index}]"
            video = _object(raw_video, video_context)
            videos.append(CatalogVideo(
                label=_string(_required(video, "label", video_context), f"{video_context}.label"),
                duration=_string(_required(video, "duration", video_context), f"{video_context}.duration"),
                duration_seconds=_integer(_required(video, "durationSeconds", video_context), f"{video_context}.durationSeconds"),
                video_id=_string(_required(video, "videoId", video_context), f"{video_context}.videoId"),
                primary_source=_boolean(
                    _required(video, "primarySource", video_context),
                    f"{video_context}.primarySource",
                ),
                link_status=_string(_required(video, "linkStatus", video_context), f"{video_context}.linkStatus"),
                catalog_reviewed_on=_string(_required(video, "catalogReviewedOn", video_context), f"{video_context}.catalogReviewedOn"),
            ))
        resources.append(CatalogResource(
            id=_string(_required(item, "id", context), f"{context}.id"),
            grade=_integer(_required(item, "grade", context), f"{context}.grade"),
            subject=_string(_required(item, "subject", context), f"{context}.subject"),
            pdf_file=_string(_required(item, "pdfFile", context), f"{context}.pdfFile"),
            playlist_url=_string(_required(item, "playlistUrl", context), f"{context}.playlistUrl"),
            videos=tuple(videos),
        ))
    return Catalog(tuple(resources))


def load_answer_book(path: Path) -> AnswerBook:
    root = _object(_read_json(path), "answer book")
    reviews = tuple(
        SourceReview(
            source_video_id=_string(_required(item, "sourceVideoId", f"answer book.sourceReviews[{index}]"), f"answer book.sourceReviews[{index}].sourceVideoId"),
            reviewed_through_seconds=_integer(_required(item, "reviewedThroughSeconds", f"answer book.sourceReviews[{index}]"), f"answer book.sourceReviews[{index}].reviewedThroughSeconds"),
        )
        for index, raw_review in enumerate(_list(_required(root, "sourceReviews", "answer book"), "answer book.sourceReviews"))
        for item in [_object(raw_review, f"answer book.sourceReviews[{index}]")]
    )
    entries = tuple(
        AnswerEntry(
            volume=_string(_required(item, "volume", f"answer book.entries[{index}]"), f"answer book.entries[{index}].volume"),
            unit=_string(_required(item, "unit", f"answer book.entries[{index}]"), f"answer book.entries[{index}].unit"),
            page=_string(_required(item, "page", f"answer book.entries[{index}]"), f"answer book.entries[{index}].page"),
            question=_string(_required(item, "question", f"answer book.entries[{index}]"), f"answer book.entries[{index}].question"),
            answer=_string(_required(item, "answer", f"answer book.entries[{index}]"), f"answer book.entries[{index}].answer"),
            checking_note=_string(_required(item, "checkingNote", f"answer book.entries[{index}]"), f"answer book.entries[{index}].checkingNote"),
            confidence=_string(_required(item, "confidence", f"answer book.entries[{index}]"), f"answer book.entries[{index}].confidence"),
            source_video_id=_string(_required(item, "sourceVideoId", f"answer book.entries[{index}]"), f"answer book.entries[{index}].sourceVideoId"),
            source_timecode=_string(_required(item, "sourceTimecode", f"answer book.entries[{index}]"), f"answer book.entries[{index}].sourceTimecode"),
        )
        for index, raw_entry in enumerate(_list(_required(root, "entries", "answer book"), "answer book.entries"))
        for item in [_object(raw_entry, f"answer book.entries[{index}]")]
    )
    return AnswerBook(
        resource_id=_string(_required(root, "resourceId", "answer book"), "answer book.resourceId"),
        grade=_integer(_required(root, "grade", "answer book"), "answer book.grade"),
        subject=_string(_required(root, "subject", "answer book"), "answer book.subject"),
        updated_on=_string(_required(root, "updatedOn", "answer book"), "answer book.updatedOn"),
        source_reviews=reviews,
        entries=entries,
    )


def _seconds(timecode: str) -> int:
    parts = [int(part) for part in timecode.split(":")]
    return parts[0] * 3600 + parts[1] * 60 + parts[2] if len(parts) == 3 else parts[0] * 60 + parts[1]


def validate_answer_book(book: AnswerBook, resource: CatalogResource | None) -> list[str]:
    errors: list[str] = []
    if not book.entries:
        errors.append("entries must not be empty")
    videos = {video.video_id: video for video in resource.videos} if resource is not None else {}
    for entry in book.entries:
        if not all(value.strip() for value in (entry.volume, entry.page, entry.question, entry.answer)):
            errors.append("answer entries require volume, page, question, and answer")
        if entry.confidence not in {"verified", "review"}:
            errors.append(f"unsupported confidence: {entry.confidence}")
        if re.fullmatch(r"(?:\d{2}:)?\d{2}:\d{2}", entry.source_timecode) is None:
            errors.append(f"invalid source timecode: {entry.source_timecode}")
        elif resource is not None:
            video = videos.get(entry.source_video_id)
            if video is None:
                errors.append(f"unknown source video: {entry.source_video_id}")
            elif _seconds(entry.source_timecode) > video.duration_seconds:
                errors.append(f"source timecode exceeds video duration: {entry.source_video_id}")
    if resource is not None:
        if (book.grade, book.subject) != (resource.grade, resource.subject):
            errors.append("book grade/subject does not match catalog")
        primary = {video.video_id: video for video in resource.videos if video.primary_source}
        reviews = {review.source_video_id: review for review in book.source_reviews}
        if reviews.keys() != primary.keys():
            errors.append("source reviews must cover every primary video exactly")
        for video_id, video in primary.items():
            if video_id in reviews and reviews[video_id].reviewed_through_seconds < video.duration_seconds - 10:
                errors.append(f"primary video review is incomplete: {video_id}")
    return errors
