"""Data models for the PDF Parser Framework.

Defines the schema for Book Specs and pipeline results as Python dataclasses.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal


@dataclass
class SectionAnchor:
    """A pattern that identifies where a logical section begins in extracted text."""

    pattern: str
    pattern_type: Literal["literal", "regex"] = "literal"
    case_insensitive: bool = False
    aliases: list[str] | None = None


@dataclass
class HeadingPattern:
    """A regex rule that identifies individual entries within a section."""

    regex: str
    flags: list[str] | None = None


@dataclass
class CategoryConfig:
    """Per-category extraction configuration within a Book Spec."""

    output_path: str
    section_anchors: list[SectionAnchor] = field(default_factory=list)
    heading_pattern: HeadingPattern | None = None
    expected_fields: list[str] = field(default_factory=list)
    calling_map: dict[str, str] | None = None
    dot_symbol: str | None = None
    stat_block_pattern: str | None = None
    tag_pattern: str | None = None


@dataclass
class BookSpec:
    """Declarative specification for a single PDF source book."""

    book_id: str
    filenames: list[str]
    output_path: str
    section_anchors: list[SectionAnchor]
    heading_patterns: list[HeadingPattern]
    expected_fields: list[str]
    pipeline_stages: list[Literal["ingest", "extract", "validate"]]
    extraction_mode: Literal["pypdf", "pymupdf"] = "pypdf"
    noise_line_regex: str | None = None
    json_output_paths: dict[str, str] | None = None
    """Optional mapping of table/file names to output paths (relative to repo root).

    Used to wire framework extraction output to monolith paths under src/data/. For example:
        json_output_paths:
          boons: "src/data/boons.json"
          purviews: "src/data/purviews.json"
          boonPbMechanics: "src/data/boonPbMechanics.json"

    When set, the CLI orchestrator writes structured JSON to each declared path
    after extraction completes. This keeps the wiring declarative in the spec
    rather than hard-coded in the CLI.
    """

    book_title: str | None = None
    """Human-readable title for the book (e.g., "Pandora's Box (Revised)")."""

    book_slug: str | None = None
    """Output slug for per-book bundle slices (e.g., "pandoras_box")."""

    categories: dict[str, CategoryConfig] | None = None
    """Per-category extraction configurations keyed by Game_Data_Category name."""


@dataclass
class IngestResult:
    """Result of the ingest stage for a single book."""

    book_id: str
    output_path: Path
    page_count: int
    errors: list[str] = field(default_factory=list)


@dataclass
class LogEntry:
    """Structured log entry for non-fatal extraction issues."""

    book_id: str
    entry_id: str | None
    field: str | None
    reason: Literal["not_found", "section_missing", "heading_unmatched", "anchor_not_found"]
    detail: str | None = None


@dataclass
class ExtractResult:
    """Result of the extract stage for a single book."""

    book_id: str
    entries: dict[str, dict[str, str | None]]
    log: list[LogEntry] = field(default_factory=list)


@dataclass
class FlaggedEntry:
    """An entry flagged during validation baseline comparison."""

    key: str
    severity: Literal["missing_entry", "new_entry", "content_changed"]
    old_hash: str | None = None
    new_hash: str | None = None


@dataclass
class ValidationReport:
    """Result of the validation stage for a single book."""

    book_id: str
    table_name: str
    timestamp: str
    total_entries: int
    regressions: dict[str, int]
    flagged: list[FlaggedEntry]
    status: Literal["ok", "warning", "error", "skipped_due_to_errors"]
