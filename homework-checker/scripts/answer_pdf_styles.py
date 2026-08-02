"""Shared A5 typography and colors for answer-reference PDFs."""

from __future__ import annotations

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet


INK = colors.HexColor("#16324F")
ACCENT = colors.HexColor("#167D8D")
WARM = colors.HexColor("#FFF3D6")
MUTED = colors.HexColor("#526170")
GRID = colors.HexColor("#B8C8D1")
WHITE = colors.white


def answer_pdf_styles(font_name: str) -> dict[str, ParagraphStyle]:
    """Return the compact, CJK-safe style set used by the generator."""

    base = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle(
            "AnswerCoverTitle",
            parent=base["Title"],
            fontName=font_name,
            fontSize=24,
            leading=32,
            textColor=INK,
            alignment=TA_CENTER,
            wordWrap="CJK",
            spaceAfter=18,
        ),
        "cover_subtitle": ParagraphStyle(
            "AnswerCoverSubtitle",
            parent=base["Normal"],
            fontName=font_name,
            fontSize=11,
            leading=17,
            textColor=MUTED,
            alignment=TA_CENTER,
            wordWrap="CJK",
        ),
        "heading": ParagraphStyle(
            "AnswerHeading",
            parent=base["Heading1"],
            fontName=font_name,
            fontSize=16,
            leading=22,
            textColor=INK,
            wordWrap="CJK",
            spaceBefore=8,
            spaceAfter=9,
        ),
        "subheading": ParagraphStyle(
            "AnswerSubheading",
            parent=base["Heading2"],
            fontName=font_name,
            fontSize=12,
            leading=17,
            textColor=ACCENT,
            wordWrap="CJK",
            spaceBefore=7,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "AnswerBody",
            parent=base["BodyText"],
            fontName=font_name,
            fontSize=8.5,
            leading=12,
            textColor=INK,
            alignment=TA_LEFT,
            wordWrap="CJK",
        ),
        "small": ParagraphStyle(
            "AnswerSmall",
            parent=base["BodyText"],
            fontName=font_name,
            fontSize=7.5,
            leading=10.5,
            textColor=MUTED,
            wordWrap="CJK",
        ),
        "table_head": ParagraphStyle(
            "AnswerTableHead",
            parent=base["BodyText"],
            fontName=font_name,
            fontSize=7.5,
            leading=10,
            textColor=WHITE,
            alignment=TA_CENTER,
            wordWrap="CJK",
        ),
        "table": ParagraphStyle(
            "AnswerTable",
            parent=base["BodyText"],
            fontName=font_name,
            fontSize=7.2,
            leading=10.2,
            textColor=INK,
            wordWrap="CJK",
        ),
        "callout": ParagraphStyle(
            "AnswerCallout",
            parent=base["BodyText"],
            fontName=font_name,
            fontSize=8,
            leading=12,
            textColor=INK,
            wordWrap="CJK",
            borderColor=colors.HexColor("#E4B84F"),
            borderWidth=0.6,
            borderPadding=7,
            backColor=WARM,
            spaceBefore=4,
            spaceAfter=7,
        ),
    }
