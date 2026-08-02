# Original Activity-Book Answer PDFs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 12 YouTube-index PDFs with 12 mobile-readable PDFs that contain independently organized answer references for Grades 1-3 Chinese, Malay, Mathematics, and Science.

**Architecture:** Keep a reviewed JSON answer dataset as the source of truth, validate it with Python standard-library models, and generate deterministic A5 PDFs with ReportLab. The React catalog consumes a shared resource catalog, while Python validation and CI prevent empty, link-only, wrongly named, incomplete, or unrenderable PDFs from reaching GitHub Pages.

**Tech Stack:** React 19, TypeScript, Vite PWA, Vitest, Playwright, Python 3.11+, ReportLab 4.4.9, pypdf 6.10.0, Poppler, GitHub Actions, GitHub Pages.

## Global Constraints

- Produce exactly 12 PDFs: Grades 1-3 x Chinese, Malay, Mathematics, and Science.
- Use the filename pattern `<grade>年级_<subject>_活动本答案参考.pdf`.
- Use only the official YouTube player. Transient, non-persistent browser visual frames are allowed solely for human review; do not download video, save frames to files, add frames to Git/reports/PDFs, extract audio/thumbnails, or republish textbook/video imagery.
- Use independently written answers, checking notes, rubrics, and short examples; do not copy full model essays.
- Mark uncertain, open-ended, drawing, experiment, or unreadable items as `review` instead of inventing a unique answer.
- Keep the app free, login-free, server-free, and compatible with the `/homework-system/` GitHub Pages base path.
- Preserve the existing Grades 1-6 local mathematics OCR scope and privacy behavior.
- Keep final deployed PDF assets below the existing 5 MiB per-file PWA precache limit.
- Do not modify the unrelated untracked root files `.DS_Store`, `audit/`, `output/`, `scripts/`, or `tmp/`.

---

## File Map

- `homework-checker/answer-data/catalog.json`: single source of grade, subject, PDF filename, playlist, video IDs, durations, and primary-source flags.
- `homework-checker/answer-data/books/*.json`: one reviewed answer dataset per grade/subject.
- `homework-checker/scripts/answer_data.py`: typed loading and validation for catalog and answer books.
- `homework-checker/scripts/answer_pdf_styles.py`: A5 layout, fonts, colors, table styles, headers, and footers.
- `homework-checker/scripts/generate_answer_pdfs.py`: deterministic PDF generation from validated JSON.
- `homework-checker/scripts/validate_answer_pdfs.py`: production PDF count, name, size, page, text, metadata, and dataset/hash validation.
- `homework-checker/tests/python/`: Python unit and contract tests for data and PDFs.
- `homework-checker/tests/python/answer_test_helpers.py`: shared constructors and loaders for real-code Python tests.
- `homework-checker/src/answer-library/catalog.ts`: typed React adapter over `answer-data/catalog.json`.
- `homework-checker/src/answer-library/AnswerLibrary.tsx`: answer-library instructions.
- `homework-checker/src/answer-library/AnswerCard.tsx`: answer PDF primary actions and supplementary video actions.
- `homework-checker/public/pdf/`: the 12 final deployed PDFs only.
- `.github/workflows/homework-checker-ci.yml`: run answer-data/PDF validation before browser tests.
- `.github/workflows/homework-checker-pages.yml`: revalidate PDFs before Pages upload.

---

### Task 1: Create a Single Resource Catalog and Strict Answer-Data Model

**Files:**
- Create: `homework-checker/answer-data/catalog.json`
- Create: `homework-checker/scripts/answer_data.py`
- Create: `homework-checker/tests/python/test_answer_data.py`
- Create: `homework-checker/tests/python/answer_test_helpers.py`
- Modify: `homework-checker/src/answer-library/catalog.ts:1-76`
- Modify: `homework-checker/tests/catalog.test.ts:1-63`

**Interfaces:**
- Consumes: the existing 12-resource and 34-video inventory in `src/answer-library/catalog.ts`.
- Produces: `load_catalog(path: Path) -> Catalog`, `load_answer_book(path: Path) -> AnswerBook`, `validate_answer_book(book: AnswerBook, resource: CatalogResource | None) -> list[str]`, and test helpers `resource_for(id: str)`, `load_named_book(id: str)`, `validate_named_book(book: AnswerBook)`, `sample_math_book()`, `sample_resource()`, and `write_sample_project(root: Path)`.

