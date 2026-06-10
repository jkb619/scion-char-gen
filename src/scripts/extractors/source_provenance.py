"""Source provenance utilities for the extraction pipeline.

Provides canonical functions for:
- Validating the source field format: `<filename> p.<N>`
- Constructing source strings from filename + page number
- Building the _meta block for output JSON files
- Finding the nearest page marker in ingested text

These utilities formalize Requirements 8.1, 8.2, and 8.3 from the spec.
"""

from __future__ import annotations

import re
from typing import Any


# Page marker format produced by ingest_engine: ===== Page N / Total =====
PAGE_MARKER_RE = re.compile(r"===== Page (\d+) / \d+ =====")

# Regex pattern that all source fields must match: `<filename> p.<N>`
SOURCE_FIELD_PATTERN = re.compile(r"^.+ p\.\d+$")


def build_source(filename: str, page_number: int) -> str:
    """Build a source provenance string in the canonical format.

    Args:
        filename: PDF filename (e.g., "Scion_Hero.pdf").
        page_number: Page number where the entry heading appears.

    Returns:
        Source string in format `<filename> p.<N>`.
    """
    return f"{filename} p.{page_number}"


def validate_source_field(source: str) -> bool:
    """Check whether a source field matches the required format.

    The source field must be a non-empty string matching `<filename> p.<N>`,
    where filename is any non-empty string and N is one or more digits.

    Args:
        source: The source field value to validate.

    Returns:
        True if the source matches the required format.
    """
    if not source or not isinstance(source, str):
        return False
    return bool(SOURCE_FIELD_PATTERN.match(source))


def find_nearest_page(text: str, position: int) -> int:
    """Find the page number from the nearest preceding page marker.

    Searches backward from the given position in the text to find the most
    recent page marker and returns its page number.

    Args:
        text: Full ingested plaintext containing page markers.
        position: Character position to search backward from.

    Returns:
        Page number from the nearest preceding marker, or 1 if none found.
    """
    preceding_text = text[:position]
    matches = list(PAGE_MARKER_RE.finditer(preceding_text))
    if matches:
        return int(matches[-1].group(1))
    return 1


def build_meta_block(
    source_pdf: str,
    slug: str,
    book_title: str,
    **extra: Any,
) -> dict[str, Any]:
    """Build a _meta block for an output JSON file.

    Args:
        source_pdf: PDF filename (e.g., "Scion_Hero.pdf").
        slug: Book slug for the output (e.g., "pandoras_box").
        book_title: Human-readable book title.
        **extra: Additional fields to include (e.g., kind, note).

    Returns:
        Dict suitable for use as the `_meta` value in output JSON.
    """
    meta: dict[str, Any] = {
        "sourcePdf": source_pdf,
        "slug": slug,
        "book_title": book_title,
    }
    meta.update(extra)
    return meta


def validate_meta_block(meta: dict[str, Any]) -> list[str]:
    """Validate that a _meta block has all required fields.

    Required fields per Requirement 8.2:
    - sourcePdf: non-empty string
    - slug: non-empty string
    - book_title: non-empty string

    Args:
        meta: The _meta dict to validate.

    Returns:
        List of validation error messages. Empty list means valid.
    """
    errors: list[str] = []

    if not isinstance(meta, dict):
        return ["_meta must be a dict"]

    # sourcePdf
    source_pdf = meta.get("sourcePdf")
    if not source_pdf or not isinstance(source_pdf, str):
        errors.append("_meta.sourcePdf must be a non-empty string")

    # slug
    slug = meta.get("slug")
    if not slug or not isinstance(slug, str):
        errors.append("_meta.slug must be a non-empty string")

    # book_title
    book_title = meta.get("book_title")
    if not book_title or not isinstance(book_title, str):
        errors.append("_meta.book_title must be a non-empty string")

    return errors
