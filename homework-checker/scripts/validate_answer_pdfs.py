"""Fail-closed validation for the complete production answer-PDF set."""

from __future__ import annotations

import argparse
from pathlib import Path
import re
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if __package__ in {None, ""}:
    sys.path.insert(0, str(PROJECT_ROOT))

from pypdf import PdfReader

from scripts.answer_data import load_answer_book, load_catalog, validate_answer_book
from scripts.generate_answer_pdfs import answer_book_sha256


ROOT = PROJECT_ROOT
MAX_PDF_SIZE = 5 * 1024 * 1024
BOOK_HASH_PATTERN = re.compile(r"(?:^|[;\s])book-sha256=([0-9a-f]{64})(?:$|[;\s])")
ANSWER_ROW_PATTERN = re.compile(r"答案\s*#\s*(\d+)")


def _expected_title(grade: int, subject: str) -> str:
    return f"{grade}年级 {subject} 活动本答案参考"


def validate_pdf_set(
    pdf_dir: Path,
    books_dir: Path,
    catalog_path: Path,
) -> list[str]:
    """Return every catalog, book, and PDF contract violation found."""

    errors: list[str] = []
    try:
        catalog = load_catalog(catalog_path)
    except (OSError, ValueError) as error:
        return [f"catalog could not be loaded: {error}"]

    expected_names = {resource.pdf_file for resource in catalog.resources}
    actual_paths = sorted(pdf_dir.glob("*.pdf")) if pdf_dir.is_dir() else []
    actual_names = {path.name for path in actual_paths}
    if len(actual_paths) != 12:
        errors.append(f"expected exactly 12 PDF files, found {len(actual_paths)}")
    for name in sorted(expected_names - actual_names):
        errors.append(f"missing catalog PDF: {name}")
    for name in sorted(actual_names - expected_names):
        errors.append(f"unexpected PDF filename: {name}")
    for path in actual_paths:
        if "影片索引" in path.name:
            errors.append(f"forbidden 影片索引 filename: {path.name}")

    for resource in catalog.resources:
        book_path = books_dir / f"{resource.id}.json"
        if not book_path.is_file():
            errors.append(f"missing answer book: {book_path.name}")
            continue
        try:
            book = load_answer_book(book_path)
        except (OSError, ValueError) as error:
            errors.append(f"invalid answer book {book_path.name}: {error}")
            continue
        book_errors = validate_answer_book(book, resource)
        if book.resource_id != resource.id:
            book_errors.append("book resource ID does not match catalog")
        if book_errors:
            errors.extend(f"{book_path.name}: {error}" for error in book_errors)
            continue

        path = pdf_dir / resource.pdf_file
        if not path.is_file():
            continue
        try:
            if path.stat().st_size >= MAX_PDF_SIZE:
                errors.append(f"PDF is not below 5 MiB: {path.name}")
            with path.open("rb") as stream:
                if stream.read(5) != b"%PDF-":
                    errors.append(f"invalid PDF signature: {path.name}")
                    continue
            reader = PdfReader(path)
        except Exception as error:
            errors.append(f"unreadable PDF {path.name}: {error}")
            continue

        if len(reader.pages) < 2:
            errors.append(f"PDF has fewer than two pages: {path.name}")
        try:
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as error:
            errors.append(f"could not extract PDF text {path.name}: {error}")
            continue
        if not text.strip():
            errors.append(f"PDF has no extractable text: {path.name}")
        title = reader.metadata.title if reader.metadata else None
        if title != _expected_title(resource.grade, resource.subject):
            errors.append(f"incorrect PDF title metadata: {path.name}")
        keywords = str(reader.metadata.get("/Keywords", "")) if reader.metadata else ""
        match = BOOK_HASH_PATTERN.search(keywords)
        if match is None:
            errors.append(f"missing answer-book hash: {path.name}")
        elif match.group(1) != answer_book_sha256(book):
            errors.append(f"answer-book hash mismatch: {path.name}")
        actual_row_numbers = {
            int(number) for number in ANSWER_ROW_PATTERN.findall(text)
        }
        expected_row_numbers = set(range(1, len(book.entries) + 1))
        if actual_row_numbers != expected_row_numbers:
            errors.append(f"{path.name} does not contain answer rows for every data entry")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=ROOT / "answer-data/catalog.json")
    parser.add_argument("--books-dir", type=Path, default=ROOT / "answer-data/books")
    parser.add_argument("--pdf-dir", type=Path, default=ROOT / "public/pdf")
    args = parser.parse_args()
    errors = validate_pdf_set(args.pdf_dir, args.books_dir, args.catalog)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print("Validated 12 answer PDFs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