- [ ] **Step 1: Write the failing data-model tests**

```python
from pathlib import Path
from scripts.answer_data import load_catalog, load_answer_book, validate_answer_book

ROOT = Path(__file__).resolve().parents[2]

def test_catalog_has_twelve_reference_pdfs_and_thirty_four_videos():
    catalog = load_catalog(ROOT / "answer-data/catalog.json")
    assert len(catalog.resources) == 12
    assert sum(len(resource.videos) for resource in catalog.resources) == 34
    assert all(resource.pdf_file.endswith("_活动本答案参考.pdf") for resource in catalog.resources)
    assert all("影片索引" not in resource.pdf_file for resource in catalog.resources)

def test_link_only_book_is_rejected(tmp_path):
    path = tmp_path / "book.json"
    path.write_text('{"grade":1,"subject":"数学","entries":[]}', encoding="utf-8")
    book = load_answer_book(path)
    errors = validate_answer_book(book, resource=None)
    assert "entries must not be empty" in errors
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd homework-checker && python3 -m unittest discover -s tests/python -p 'test_*.py' -v`

Expected: FAIL because `scripts.answer_data` and `answer-data/catalog.json` do not exist.

- [ ] **Step 3: Create the catalog JSON with all existing resource/video values**

Each resource uses this exact shape:

```json
{
  "id": "1-mathematics",
  "grade": 1,
  "subject": "数学",
  "pdfFile": "1年级_数学_活动本答案参考.pdf",
  "playlistUrl": "https://youtube.com/playlist?list=PLLWa_lzrwn3lwW1dGq-JB0NnvUZu2A9ML",
  "videos": [
    {
      "label": "上册完整版",
      "duration": "1:02:21",
      "durationSeconds": 3741,
      "videoId": "DgRklqnMEHI",
      "primarySource": true,
      "linkStatus": "external-unverified",
      "catalogReviewedOn": "2026-07-27"
    }
  ]
}
```

Copy all 34 existing video records exactly. Mark only `完整版`, `上册完整版`, and `下册完整版` entries as `primarySource: true`; quick versions remain supplementary.

- [ ] **Step 4: Implement strict dataclasses and validation**

```python
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

def validate_answer_book(book: AnswerBook, resource: CatalogResource | None) -> list[str]:
    errors: list[str] = []
    if not book.entries:
        errors.append("entries must not be empty")
    for entry in book.entries:
        if not all((entry.volume, entry.page, entry.question, entry.answer)):
            errors.append("answer entries require volume, page, question, and answer")
        if entry.confidence not in {"verified", "review"}:
            errors.append(f"unsupported confidence: {entry.confidence}")
        if re.fullmatch(r"(?:\d{2}:)?\d{2}:\d{2}", entry.source_timecode) is None:
            errors.append(f"invalid source timecode: {entry.source_timecode}")
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
```

Validation must reject blank answers, blank page/location labels, unsupported confidence values, timecodes outside the source duration, missing primary-source review records, and a `reviewedThroughSeconds` value more than 10 seconds short of the declared duration.

- [ ] **Step 5: Replace the TypeScript catalog duplication with a typed JSON adapter**

Import `../../answer-data/catalog.json`, narrow `grade` and `subject` through explicit runtime checks, and preserve the exported `ANSWER_RESOURCES` and `getResources()` interfaces. The React bundle must still expose relative `pdf/<filename>` paths.

- [ ] **Step 6: Run Python and Vitest checks and verify GREEN**

Run: `cd homework-checker && python3 -m unittest discover -s tests/python -p 'test_*.py' -v`

Run: `cd homework-checker && npm test -- tests/catalog.test.ts`

Expected: both commands PASS; the TypeScript test still asserts the exact 34-video inventory.

- [ ] **Step 7: Commit**

```bash
git add homework-checker/answer-data/catalog.json homework-checker/scripts/answer_data.py homework-checker/tests/python/answer_test_helpers.py homework-checker/tests/python/test_answer_data.py homework-checker/src/answer-library/catalog.ts homework-checker/tests/catalog.test.ts
git commit -m "feat: define validated answer resource catalog"
```

