"""PDF Parser Framework — unified, declarative PDF extraction pipeline.

Public API exports for convenient importing:

    from parser_framework import BookSpec, normalize_heading, fuzzy_find_anchor
    from parser_framework import load_specs, validate_spec, SpecValidationError
    from parser_framework import resolve_pdf, ingest
    from parser_framework import find_section, extract_fields, extract, extract_pymupdf
    from parser_framework import validate, compute_content_hash, load_baseline, save_baseline
    from parser_framework import write_output, format_json
"""

from parser_framework.extract_engine import (
    extract,
    extract_fields,
    extract_pymupdf,
    find_section,
)
from parser_framework.ingest_engine import ingest, resolve_pdf
from parser_framework.models import (
    BookSpec,
    ExtractResult,
    FlaggedEntry,
    HeadingPattern,
    IngestResult,
    LogEntry,
    SectionAnchor,
    ValidationReport,
)
from parser_framework.normalize import (
    fuzzy_find_anchor,
    normalize_heading,
    normalize_text,
    whitespace_insensitive_find,
)
from parser_framework.spec_loader import (
    SpecValidationError,
    load_specs,
    validate_spec,
)
from parser_framework.validation_reporter import (
    compute_content_hash,
    load_baseline,
    save_baseline,
    validate,
)
from parser_framework.output_writer import (
    format_json,
    write_output,
)

__all__ = [
    # Models
    "BookSpec",
    "ExtractResult",
    "FlaggedEntry",
    "HeadingPattern",
    "IngestResult",
    "LogEntry",
    "SectionAnchor",
    "ValidationReport",
    # Extract engine
    "extract",
    "extract_fields",
    "extract_pymupdf",
    "find_section",
    # Ingest engine
    "ingest",
    "resolve_pdf",
    # Normalize functions
    "fuzzy_find_anchor",
    "normalize_heading",
    "normalize_text",
    "whitespace_insensitive_find",
    # Spec loader
    "SpecValidationError",
    "load_specs",
    "validate_spec",
    # Validation reporter
    "compute_content_hash",
    "load_baseline",
    "save_baseline",
    "validate",
    # Output writer
    "format_json",
    "write_output",
]
