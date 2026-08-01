from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from pypdf import PdfReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfgen import canvas

from scripts.generate_answer_pdfs import build_answer_pdf
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

    def test_generator_can_run_as_the_package_script(self):
        with tempfile.TemporaryDirectory() as directory:
            completed = subprocess.run(
                [
                    sys.executable,
                    "scripts/generate_answer_pdfs.py",
                    "--pdf-dir",
                    str(Path(directory) / "pdf"),
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertIn("Generated 0 answer PDF(s).", completed.stdout)


if __name__ == "__main__":
    unittest.main()