---

### Task 2: Build and Test the PDF Generation Pipeline

**Files:**
- Create: `homework-checker/requirements-answer-pdf.txt`
- Create: `homework-checker/scripts/answer_pdf_styles.py`
- Create: `homework-checker/scripts/generate_answer_pdfs.py`
- Create: `homework-checker/scripts/validate_answer_pdfs.py`
- Create: `homework-checker/tests/python/test_answer_pdf_pipeline.py`
- Modify: `homework-checker/package.json:6-14`

**Interfaces:**
- Consumes: `Catalog`, `AnswerBook`, and `validate_answer_book()` from Task 1.
- Produces: `build_answer_pdf(book: AnswerBook, resource: CatalogResource, output_path: Path, font_name: str) -> None` and `validate_pdf_set(pdf_dir: Path, books_dir: Path, catalog_path: Path) -> list[str]`.

- [ ] **Step 1: Write a failing generator test**

```python
from tests.python.answer_test_helpers import sample_math_book, sample_resource

def test_generated_pdf_contains_answers_not_only_links(tmp_path):
    book = sample_math_book(answer="47 + 28 = 75", checking_note="个位先算 7 + 8")
    output = tmp_path / "1年级_数学_活动本答案参考.pdf"
    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    build_answer_pdf(book, sample_resource(), output, font_name="STSong-Light")
    reader = PdfReader(output)
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    assert len(reader.pages) >= 2
    assert "答案参考" in text
    assert "47 + 28 = 75" in text
    assert "影片索引" not in text
```

- [ ] **Step 2: Write a failing link-only rejection test**

```python
from reportlab.pdfgen import canvas
from tests.python.answer_test_helpers import write_sample_project

def test_validator_rejects_a_link_only_pdf(tmp_path):
    catalog_path, books_dir, pdf_dir = write_sample_project(tmp_path)
    path = pdf_dir / "1年级_数学_活动本答案参考.pdf"
    document = canvas.Canvas(str(path))
    document.drawString(72, 720, "https://youtube.com/watch?v=DgRklqnMEHI")
    document.showPage()
    document.showPage()
    document.save()
    errors = validate_pdf_set(pdf_dir, books_dir, catalog_path)
    assert any("does not contain answer rows" in error for error in errors)
```

- [ ] **Step 3: Run the PDF tests and verify RED**

Run: `cd homework-checker && python3 -m unittest tests.python.test_answer_pdf_pipeline -v`

Expected: FAIL because the generator and validator modules do not exist.

- [ ] **Step 4: Pin the PDF dependencies**

```text
reportlab==4.4.9
pypdf==6.10.0
```

- [ ] **Step 5: Implement the A5 generator**

The generator must:

- validate the book before writing;
- write to a temporary sibling file and atomically replace the target only after success;
- register and use the embedded CJK font `/System/Library/Fonts/STHeiti Medium.ttc` on this Mac or the explicit path in `ANSWER_PDF_FONT`; unit tests pass the built-in `STSong-Light` CID font only for isolated fixture generation;
- create cover, grouped quick directory, answer tables, review callouts, source appendix, page numbers, metadata, and a visible non-official-answer disclaimer;
- keep supplementary links in the final appendix rather than the answer table;
- use stable sorting by volume, unit, natural page, and question;
- ensure no table row splits into unreadable fragments;
- compute SHA-256 over the normalized source book JSON and store it as `book-sha256=<hex>` in PDF keywords for later validator comparison.

- [ ] **Step 6: Implement the production PDF validator**

The validator must require exact catalog filenames, exactly 12 files, zero filenames containing `影片索引`, `%PDF-` signatures, at least two pages, non-empty extracted text, correct title metadata, at least one answer row per validated data entry, no missing answer-book hash, and file size below 5 MiB.

- [ ] **Step 7: Add reproducible commands**

Add these scripts to `package.json`:

```json
"test:answers": "python3 -m unittest discover -s tests/python -p 'test_*.py' -v",
"generate:answers": "python3 scripts/generate_answer_pdfs.py",
"verify:answers": "python3 scripts/validate_answer_pdfs.py"
```

- [ ] **Step 8: Run tests and verify GREEN**

