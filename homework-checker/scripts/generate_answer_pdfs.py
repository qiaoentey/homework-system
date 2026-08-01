"""Generate deterministic, validated A5 answer-reference PDFs."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from typing import Iterable
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A5
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if __package__ in {None, ""}:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.answer_data import (
    AnswerBook,
    AnswerEntry,
    CatalogResource,
    load_answer_book,
    load_catalog,
    validate_answer_book,
)
from scripts.answer_pdf_styles import (
    ACCENT,
    GRID,
    MUTED,
    WHITE,
    answer_pdf_styles,
)


ROOT = PROJECT_ROOT
DEFAULT_FONT_PATH = Path("/System/Library/Fonts/STHeiti Medium.ttc")
PRODUCTION_FONT_NAME = "AnswerCJK"


def _book_payload(book: AnswerBook) -> dict[str, object]:
    return {
        "resourceId": book.resource_id,
        "grade": book.grade,
        "subject": book.subject,
        "updatedOn": book.updated_on,
        "sourceReviews": [
            {
                "sourceVideoId": review.source_video_id,
                "reviewedThroughSeconds": review.reviewed_through_seconds,
            }
            for review in book.source_reviews
        ],
        "entries": [
            {
                "volume": entry.volume,
                "unit": entry.unit,
                "page": entry.page,
                "question": entry.question,
                "answer": entry.answer,
                "checkingNote": entry.checking_note,
                "confidence": entry.confidence,
                "sourceVideoId": entry.source_video_id,
                "sourceTimecode": entry.source_timecode,
            }
            for entry in book.entries
        ],
    }


def answer_book_sha256(book: AnswerBook) -> str:
    """Hash the canonical JSON representation used by both build and validation."""

    normalized = json.dumps(
        _book_payload(book),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(normalized).hexdigest()


def _natural_key(value: str) -> tuple[tuple[int, object], ...]:
    return tuple(
        (0, int(part)) if part.isdigit() else (1, part.casefold())
        for part in re.split(r"(\d+)", value)
        if part
    )


def _entry_key(entry: AnswerEntry) -> tuple[object, ...]:
    return (
        _natural_key(entry.volume),
        _natural_key(entry.unit),
        _natural_key(entry.page),
        _natural_key(entry.question),
    )


def _title(resource: CatalogResource) -> str:
    return f"{resource.grade}年级 {resource.subject} 活动本答案参考"


def _paragraph(value: object, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(str(value)).replace("\n", "<br/>"), style)


def _page_callback(
    title: str,
    keywords: str,
    font_name: str,
):
    def decorate(page_canvas: canvas.Canvas, document: SimpleDocTemplate) -> None:
        page_canvas.setTitle(title)
        page_canvas.setAuthor("作业检查工具")
        page_canvas.setSubject("活动本答案参考 - 非官方答案")
        page_canvas.setCreator("homework-checker answer PDF pipeline")
        page_canvas.setKeywords(keywords)
        page_canvas.saveState()
        page_canvas.setFont(font_name, 7.5)
        page_canvas.setFillColor(MUTED)
        page_canvas.drawCentredString(A5[0] / 2, 9 * mm, f"第 {document.page} 页")
        page_canvas.restoreState()

    return decorate


def _answer_table(
    entries: Iterable[tuple[int, AnswerEntry]],
    styles: dict[str, ParagraphStyle],
) -> Table:
    rows = [[
        _paragraph("答案 #", styles["table_head"]),
        _paragraph("页 / 题", styles["table_head"]),
        _paragraph("答案", styles["table_head"]),
        _paragraph("检查提示", styles["table_head"]),
    ]]
    for number, entry in entries:
        rows.append([
            _paragraph(f"答案 #{number}", styles["table"]),
            _paragraph(f"{entry.page} / {entry.question}", styles["table"]),
            _paragraph(entry.answer, styles["table"]),
            _paragraph(entry.checking_note or "-", styles["table"]),
        ])
    table = Table(
        rows,
        colWidths=(22 * mm, 27 * mm, 42 * mm, 34 * mm),
        repeatRows=1,
        splitByRow=1,
        splitInRow=0,
        hAlign="LEFT",
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.35, GRID),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def build_answer_pdf(
    book: AnswerBook,
    resource: CatalogResource,
    output_path: Path,
    font_name: str,
) -> None:
    """Build one validated PDF, replacing the target atomically on success."""

    validation_errors = validate_answer_book(book, resource)
    if book.resource_id != resource.id:
        validation_errors.append("book resource ID does not match catalog")
    if validation_errors:
        raise ValueError("invalid answer book: " + "; ".join(validation_errors))

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        dir=output_path.parent,
        prefix=f".{output_path.name}.",
        suffix=".tmp",
    )
    os.close(descriptor)
    temporary_path = Path(temporary_name)
    title = _title(resource)
    book_hash = answer_book_sha256(book)
    keywords = f"book-sha256={book_hash}; answer-rows={len(book.entries)}"
    styles = answer_pdf_styles(font_name)

    try:
        document = SimpleDocTemplate(
            str(temporary_path),
            pagesize=A5,
            leftMargin=11 * mm,
            rightMargin=11 * mm,
            topMargin=14 * mm,
            bottomMargin=16 * mm,
            title=title,
            author="作业检查工具",
            subject="活动本答案参考 - 非官方答案",
            keywords=keywords,
            invariant=1,
        )
        story: list[object] = [
            Spacer(1, 28 * mm),
            _paragraph(title, styles["cover_title"]),
            Spacer(1, 8 * mm),
            _paragraph(f"资料更新日期：{book.updated_on}", styles["cover_subtitle"]),
            Spacer(1, 16 * mm),
            _paragraph(
                "本文件是供家长与学生核对作业的非官方答案参考；"
                "如与学校、教师或课本内容不一致，请以授课教师与正式教材为准。",
                styles["callout"],
            ),
            PageBreak(),
            _paragraph("快速目录", styles["heading"]),
        ]

        sorted_entries = sorted(book.entries, key=_entry_key)
        groups: dict[tuple[str, str], list[tuple[int, AnswerEntry]]] = {}
        for number, entry in enumerate(sorted_entries, start=1):
            groups.setdefault((entry.volume, entry.unit), []).append((number, entry))
        for (volume, unit), entries in groups.items():
            story.append(_paragraph(
                f"{volume} - {unit}：{len(entries)} 题（第 {entries[0][1].page} 页起）",
                styles["body"],
            ))
            story.append(Spacer(1, 2 * mm))

        story.extend([PageBreak(), _paragraph("答案表", styles["heading"])])
        for (volume, unit), entries in groups.items():
            story.append(_paragraph(f"{volume} - {unit}", styles["subheading"]))
            story.append(_answer_table(entries, styles))
            review_items = [
                (number, entry)
                for number, entry in entries
                if entry.confidence == "review"
            ]
            if review_items:
                notes = "<br/>".join(
                    f"第 {number} 题需人工复核：{escape(entry.checking_note or entry.answer)}"
                    for number, entry in review_items
                )
                story.append(Paragraph(notes, styles["callout"]))
            story.append(Spacer(1, 4 * mm))

        story.extend([
            PageBreak(),
            _paragraph("来源与补充资料", styles["heading"]),
            _paragraph(
                "以下链接仅放在附录，不代替上方可直接阅读的答案表。",
                styles["callout"],
            ),
            _paragraph(f"播放清单：{resource.playlist_url}", styles["body"]),
            Spacer(1, 3 * mm),
        ])
        review_by_id = {
            review.source_video_id: review.reviewed_through_seconds
            for review in book.source_reviews
        }
        for video in resource.videos:
            review_text = (
                f"；已复核至 {review_by_id[video.video_id]} 秒"
                if video.video_id in review_by_id
                else "；补充链接"
            )
            story.append(_paragraph(
                f"{video.label}：https://youtube.com/watch?v={video.video_id}"
                f"（{video.duration}{review_text}）",
                styles["small"],
            ))
            story.append(Spacer(1, 1.5 * mm))

        callback = _page_callback(title, keywords, font_name)
        document.build(
            story,
            onFirstPage=callback,
            onLaterPages=callback,
        )
        os.replace(temporary_path, output_path)
    except BaseException:
        temporary_path.unlink(missing_ok=True)
        raise


def register_production_font() -> str:
    """Register the configured embedded CJK font and return its ReportLab name."""

    configured = os.environ.get("ANSWER_PDF_FONT")
    font_path = Path(configured) if configured else DEFAULT_FONT_PATH
    if not font_path.is_file():
        source = "ANSWER_PDF_FONT" if configured else str(DEFAULT_FONT_PATH)
        raise FileNotFoundError(f"answer PDF font not found: {source}")
    if PRODUCTION_FONT_NAME not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(PRODUCTION_FONT_NAME, str(font_path), subfontIndex=0))
    return PRODUCTION_FONT_NAME


def generate_existing_books(
    catalog_path: Path,
    books_dir: Path,
    pdf_dir: Path,
    requested_ids: set[str] | None = None,
) -> list[Path]:
    """Generate requested books, or only the validated book files that exist."""

    catalog = load_catalog(catalog_path)
    resources = {resource.id: resource for resource in catalog.resources}
    if requested_ids:
        unknown = requested_ids - resources.keys()
        if unknown:
            raise ValueError(f"unknown resource IDs: {sorted(unknown)}")
        selected = [resources[id] for id in sorted(requested_ids)]
    else:
        selected = [
            resource
            for resource in catalog.resources
            if (books_dir / f"{resource.id}.json").is_file()
        ]
    font_name = register_production_font()
    outputs: list[Path] = []
    for resource in selected:
        book_path = books_dir / f"{resource.id}.json"
        if not book_path.is_file():
            raise FileNotFoundError(f"answer book not found: {book_path}")
        book = load_answer_book(book_path)
        output = pdf_dir / resource.pdf_file
        build_answer_pdf(book, resource, output, font_name)
        outputs.append(output)
    return outputs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=ROOT / "answer-data/catalog.json")
    parser.add_argument("--books-dir", type=Path, default=ROOT / "answer-data/books")
    parser.add_argument("--pdf-dir", type=Path, default=ROOT / "public/pdf")
    parser.add_argument("--resource", action="append", default=[])
    args = parser.parse_args()
    outputs = generate_existing_books(
        args.catalog,
        args.books_dir,
        args.pdf_dir,
        set(args.resource) or None,
    )
    print(f"Generated {len(outputs)} answer PDF(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
