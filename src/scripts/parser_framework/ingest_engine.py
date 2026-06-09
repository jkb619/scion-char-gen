"""Ingest Engine — PDF to plaintext extraction for the Parser Framework.

Resolves PDF paths using scion_books_dir search directories, extracts text
page-by-page with pypdf, inserts page markers, normalizes excessive newlines,
and writes UTF-8 output files.
"""

from __future__ import annotations

import re
from pathlib import Path

from pypdf import PdfReader

from parser_framework.models import BookSpec, IngestResult

# Repo root: ingest_engine.py is at src/scripts/parser_framework/ingest_engine.py
# parents: [0]=parser_framework, [1]=scripts, [2]=src, [3]=character-creator (repo root)
_REPO_ROOT = Path(__file__).resolve().parents[3]

# Pattern to collapse 4+ consecutive newlines to exactly 3
_EXCESSIVE_NEWLINES_RE = re.compile(r"\n{4,}")


def resolve_pdf(spec: BookSpec, search_dirs: list[Path]) -> Path:
    """Find the first existing PDF from spec.filenames across search_dirs.

    Iterates search directories in priority order. Within each directory,
    checks filename candidates in declaration order. Returns the first
    candidate that exists as a file.

    Args:
        spec: Book specification containing candidate filenames.
        search_dirs: Directories to search, in priority order.

    Returns:
        Path to the first existing PDF file found.

    Raises:
        FileNotFoundError: If no candidate file exists in any search directory.
            The message includes the book_id, all candidate filenames, and all
            search directories that were checked.
    """
    for directory in search_dirs:
        for filename in spec.filenames:
            candidate = directory / filename
            if candidate.is_file():
                return candidate

    # No file found — build an informative error message
    candidates_str = ", ".join(spec.filenames)
    dirs_str = ", ".join(str(d) for d in search_dirs)
    raise FileNotFoundError(
        f"PDF not found for book '{spec.book_id}'. "
        f"Candidates: [{candidates_str}]. "
        f"Search directories: [{dirs_str}]."
    )


def ingest(spec: BookSpec, search_dirs: list[Path]) -> IngestResult:
    """Resolve PDF, extract text page-by-page, and write to output_path.

    Extracts text from each page using pypdf, prepending a page marker in
    the format ``===== Page N / Total =====`` before each page's text.
    If a page's extraction raises an exception, an error marker is inserted
    instead. After assembly, runs of 4+ consecutive newlines are normalized
    to exactly 3. The result is written as UTF-8 to the output path from
    the Book Spec (resolved relative to repo root).

    Args:
        spec: Book specification with filenames and output_path.
        search_dirs: Directories to search for the PDF.

    Returns:
        IngestResult with book_id, output_path, page_count, and any errors.

    Raises:
        FileNotFoundError: If the PDF cannot be located.
    """
    pdf_path = resolve_pdf(spec, search_dirs)
    reader = PdfReader(str(pdf_path))
    total_pages = len(reader.pages)

    parts: list[str] = []
    errors: list[str] = []

    for page_num in range(total_pages):
        # 1-indexed page number
        n = page_num + 1
        marker = f"===== Page {n} / {total_pages} ====="

        try:
            page_text = reader.pages[page_num].extract_text() or ""
        except Exception as exc:
            error_msg = f"[page {n}: extract error: {exc}]"
            errors.append(error_msg)
            parts.append(f"{marker}\n{error_msg}")
            continue

        parts.append(f"{marker}\n{page_text}")

    # Join all pages
    full_text = "\n".join(parts)

    # Normalize runs of 4+ newlines down to exactly 3
    full_text = _EXCESSIVE_NEWLINES_RE.sub("\n\n\n", full_text)

    # Resolve output path relative to repo root
    output_path = _REPO_ROOT / spec.output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(full_text, encoding="utf-8")

    return IngestResult(
        book_id=spec.book_id,
        output_path=output_path,
        page_count=total_pages,
        errors=errors,
    )