Run: `cd homework-checker && python3 -m pip install -r requirements-answer-pdf.txt`

Run: `cd homework-checker && npm run test:answers`

Expected: PASS with the fixture generator and link-only rejection both exercised.

- [ ] **Step 9: Commit**

```bash
git add homework-checker/requirements-answer-pdf.txt homework-checker/scripts/answer_pdf_styles.py homework-checker/scripts/generate_answer_pdfs.py homework-checker/scripts/validate_answer_pdfs.py homework-checker/tests/python/test_answer_pdf_pipeline.py homework-checker/package.json
git commit -m "feat: add validated answer PDF pipeline"
```

---

### Task 3: Review and Encode the Three Mathematics Answer Books

**Files:**
- Create: `homework-checker/answer-data/books/1-mathematics.json`
- Create: `homework-checker/answer-data/books/2-mathematics.json`
- Create: `homework-checker/answer-data/books/3-mathematics.json`
- Create: `homework-checker/tests/python/test_mathematics_answer_data.py`

**Interfaces:**
- Consumes: the Task 1 schema and these primary videos: `DgRklqnMEHI`, `-ukU8RoBV-Q`, `_6-CMY0lIhI`, and `CKrCzJwoPK8`.
- Produces: three complete mathematics `AnswerBook` JSON files accepted by `validate_answer_book()`.

- [ ] **Step 1: Write the failing mathematics coverage test**

```python
EXPECTED = {
    "1-mathematics": {"DgRklqnMEHI", "-ukU8RoBV-Q"},
    "2-mathematics": {"_6-CMY0lIhI"},
    "3-mathematics": {"CKrCzJwoPK8"},
}

def test_math_books_cover_every_primary_source():
    for resource_id, source_ids in EXPECTED.items():
        book = load_named_book(resource_id)
        assert validate_named_book(book) == []
        assert {review.source_video_id for review in book.source_reviews} == source_ids
        assert any(entry.confidence == "verified" for entry in book.entries)
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd homework-checker && python3 -m unittest tests.python.test_mathematics_answer_data -v`

Expected: FAIL because the three mathematics JSON files do not exist.

- [ ] **Step 3: Review the source videos without downloading them**

Open each primary video in the official YouTube player. Seek through every page transition from the opening answer page through the final answer page, record `reviewedThroughSeconds`, and enter only independently organized page/question locations, answers, short calculations, units, and teacher-checking notes. Browser screenshots may be viewed transiently but must not be written to disk, attached to reports, committed, or reused in PDFs. Do not copy textbook question text.

- [ ] **Step 4: Encode mathematics-specific answer rules**

For every application problem, record an original concise calculation in `checkingNote`, retain the final unit in `answer`, and use `review` when the visible information does not support one definite answer. Cover upper and lower volumes separately when the source labels them separately.

- [ ] **Step 5: Run validation and verify GREEN**

Run: `cd homework-checker && python3 -m unittest tests.python.test_mathematics_answer_data -v`

Run: `cd homework-checker && npm run test:answers`

Expected: PASS with all four primary videos reviewed through their declared durations.

- [ ] **Step 6: Generate temporary mathematics PDFs and visually inspect every page**

Run: `cd homework-checker && python3 scripts/generate_answer_pdfs.py --subject 数学 --output-dir ../tmp/pdfs/math`

Run: `pdftoppm -png '../tmp/pdfs/math/1年级_数学_活动本答案参考.pdf' '../tmp/pdfs/math/g1-math'` and repeat for Grades 2 and 3.

Inspect every rendered page for legibility, answer ordering, units, clipping, overlap, and CJK glyph correctness. Correct data or layout defects and rerun validation.

- [ ] **Step 7: Commit**

```bash
git add homework-checker/answer-data/books/1-mathematics.json homework-checker/answer-data/books/2-mathematics.json homework-checker/answer-data/books/3-mathematics.json homework-checker/tests/python/test_mathematics_answer_data.py
git commit -m "data: add reviewed mathematics answers"
```

---

### Task 4: Review and Encode the Three Science Answer Books

**Files:**
- Create: `homework-checker/answer-data/books/1-science.json`
- Create: `homework-checker/answer-data/books/2-science.json`
- Create: `homework-checker/answer-data/books/3-science.json`
- Create: `homework-checker/tests/python/test_science_answer_data.py`

