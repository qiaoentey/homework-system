from dataclasses import replace
from pathlib import Path
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

from pypdf import PdfReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfgen import canvas

from scripts.answer_data import load_answer_book
from scripts.generate_answer_pdfs import answer_book_sha256, build_answer_pdf
from scripts.validate_answer_pdfs import validate_pdf_set
from tests.python.answer_test_helpers import (
    sample_math_book,
    sample_resource,
    write_sample_project,
)


ROOT = Path(__file__).resolve().parents[2]


class AnswerPdfPipelineTests(unittest.TestCase):
    def test_generated_pdf_contains_answers_not_only_links(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "1年级_数学_活动本答案参考.pdf"
            book = sample_math_book(
                answer="47 + 28 = 75",
                checking_note="个位先算 7 + 8",
            )
            pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))

            build_answer_pdf(
                book,
                sample_resource(),
                output,
                font_name="STSong-Light",
            )

            reader = PdfReader(output)
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            self.assertGreaterEqual(len(reader.pages), 2)
            self.assertIn("答案参考", text)
            self.assertIn("47 + 28 = 75", text)
            self.assertNotIn("影片索引", text)

    def test_validator_rejects_a_link_only_pdf(self):
        with tempfile.TemporaryDirectory() as directory:
            catalog_path, books_dir, pdf_dir = write_sample_project(Path(directory))
            path = pdf_dir / "1年级_数学_活动本答案参考.pdf"
            document = canvas.Canvas(str(path))
            document.drawString(72, 720, "https://youtube.com/watch?v=DgRklqnMEHI")
            document.showPage()
            document.showPage()
            document.save()

            errors = validate_pdf_set(pdf_dir, books_dir, catalog_path)

            self.assertTrue(
                any("does not contain answer rows" in error for error in errors),
                errors,
            )

    def test_validator_rejects_a_missing_row_hidden_by_a_duplicate_marker(self):
        with tempfile.TemporaryDirectory() as directory:
            catalog_path, books_dir, pdf_dir = write_sample_project(Path(directory))
            book_path = books_dir / "1-mathematics.json"
            payload = json.loads(book_path.read_text(encoding="utf-8"))
            second_entry = dict(payload["entries"][0])
            second_entry.update({"question": "47 + 29", "answer": "76"})
            payload["entries"].append(second_entry)
            book_path.write_text(
                json.dumps(payload, ensure_ascii=False),
                encoding="utf-8",
            )
            book = load_answer_book(book_path)
            path = pdf_dir / "1年级_数学_活动本答案参考.pdf"
            pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
            document = canvas.Canvas(str(path))
            document.setTitle("1年级 数学 活动本答案参考")
            document.setKeywords(f"book-sha256={answer_book_sha256(book)}")
            document.setFont("STSong-Light", 12)
            document.drawString(72, 720, "答案 #1")
            document.drawString(72, 700, "答案 #1")
            document.showPage()
            document.showPage()
            document.save()

            errors = validate_pdf_set(pdf_dir, books_dir, catalog_path)

            self.assertTrue(
                any("does not contain answer rows" in error for error in errors),
                errors,
            )

    def test_repeated_generation_is_byte_for_byte_deterministic(self):
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first.pdf"
            second = Path(directory) / "second.pdf"
            pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))

            build_answer_pdf(
                sample_math_book(),
                sample_resource(),
                first,
                font_name="STSong-Light",
            )
            build_answer_pdf(
                sample_math_book(),
                sample_resource(),
                second,
                font_name="STSong-Light",
            )

            self.assertEqual(first.read_bytes(), second.read_bytes())

    def test_review_callout_does_not_repeat_an_answer_row_marker(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "review.pdf"
            book = sample_math_book()
            review_entry = replace(book.entries[0], confidence="review")
            book = replace(book, entries=(review_entry,))
            pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))

            build_answer_pdf(
                book,
                sample_resource(),
                output,
                font_name="STSong-Light",
            )

            reader = PdfReader(output)
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            self.assertEqual(re.findall(r"答案\s*#\s*(\d+)", text), ["1"])

    def test_review_note_is_not_split_across_pages(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "review-page-break.pdf"
            base_book = sample_math_book()
            review_note = "BEGIN" + ("复核文字" * 24) + "END"
            entries = tuple(
                replace(
                    base_book.entries[0],
                    page=str(index),
                    question=f"q{index}",
                    answer="答案文字" * 8,
                    checking_note=review_note if index == 8 else "检查",
                    confidence="review" if index == 8 else "verified",
                )
                for index in range(1, 9)
            )
            book = replace(base_book, entries=entries)
            pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))

            build_answer_pdf(
                book,
                sample_resource(),
                output,
                font_name="STSong-Light",
            )

            pages = [
                "".join((page.extract_text() or "").split())
                for page in PdfReader(output).pages
            ]
            expected = "".join(f"第 8 题需人工复核：{review_note}".split())
            self.assertTrue(
                any(expected in page for page in pages),
                "one review note was split across two PDF pages",
            )

    def test_generator_does_not_require_a_font_when_no_books_are_selected(self):
        with tempfile.TemporaryDirectory() as directory:
            isolated_root = Path(directory) / "populated-project"
            write_sample_project(isolated_root)
            shutil.copytree(ROOT / "scripts", isolated_root / "scripts")
            completed = subprocess.run(
                [
                    sys.executable,
                    "scripts/generate_answer_pdfs.py",
                    "--books-dir",
                    str(isolated_root / "empty-books"),
                    "--pdf-dir",
                    str(isolated_root / "generated"),
                ],
                cwd=isolated_root,
                capture_output=True,
                text=True,
                check=False,
                env={
                    **os.environ,
                    "ANSWER_PDF_FONT": str(isolated_root / "missing-font.ttf"),
                },
            )

            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertIn("Generated 0 answer PDF(s).", completed.stdout)


if __name__ == "__main__":
    unittest.main()
