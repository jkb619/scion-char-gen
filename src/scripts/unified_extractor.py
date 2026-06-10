#!/usr/bin/env python3
"""Unified PDF Extractor — single entry point for all Scion PDF extraction.

Replaces the ~14 standalone extraction scripts with one spec-driven pipeline
that processes all Scion PDFs and produces every JSON data file the application
consumes.

Usage:
  python3 src/scripts/unified_extractor.py                  # process all books
  python3 src/scripts/unified_extractor.py --book pandoras_box  # single book
  python3 src/scripts/unified_extractor.py --books-dir /path/to/pdfs
  python3 src/scripts/unified_extractor.py --dry-run --verbose
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Ensure src/scripts is on sys.path so parser_framework and scion_books_dir
# are importable regardless of working directory.
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from extraction_logger import (
    check_regression,
    report_error,
    report_ok,
    report_skip,
    report_dependency_skip,
    write_verbose_log,
)
from parser_framework.spec_loader import SpecValidationError, load_specs
from parser_framework.ingest_engine import ingest as ingest_pdf
from parser_framework.output_writer import write_output
from parser_framework.models import BookSpec
from parser_framework.validation_reporter import load_baseline
from scion_books_dir import books_search_dirs, find_pdf_in_books

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SPECS_DIR = _SCRIPTS / "book_specs"
_BASELINE_DIR = _REPO_ROOT / "src" / "data" / "_baselines"


# ---------------------------------------------------------------------------
# Per-book pipeline
# ---------------------------------------------------------------------------


def _ingest_text(spec: BookSpec, pdf_path: Path) -> str | None:
    """Ingest PDF text via pypdf or PyMuPDF depending on extraction_mode.

    Returns the extracted full text string, or None if ingestion fails.
    Raises ImportError if PyMuPDF is required but not installed.
    Raises Exception for corrupt/unreadable PDFs.
    """
    if spec.extraction_mode == "pymupdf":
        import fitz  # PyMuPDF — may raise ImportError

        doc = fitz.open(str(pdf_path))
        try:
            parts: list[str] = []
            total_pages = len(doc)
            for page_num in range(total_pages):
                marker = f"===== Page {page_num + 1} / {total_pages} ====="
                page = doc[page_num]
                blocks = page.get_text("blocks")
                blocks.sort(key=lambda b: (b[1], b[0]))
                page_text = "\n".join(
                    block[4] for block in blocks if block[6] == 0
                )
                parts.append(f"{marker}\n{page_text}")
            return "\n".join(parts)
        finally:
            doc.close()
    else:
        # pypdf mode — use the existing ingest engine
        search_dirs = [pdf_path.parent]
        result = ingest_pdf(spec, search_dirs)
        # Read the output file that was written by ingest
        return result.output_path.read_text(encoding="utf-8")


def _run_pipeline(spec: BookSpec, pdf_path: Path, *, dry_run: bool, verbose: bool) -> bool:
    """Run the per-book extraction pipeline. Returns True on success.

    Stages:
    1. Ingest — extract plaintext from the PDF
    2. Extract — dispatch to category extractors for each declared category
    3. Validate — (placeholder for task 6.2 verbose logging)
    4. Output — write JSON to declared paths

    Error handling:
    - Corrupt/unreadable PDF: prints [ERROR], returns False (sets exit code 1)
    - Missing PyMuPDF when required: prints [WARN], returns True (skip, no error)
    - Missing category in text: produces empty result, no exception
    """
    # ------------------------------------------------------------------
    # Stage 1: Ingestion
    # ------------------------------------------------------------------
    try:
        text = _ingest_text(spec, pdf_path)
    except ImportError:
        # PyMuPDF not installed — skip this book gracefully (Req 9.5)
        report_dependency_skip(spec.book_id, "pymupdf")
        return True  # Not an error — does not set exit code 1
    except Exception as exc:
        # Corrupt or unreadable PDF (Req 9.1)
        report_error(
            spec.book_id,
            f"PDF corrupt \u2014 cannot extract text",
            pdf_path.name,
        )
        return False

    if text is None:
        report_error(
            spec.book_id,
            f"PDF corrupt \u2014 cannot extract text",
            pdf_path.name,
        )
        return False

    # ------------------------------------------------------------------
    # Stage 2: Extraction — dispatch to category extractors
    # ------------------------------------------------------------------
    from extractors import EXTRACTOR_REGISTRY, CategoryResult

    categories = spec.categories or {}
    category_results: dict[str, CategoryResult] = {}
    total_entries = 0

    for category_name, category_config in categories.items():
        extractor_cls = EXTRACTOR_REGISTRY.get(category_name)
        if extractor_cls is None:
            # No extractor registered for this category — skip silently
            continue

        extractor = extractor_cls()

        # Convert CategoryConfig dataclass to dict for the extractor interface
        config_dict = _category_config_to_dict(category_config)

        # Extract — missing anchors produce empty result (Req 7.3)
        result = extractor.extract(text, spec, config_dict)
        category_results[category_name] = result
        total_entries += result.entry_count

    # ------------------------------------------------------------------
    # Stage 4: Regression detection (Req 9.2)
    # ------------------------------------------------------------------
    slug = getattr(spec, "book_slug", None) or spec.book_id

    for category_name, result in category_results.items():
        # Load baseline to check for regressions
        cat_config = categories[category_name]
        output_path_str = cat_config.output_path.format(slug=slug)
        table_name = Path(output_path_str).stem
        baseline_path = _BASELINE_DIR / spec.book_id / f"{table_name}.json"
        baseline_data = load_baseline(baseline_path)

        if baseline_data is not None:
            baseline_entry_ids = set(baseline_data.get("entries", {}).keys())
            check_regression(spec.book_id, category_name, result, baseline_entry_ids)

    # ------------------------------------------------------------------
    # Stage 5: Verbose logging (Req 9.3)
    # ------------------------------------------------------------------
    if verbose:
        # Build baselines dict: category -> expected entry count
        baselines_counts: dict[str, int] | None = None
        for category_name in category_results:
            cat_config = categories[category_name]
            output_path_str = cat_config.output_path.format(slug=slug)
            table_name = Path(output_path_str).stem
            baseline_path = _BASELINE_DIR / spec.book_id / f"{table_name}.json"
            baseline_data = load_baseline(baseline_path)
            if baseline_data is not None:
                if baselines_counts is None:
                    baselines_counts = {}
                baselines_counts[category_name] = baseline_data.get("entry_count", 0)

        write_verbose_log(
            spec.book_id,
            pdf_path,
            category_results,
            baselines=baselines_counts,
        )

    # ------------------------------------------------------------------
    # Stage 6: Output writing — prepend _meta to every output JSON
    # ------------------------------------------------------------------

    for category_name, result in category_results.items():
        cat_config = categories[category_name]
        output_path_str = cat_config.output_path

        # Handle template paths like "src/data/books/{slug}.json"
        output_path_str = output_path_str.format(slug=slug)

        output_path = _REPO_ROOT / output_path_str

        # For book_slices, the extractor already produces a rich _meta block
        # (with kind, note, etc.) — preserve it and only fill in missing fields.
        # For all other categories, inject the pipeline-level _meta block.
        if category_name == "book_slices" and "_meta" in result.entries:
            output_data = dict(result.entries)
            # Ensure required provenance fields are present
            meta = output_data["_meta"]
            meta.setdefault("sourcePdf", pdf_path.name)
            meta.setdefault("slug", slug)
            meta.setdefault("book_title", spec.book_title or spec.book_id)
        else:
            # Build output with _meta as the first key for consistent ordering
            output_data = {"_meta": {
                "sourcePdf": pdf_path.name,
                "slug": slug,
                "book_title": spec.book_title or spec.book_id,
            }}
            output_data.update(result.entries)

        write_output(output_data, output_path, dry_run=dry_run)

    # ------------------------------------------------------------------
    # Summary — console output (Req 9.2, 9.3)
    # ------------------------------------------------------------------
    category_counts = {
        name: r.entry_count for name, r in category_results.items() if r.entry_count > 0
    }
    if category_counts:
        report_ok(spec.book_id, category_counts)
    else:
        print(f"[OK] {spec.book_id}: processed (no category entries extracted)")

    return True


def _category_config_to_dict(config) -> dict:
    """Convert a CategoryConfig dataclass (or raw dict) to a plain dict."""
    from dataclasses import asdict, fields

    if hasattr(config, "__dataclass_fields__"):
        return asdict(config)
    # Already a dict
    return dict(config) if config else {}


def _run_merge(*, dry_run: bool) -> None:
    """Regenerate boons.json from purviews + PB mechanics snippets."""
    catalog_script = _SCRIPTS / "generate_boons_catalog.py"
    if dry_run:
        print(f"[dry-run] Would run {catalog_script.relative_to(_REPO_ROOT)}")
        return
    import subprocess

    subprocess.run([sys.executable, str(catalog_script)], check=True, cwd=str(_REPO_ROOT))


def _run_cleanup(active_slugs: set[str], *, dry_run: bool) -> None:
    """Remove stale book-slice files from src/data/books/.

    Identifies output files that do not correspond to any currently present
    PDF, then deletes them (or reports them in dry-run mode).
    """
    from stale_cleaner import find_stale_files, clean_stale_files

    books_output_dir = _REPO_ROOT / "src" / "data" / "books"

    stale_files = find_stale_files(books_output_dir, active_slugs)
    if stale_files:
        clean_stale_files(stale_files, dry_run=dry_run)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="unified_extractor",
        description="Unified Scion PDF extractor — spec-driven pipeline.",
    )
    parser.add_argument(
        "--book",
        metavar="BOOK_ID",
        default=None,
        help="Process only the specified book (by book_id from its spec).",
    )
    parser.add_argument(
        "--books-dir",
        metavar="DIR",
        type=Path,
        default=None,
        help="Override PDF search directory (highest precedence).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Report what would happen without writing or deleting files.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        default=False,
        help="Write detailed extraction logs to src/data/_extracted/<book_id>.log.json.",
    )
    return parser


def main(
    book: str | None = None,
    books_dir: Path | None = None,
    dry_run: bool = False,
    verbose: bool = False,
) -> int:
    """Run the unified extraction pipeline.

    Can be called programmatically or via CLI (see ``if __name__`` block).
    Returns 0 on success, 1 on unrecoverable error.
    """
    # ------------------------------------------------------------------
    # 1. Discover and validate Book Specs
    # ------------------------------------------------------------------
    try:
        specs = load_specs(_SPECS_DIR)
    except SpecValidationError as exc:
        print(f"[ERROR] Spec validation failed: {exc}", file=sys.stderr)
        return 1

    if not specs:
        print("[WARN] No book specs found in", _SPECS_DIR, file=sys.stderr)
        return 0

    # ------------------------------------------------------------------
    # 2. Filter to a single book if requested
    # ------------------------------------------------------------------
    if book is not None:
        specs = [s for s in specs if s.book_id == book]
        if not specs:
            print(f"[ERROR] No spec found for --book '{book}'", file=sys.stderr)
            return 1

    # ------------------------------------------------------------------
    # 3. Resolve PDFs and run per-book pipeline
    # ------------------------------------------------------------------
    search_dirs = books_search_dirs(books_dir)
    had_error = False
    active_slugs: set[str] = set()

    for spec in specs:
        pdf_path = find_pdf_in_books(tuple(spec.filenames), books_dir)

        if pdf_path is None:
            report_skip(spec.book_id, search_dirs)
            continue

        # Derive slug from spec (fallback to book_id if book_slug not present)
        slug = getattr(spec, "book_slug", None) or spec.book_id
        active_slugs.add(slug)

        success = _run_pipeline(spec, pdf_path, dry_run=dry_run, verbose=verbose)
        if not success:
            had_error = True

    # ------------------------------------------------------------------
    # 4. Post-pipeline: merge catalogs and clean stale files
    # ------------------------------------------------------------------
    _run_merge(dry_run=dry_run)
    _run_cleanup(active_slugs, dry_run=dry_run)

    return 1 if had_error else 0


if __name__ == "__main__":
    parser = _build_parser()
    args = parser.parse_args()

    exit_code = main(
        book=args.book,
        books_dir=args.books_dir,
        dry_run=args.dry_run,
        verbose=args.verbose,
    )
    sys.exit(exit_code)