**Interfaces:**
- Consumes: the Task 1 schema and primary videos `RPnSzMHUVBM`, `Gsn7Y9eR2mg`, and `nP0HGVFNQ3M`.
- Produces: three science `AnswerBook` files with keyword acceptance notes and human-review gates.

- [ ] **Step 1: Write the failing primary-source coverage test**

Use the Task 3 test pattern with the exact mapping:

```python
EXPECTED = {
    "1-science": {"RPnSzMHUVBM"},
    "2-science": {"Gsn7Y9eR2mg"},
    "3-science": {"nP0HGVFNQ3M"},
}
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd homework-checker && python3 -m unittest tests.python.test_science_answer_data -v`

Expected: FAIL because the three science book files do not exist.

- [ ] **Step 3: Review all three full videos in the official player**

Record page/question locations, concise keyword answers, acceptable synonyms, and experiment/observation conditions without storing imagery or copying long question text. Mark drawings, subjective observations, and unclear pages as `review`.

- [ ] **Step 4: Validate, render temporary PDFs, and inspect every page**

Run: `cd homework-checker && npm run test:answers`

Run: `cd homework-checker && python3 scripts/generate_answer_pdfs.py --subject 科学 --output-dir ../tmp/pdfs/science`

Render all three PDFs with `pdftoppm -png` and inspect every page for readable keywords, review warnings, grouping, and layout defects.

- [ ] **Step 5: Commit**

```bash
git add homework-checker/answer-data/books/1-science.json homework-checker/answer-data/books/2-science.json homework-checker/answer-data/books/3-science.json homework-checker/tests/python/test_science_answer_data.py
git commit -m "data: add reviewed science answers"
```

---

### Task 5: Review and Encode the Three Chinese Answer Books

**Files:**
- Create: `homework-checker/answer-data/books/1-chinese.json`
- Create: `homework-checker/answer-data/books/2-chinese.json`
- Create: `homework-checker/answer-data/books/3-chinese.json`
- Create: `homework-checker/tests/python/test_chinese_answer_data.py`

**Interfaces:**
- Consumes: primary videos `nTLnzUXU7zk`, `G9HVvzhPtTk`, `CJf5M2ptlhQ`, `pV1L8AT0s4w`, `XNt5cFUKcFQ`, and `014P1XavOSc`.
- Produces: three Chinese `AnswerBook` files with objective answers and original open-response guidance.

- [ ] **Step 1: Write the failing exact-source coverage test**

```python
EXPECTED = {
    "1-chinese": {"nTLnzUXU7zk", "G9HVvzhPtTk"},
    "2-chinese": {"CJf5M2ptlhQ", "pV1L8AT0s4w"},
    "3-chinese": {"XNt5cFUKcFQ", "014P1XavOSc"},
}
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd homework-checker && python3 -m unittest tests.python.test_chinese_answer_data -v`

Expected: FAIL because the three Chinese book files do not exist.

- [ ] **Step 3: Review every upper/lower full video in the official player**

Record short objective answers and independently worded comprehension checkpoints. For sentence-making and composition, write original rubric points and short example phrases; do not transcribe full third-party model passages. Mark responses with multiple acceptable wordings as `review` and state the acceptance criteria.

- [ ] **Step 4: Validate and perform complete visual PDF review**

Run: `cd homework-checker && npm run test:answers`

Generate to `../tmp/pdfs/chinese`, render all pages with `pdftoppm -png`, and inspect text wrapping, punctuation, CJK glyphs, answer grouping, and orange review callouts.

- [ ] **Step 5: Commit**

```bash
git add homework-checker/answer-data/books/1-chinese.json homework-checker/answer-data/books/2-chinese.json homework-checker/answer-data/books/3-chinese.json homework-checker/tests/python/test_chinese_answer_data.py
git commit -m "data: add reviewed Chinese answers"
```

---

### Task 6: Review and Encode the Three Malay Answer Books

**Files:**
- Create: `homework-checker/answer-data/books/1-malay.json`
- Create: `homework-checker/answer-data/books/2-malay.json`
- Create: `homework-checker/answer-data/books/3-malay.json`
- Create: `homework-checker/tests/python/test_malay_answer_data.py`

