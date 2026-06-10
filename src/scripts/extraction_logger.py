"""Extraction Logger — verbose logging and formatted console reporting.

Provides structured logging infrastructure for the unified PDF extractor:
- Verbose JSON log files written to src/data/_extracted/<book_id>.log.json
- Console output with [SKIP], [ERROR], [WARN], [OK] prefixes
- Regression warnings when entries fall below baseline counts
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from extractors.base import CategoryResult

_REPO_ROOT = Path(__file__).resolve().parents[2]
_EXTRACTED_DIR = _REPO_ROOT / "src" / "data" / "_extracted"


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------


@dataclass
class CategoryLogSummary:
    """Summary of extraction results for a single category within a book."""

    entries_found: int
    entries_expected: int | None = None
    log: list[dict[str, str | None]] = field(default_factory=list)


@dataclass
class BookLog:
    """Structured verbose log for a single book's extraction run."""

    book_id: str
    timestamp: str
    pdf_path: str
    categories: dict[str, CategoryLogSummary] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Console reporting
# ---------------------------------------------------------------------------


def report_skip(book_id: str, search_dirs: list[Path] | None = None) -> None:
    """Print a [SKIP] message when a PDF is not found.

    Args:
        book_id: The book spec identifier.
        search_dirs: Directories that were searched (for context).
    """
    searched = ", ".join(str(d) for d in search_dirs) if search_dirs else "(none)"
    print(f"[SKIP] {book_id}: PDF not found (searched: {searched})")


def report_error(book_id: str, reason: str, filename: str | None = None) -> None:
    """Print an [ERROR] message for an unrecoverable error.

    Args:
        book_id: The book spec identifier.
        reason: Human-readable description of the error.
        filename: Optional PDF filename for context.
    """
    suffix = f" ({filename})" if filename else ""
    print(f"[ERROR] {book_id}: {reason}{suffix}", file=sys.stderr)


def report_warn(book_id: str, category: str, deficit: int, missing_ids: list[str]) -> None:
    """Print a [WARN] message for regression below baseline.

    Args:
        book_id: The book spec identifier.
        category: The game data category with the regression.
        deficit: How many entries are below the baseline.
        missing_ids: The IDs of entries present in baseline but absent now.
    """
    ids_str = ", ".join(missing_ids)
    print(f"[WARN] {book_id}/{category}: {deficit} entries below baseline (missing: {ids_str})")


def report_ok(book_id: str, category_counts: dict[str, int]) -> None:
    """Print an [OK] message summarizing successful extraction.

    Args:
        book_id: The book spec identifier.
        category_counts: Mapping of category name to entry count.
    """
    count_parts = ", ".join(f"{cat}: {n}" for cat, n in sorted(category_counts.items()))
    total_categories = len(category_counts)
    print(f"[OK] {book_id}: {total_categories} categories extracted ({count_parts})")


def report_dependency_skip(book_id: str, dependency: str) -> None:
    """Print a [SKIP] message when a required dependency is missing.

    Args:
        book_id: The book spec identifier.
        dependency: Name of the missing dependency (e.g., "pymupdf").
    """
    print(f"[SKIP] {book_id}: missing dependency '{dependency}' — skipping")


# ---------------------------------------------------------------------------
# Regression detection
# ---------------------------------------------------------------------------


def check_regression(
    book_id: str,
    category: str,
    result: CategoryResult,
    baseline_entry_ids: set[str] | None,
) -> list[str]:
    """Check if extraction produced fewer entries than the baseline.

    Compares current extraction entry IDs against the baseline's entry IDs.
    If there are entries in the baseline that are missing from the current
    result, emits a [WARN] and returns the list of missing IDs.

    Args:
        book_id: The book spec identifier.
        category: The category name being checked.
        result: The extraction result for this category.
        baseline_entry_ids: Set of entry IDs from the baseline snapshot,
            or None if no baseline exists.

    Returns:
        List of missing entry IDs (empty if no regression).
    """
    if baseline_entry_ids is None:
        return []

    current_ids = set(result.entries.keys())
    missing_ids = sorted(baseline_entry_ids - current_ids)

    if missing_ids:
        report_warn(book_id, category, len(missing_ids), missing_ids)

    return missing_ids


# ---------------------------------------------------------------------------
# Verbose log file writing
# ---------------------------------------------------------------------------


def write_verbose_log(
    book_id: str,
    pdf_path: Path | str,
    category_results: dict[str, CategoryResult],
    baselines: dict[str, int] | None = None,
    output_dir: Path | None = None,
) -> Path:
    """Write a structured extraction log to src/data/_extracted/<book_id>.log.json.

    Called when --verbose is set. Produces the detailed log format described
    in the design document.

    Args:
        book_id: The book spec identifier.
        pdf_path: Path to the source PDF file.
        category_results: Mapping of category name to its CategoryResult.
        baselines: Optional mapping of category name to expected entry count
            (from baseline snapshots).
        output_dir: Override output directory (defaults to src/data/_extracted/).

    Returns:
        Path to the written log file.
    """
    out_dir = output_dir or _EXTRACTED_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    log_path = out_dir / f"{book_id}.log.json"

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    categories_data: dict[str, Any] = {}
    for cat_name, result in category_results.items():
        cat_log: dict[str, Any] = {
            "entries_found": result.entry_count,
        }

        # Include expected count if baseline exists
        if baselines and cat_name in baselines:
            cat_log["entries_expected"] = baselines[cat_name]

        # Include per-entry log if there are issues
        if result.log:
            cat_log["log"] = [
                {
                    "entry_id": entry.entry_id,
                    "field": entry.field,
                    "reason": entry.reason,
                }
                for entry in result.log
            ]
        else:
            cat_log["log"] = []

        categories_data[cat_name] = cat_log

    log_data = {
        "book_id": book_id,
        "timestamp": timestamp,
        "pdf_path": str(pdf_path),
        "categories": categories_data,
    }

    log_path.write_text(
        json.dumps(log_data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    return log_path