**Interfaces:**
- Consumes: primary videos `P8eEdOz4y38`, `ny_RadBlf0g`, `X6AAAnHNo9I`, `TQSUQT1NnCk`, `kwFZZuDQc8Q`, and `h9tA-QQg5jA`.
- Produces: three Malay `AnswerBook` files with objective answers and original open-response guidance.

- [ ] **Step 1: Write the failing exact-source coverage test**

```python
EXPECTED = {
    "1-malay": {"P8eEdOz4y38", "ny_RadBlf0g"},
    "2-malay": {"X6AAAnHNo9I", "TQSUQT1NnCk"},
    "3-malay": {"kwFZZuDQc8Q", "h9tA-QQg5jA"},
}
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd homework-checker && python3 -m unittest tests.python.test_malay_answer_data -v`

Expected: FAIL because the three Malay book files do not exist.

- [ ] **Step 3: Review all six full videos in the official player**

Record concise objective answers and independently worded comprehension checks. For bina ayat and karangan, write original acceptance criteria and short phrases instead of copying full examples. Preserve Malay spelling and punctuation exactly in independently produced answers.

- [ ] **Step 4: Validate and visually inspect all Malay PDF pages**

Run: `cd homework-checker && npm run test:answers`

Generate to `../tmp/pdfs/malay`, render all pages with `pdftoppm -png`, and inspect diacritics, wrapping, answer order, review warnings, and footer alignment.

- [ ] **Step 5: Commit**

```bash
git add homework-checker/answer-data/books/1-malay.json homework-checker/answer-data/books/2-malay.json homework-checker/answer-data/books/3-malay.json homework-checker/tests/python/test_malay_answer_data.py
git commit -m "data: add reviewed Malay answers"
```

---

### Task 7: Replace the 12 Index PDFs With the 12 Verified Answer PDFs

**Files:**
- Delete: `homework-checker/public/pdf/*_活动本答案影片索引.pdf`
- Create: `homework-checker/public/pdf/*_活动本答案参考.pdf`
- Modify: `homework-checker/tests/python/test_answer_pdf_pipeline.py`

**Interfaces:**
- Consumes: all 12 validated answer books and `build_answer_pdf()`.
- Produces: exactly 12 production PDFs accepted by `validate_pdf_set()`.

- [ ] **Step 1: Add the failing exact-production-set test**

```python
def test_public_directory_contains_only_twelve_answer_reference_pdfs():
    errors = validate_pdf_set(PUBLIC_PDF_DIR, BOOKS_DIR, CATALOG_PATH)
    assert errors == []
    assert len(list(PUBLIC_PDF_DIR.glob("*.pdf"))) == 12
    assert not list(PUBLIC_PDF_DIR.glob("*影片索引.pdf"))
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd homework-checker && npm run test:answers`

Expected: FAIL because production still contains the 12 old index PDFs and none of the new filenames.

- [ ] **Step 3: Generate all answer PDFs to a clean temporary directory**

Run: `cd homework-checker && python3 scripts/generate_answer_pdfs.py --output-dir ../tmp/pdfs/final-candidate`

Run: `cd homework-checker && python3 scripts/validate_answer_pdfs.py --pdf-dir ../tmp/pdfs/final-candidate`

Expected: exactly 12 valid answer-reference PDFs and no link-only document.

- [ ] **Step 4: Render and visually inspect every page of all 12 candidates**

Run: `mkdir -p tmp/pdfs/rendered` from the repository root, then run `pdftoppm -png` once per candidate PDF into `tmp/pdfs/rendered/<resource-id>`.

Inspect every rendered page. Correct any clipped rows, missing glyphs, inconsistent headers, poor contrast, orphaned headings, inaccurate confidence coloring, or blank pages, regenerate, and revalidate.

- [ ] **Step 5: Replace the production set only after candidate validation passes**

Remove the 12 explicitly named `*_活动本答案影片索引.pdf` files, then copy the 12 validated candidates into `homework-checker/public/pdf/`. Do not use a broad recursive delete.

- [ ] **Step 6: Reopen and revalidate the production copies**

Run: `cd homework-checker && npm run verify:answers`

Expected: PASS, with exactly 12 filenames, matching dataset hashes, readable answer rows, valid metadata, and each file below 5 MiB.

- [ ] **Step 7: Commit**

```bash
git add homework-checker/public/pdf homework-checker/tests/python/test_answer_pdf_pipeline.py
git commit -m "feat: replace video indexes with answer PDFs"
```

---

### Task 8: Make Answer PDFs Primary in the Mobile Website

**Files:**
- Modify: `homework-checker/src/answer-library/AnswerLibrary.tsx:1-80`
- Modify: `homework-checker/src/answer-library/AnswerCard.tsx:1-55`
- Modify: `homework-checker/src/app/App.tsx:30-48`
- Modify: `homework-checker/tests/app.test.tsx:79-87`
- Modify: `homework-checker/e2e/answer-library.spec.ts:4-14`
- Modify: `homework-checker/e2e/offline.spec.ts:1-55`
- Modify: `homework-checker/README.md:1-105`

**Interfaces:**
- Consumes: the new catalog `pdfPath` values and 12 production PDFs.
- Produces: mobile UI copy that presents PDF answers as the primary resource and YouTube as supplementary explanation.

- [ ] **Step 1: Change the component and E2E expectations first**

```ts
expect(screen.getByRole("link", { name: "打开一年级数学答案 PDF" }))
  .toHaveAttribute("href", "pdf/1年级_数学_活动本答案参考.pdf");
expect(screen.getByText("PDF 内含答案参考；影片仅供补充讲解")).toBeVisible();
expect(screen.getByRole("heading", { name: "补充讲解影片" })).toBeVisible();
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd homework-checker && npm test -- tests/app.test.tsx tests/catalog.test.ts`

Expected: FAIL because the current labels and hrefs still describe/open index PDFs.

- [ ] **Step 3: Update the UI with PDF-first wording**

Use `打开答案 PDF`, `下载答案 PDF`, and `补充讲解影片`. Keep both PDF actions available offline after precache; display the online warning only within the supplementary video section.

- [ ] **Step 4: Update E2E paths and offline expectations**

The Grade 3 Science test must resolve to `pdf/3年级_科学_活动本答案参考.pdf`. The offline test must fetch that PDF and verify `%PDF-`, `application/pdf`, and a non-trivial byte length.

- [ ] **Step 5: Correct README claims**

State that the 12 bundled files contain independently organized answer references, are not official publisher keys, and do not copy third-party video imagery. Remove every claim that calls them video-index documents.

- [ ] **Step 6: Run focused and complete UI tests**

Run: `cd homework-checker && npm test -- tests/app.test.tsx tests/catalog.test.ts`

Run: `cd homework-checker && npm test`

Expected: all tests PASS with no references to `活动本答案影片索引.pdf` outside historical design/plan documents.

- [ ] **Step 7: Commit**

```bash
git add homework-checker/src homework-checker/tests homework-checker/e2e homework-checker/README.md
git commit -m "feat: make answer PDFs primary in library"
```

---

### Task 9: Enforce Answer-PDF Quality in Builds and GitHub Actions

**Files:**
- Modify: `homework-checker/scripts/verify-pages-build.mjs:16-18,330-358`
- Modify: `homework-checker/tests/pagesBuildContract.test.ts:1-175`
- Modify: `homework-checker/tests/pagesWorkflow.test.ts:1-260`
- Modify: `homework-checker/package.json:6-14`
- Modify: `.github/workflows/homework-checker-ci.yml:1-42`
- Modify: `.github/workflows/homework-checker-pages.yml:1-45`

**Interfaces:**
- Consumes: `npm run test:answers`, `npm run verify:answers`, the exact 12 PDF filenames, and the existing 23-entry PWA precache contract.
- Produces: CI and Pages workflows that refuse index PDFs or invalid answer PDFs.

- [ ] **Step 1: Add a failing Pages-build contract case**

Create a fixture artifact containing 12 non-empty PDFs where one is named `1年级_华文_活动本答案影片索引.pdf`. Assert that `verify-pages-build.mjs` exits non-zero with `PDF filenames must end with 活动本答案参考.pdf`.

- [ ] **Step 2: Add failing workflow assertions**

Assert both workflows set up Python 3.11, install `requirements-answer-pdf.txt`, run `npm run test:answers`, and run `npm run verify:answers` before build/deployment upload.

- [ ] **Step 3: Run the focused tests and verify RED**

Run: `cd homework-checker && npm test -- tests/pagesBuildContract.test.ts tests/pagesWorkflow.test.ts`

Expected: FAIL because filename/content validation and Python workflow steps are absent.

- [ ] **Step 4: Harden the Pages build verifier**

Require the exact 12 catalog filenames, reject any name containing `影片索引`, retain the exact 12-PDF and 23-precache-entry counts, and continue requiring every PDF to be non-empty and precached.

- [ ] **Step 5: Add Python gates to both workflows**

Before Node build steps, add `actions/setup-python@v5` with `python-version: '3.11'`, install the pinned requirements, run Python unit tests, and validate the committed production PDFs. Keep workflow permissions and Pages `workflow_run.head_sha` checkout unchanged.

- [ ] **Step 6: Run contract tests and verify GREEN**

Run: `cd homework-checker && npm test -- tests/pagesBuildContract.test.ts tests/pagesWorkflow.test.ts`

Run: `cd homework-checker && npm run build:pages && npm run verify:pages`

Expected: PASS with 23 precache entries and exactly 12 answer-reference PDFs.

- [ ] **Step 7: Commit**

```bash
git add homework-checker/scripts/verify-pages-build.mjs homework-checker/tests/pagesBuildContract.test.ts homework-checker/tests/pagesWorkflow.test.ts homework-checker/package.json .github/workflows/homework-checker-ci.yml .github/workflows/homework-checker-pages.yml
git commit -m "ci: require validated answer PDFs"
```

---

### Task 10: Complete Verification, Publish, and Physical-Phone Gate

**Files:**
- Modify only if verification finds a scoped defect.

**Interfaces:**
- Consumes: the complete branch from Tasks 1-9.
- Produces: a verified GitHub branch, successful CI/Pages deployment, public hashes matching local PDFs, and a documented real-phone check.

- [ ] **Step 1: Run the complete local verification suite**

Run in `homework-checker/`:

```bash
npm run test:answers
npm run verify:answers
npm test
npm run build
npm run build:pages
npm run verify:pages
npm audit --audit-level=high
npm run test:e2e
npm run test:e2e:pages
```

Expected: every command exits 0; expected browser capability skips remain explicitly reported rather than converted to passes.

- [ ] **Step 2: Re-render all final PDFs after the last meaningful change**

Render every `homework-checker/public/pdf/*.pdf` page to `tmp/pdfs/final-render/` with `pdftoppm -png`. Inspect all pages and require zero clipping, overlap, missing glyphs, black squares, blank answer pages, or unreadable table text.

- [ ] **Step 3: Verify repository scope**

Run: `git diff --check`, `git status --short --branch`, and `git diff --stat main...HEAD`.

Confirm unrelated root untracked files remain untouched and no captured video/image/audio asset is present in the diff.

- [ ] **Step 4: Push the feature branch and wait for CI**

Run: `git push -u origin codex/original-answer-pdfs`.

Require the Homework checker CI run for the pushed commit to complete successfully before merging.

- [ ] **Step 5: Merge and verify GitHub Pages**

Fast-forward or merge the reviewed branch into `main`, push `main`, wait for the Pages workflow tied to the exact merge SHA, and verify the public site loads `/homework-system/#/answers` plus all 12 new PDF URLs.

- [ ] **Step 6: Compare deployed and local PDF hashes**

Calculate SHA-256 for all 12 local production PDFs and the corresponding files fetched from `https://qiaoentey.github.io/homework-system/pdf/`. Require an exact filename-by-filename match.

- [ ] **Step 7: Run the physical-phone acceptance check**

On iPhone Safari and Android Chrome, open one mathematics PDF and one language PDF, download them, enable airplane mode, reopen both, and confirm zooming and text remain readable. Record device/browser, PDF names, online-open result, download result, and offline-reopen result; do not record student data.

- [ ] **Step 8: Report the release accurately**

Provide the public website URL, CI/Pages run links, 12 final PDF file citations, automated test totals, and physical-device results. If either physical device is unavailable, state that exact remaining gate instead of claiming full mobile verification.
