"""Book Spec discovery and validation.

Discovers .yaml, .yml, and .json spec files from a directory, parses them,
validates against the BookSpec schema, and detects duplicate book IDs.

Supports both:
- Legacy specs: top-level `section_anchors`, `heading_patterns`, `expected_fields`
- Extended specs: `categories` dict with per-category extraction config,
  `book_title`, `book_slug` metadata
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

from parser_framework.models import (
    BookSpec,
    CategoryConfig,
    HeadingPattern,
    SectionAnchor,
)

# book_id must be alphanumeric + underscores, 1-64 characters
_BOOK_ID_RE = re.compile(r"^[a-zA-Z0-9_]{1,64}$")

# book_slug must be alphanumeric + underscores, 1-64 characters (same as book_id)
_BOOK_SLUG_RE = re.compile(r"^[a-zA-Z0-9_]{1,64}$")

_VALID_PIPELINE_STAGES = {"ingest", "extract", "validate"}
_VALID_PATTERN_TYPES = {"literal", "regex"}
_VALID_EXTRACTION_MODES = {"pypdf", "pymupdf"}

_SPEC_EXTENSIONS = {".yaml", ".yml", ".json"}

# Required fields for all specs (both legacy and extended).
# Legacy specs require section_anchors, heading_patterns, expected_fields at top level.
# Extended specs may provide them via the `categories` dict instead.
_REQUIRED_FIELDS = [
    "book_id",
    "filenames",
    "output_path",
    "pipeline_stages",
]

_VALID_CATEGORY_NAMES = {
    "knacks",
    "boons",
    "purviews",
    "callings",
    "birthrights",
    "equipment",
    "paths",
    "pantheons",
    "book_slices",
}


class SpecValidationError(Exception):
    """Raised when a Book Spec file fails validation.

    Attributes:
        source_file: Path to the spec file that failed validation.
        field: The specific field or value that caused the failure.
        reason: Human-readable explanation of the failure.
    """

    def __init__(self, source_file: Path, field: str, reason: str) -> None:
        self.source_file = source_file
        self.field = field
        self.reason = reason
        super().__init__(
            f"{source_file}: field '{field}' — {reason}"
        )


def load_specs(specs_dir: Path) -> list[BookSpec]:
    """Discover all .yaml/.yml/.json files in specs_dir, parse and validate.

    Args:
        specs_dir: Directory to scan for spec files.

    Returns:
        List of validated BookSpec instances.

    Raises:
        SpecValidationError: If any spec fails validation or duplicate book_ids
            are found across files.
    """
    spec_files = sorted(
        f for f in specs_dir.iterdir()
        if f.is_file() and f.suffix in _SPEC_EXTENSIONS
    )

    specs: list[BookSpec] = []
    seen_ids: dict[str, Path] = {}

    for spec_file in spec_files:
        raw = _parse_file(spec_file)
        book_spec = validate_spec(raw, spec_file)

        # Check for duplicate book_id across all loaded specs
        if book_spec.book_id in seen_ids:
            raise SpecValidationError(
                source_file=spec_file,
                field="book_id",
                reason=(
                    f"duplicate book_id '{book_spec.book_id}' — "
                    f"already defined in {seen_ids[book_spec.book_id]}"
                ),
            )

        seen_ids[book_spec.book_id] = spec_file
        specs.append(book_spec)

    return specs


def validate_spec(raw: dict, source_file: Path) -> BookSpec:
    """Validate a single parsed spec dict and return a BookSpec.

    Supports both legacy and extended specs:
    - Legacy: requires top-level `section_anchors`, `heading_patterns`, `expected_fields`
    - Extended: uses `categories` dict with per-category config; top-level anchors/patterns
      are optional (for backward compat with framework internals)

    Args:
        raw: Dictionary parsed from YAML or JSON.
        source_file: Path to the source file (for error messages).

    Returns:
        A validated BookSpec instance.

    Raises:
        SpecValidationError: If any required field is missing or invalid.
    """
    # Check required fields are present
    for field_name in _REQUIRED_FIELDS:
        if field_name not in raw:
            raise SpecValidationError(
                source_file=source_file,
                field=field_name,
                reason=f"required field '{field_name}' is missing",
            )

    # Determine if this is an extended spec (has categories) or legacy spec
    has_categories = "categories" in raw
    has_legacy_anchors = "section_anchors" in raw
    has_legacy_headings = "heading_patterns" in raw
    has_legacy_fields = "expected_fields" in raw

    # Legacy specs require top-level section_anchors, heading_patterns, expected_fields
    if not has_categories:
        if not has_legacy_anchors:
            raise SpecValidationError(
                source_file=source_file,
                field="section_anchors",
                reason="required field 'section_anchors' is missing (provide 'categories' dict or top-level 'section_anchors')",
            )
        if not has_legacy_headings:
            raise SpecValidationError(
                source_file=source_file,
                field="heading_patterns",
                reason="required field 'heading_patterns' is missing (provide 'categories' dict or top-level 'heading_patterns')",
            )
        if not has_legacy_fields:
            raise SpecValidationError(
                source_file=source_file,
                field="expected_fields",
                reason="required field 'expected_fields' is missing (provide 'categories' dict or top-level 'expected_fields')",
            )

    # Validate book_id format
    book_id = raw["book_id"]
    if not isinstance(book_id, str) or not _BOOK_ID_RE.match(book_id):
        raise SpecValidationError(
            source_file=source_file,
            field="book_id",
            reason=(
                f"must be alphanumeric plus underscores, 1-64 characters; "
                f"got: {book_id!r}"
            ),
        )

    # Validate filenames: non-empty list of strings
    filenames = raw["filenames"]
    if not isinstance(filenames, list) or len(filenames) == 0:
        raise SpecValidationError(
            source_file=source_file,
            field="filenames",
            reason="must be a non-empty list of strings",
        )
    for i, fn in enumerate(filenames):
        if not isinstance(fn, str) or not fn.strip():
            raise SpecValidationError(
                source_file=source_file,
                field=f"filenames[{i}]",
                reason=f"each filename must be a non-empty string; got: {fn!r}",
            )

    # Validate output_path
    output_path = raw["output_path"]
    if not isinstance(output_path, str) or not output_path.strip():
        raise SpecValidationError(
            source_file=source_file,
            field="output_path",
            reason="must be a non-empty string",
        )

    # Validate pipeline_stages: non-empty list with valid values
    pipeline_stages = raw["pipeline_stages"]
    if not isinstance(pipeline_stages, list) or len(pipeline_stages) == 0:
        raise SpecValidationError(
            source_file=source_file,
            field="pipeline_stages",
            reason="must be a non-empty list",
        )
    for stage in pipeline_stages:
        if stage not in _VALID_PIPELINE_STAGES:
            raise SpecValidationError(
                source_file=source_file,
                field="pipeline_stages",
                reason=(
                    f"invalid stage '{stage}'; "
                    f"allowed values: {sorted(_VALID_PIPELINE_STAGES)}"
                ),
            )

    # Validate section_anchors (required for legacy, optional for extended)
    section_anchors: list[SectionAnchor] = []
    if has_legacy_anchors:
        section_anchors_raw = raw["section_anchors"]
        if not isinstance(section_anchors_raw, list):
            raise SpecValidationError(
                source_file=source_file,
                field="section_anchors",
                reason="must be a list",
            )
        section_anchors = [
            _validate_section_anchor(a, i, source_file)
            for i, a in enumerate(section_anchors_raw)
        ]

    # Validate heading_patterns (required for legacy, optional for extended)
    heading_patterns: list[HeadingPattern] = []
    if has_legacy_headings:
        heading_patterns_raw = raw["heading_patterns"]
        if not isinstance(heading_patterns_raw, list):
            raise SpecValidationError(
                source_file=source_file,
                field="heading_patterns",
                reason="must be a list",
            )
        heading_patterns = [
            _validate_heading_pattern(p, i, source_file)
            for i, p in enumerate(heading_patterns_raw)
        ]

    # Validate expected_fields (required for legacy, optional for extended)
    expected_fields: list[str] = []
    if has_legacy_fields:
        expected_fields_raw = raw["expected_fields"]
        if not isinstance(expected_fields_raw, list):
            raise SpecValidationError(
                source_file=source_file,
                field="expected_fields",
                reason="must be a list",
            )
        expected_fields = expected_fields_raw

    # Validate optional extraction_mode
    extraction_mode = raw.get("extraction_mode", "pypdf")
    if extraction_mode not in _VALID_EXTRACTION_MODES:
        raise SpecValidationError(
            source_file=source_file,
            field="extraction_mode",
            reason=(
                f"invalid value '{extraction_mode}'; "
                f"allowed values: {sorted(_VALID_EXTRACTION_MODES)}"
            ),
        )

    # Validate optional noise_line_regex (must be a string if present)
    noise_line_regex = raw.get("noise_line_regex", None)
    if noise_line_regex is not None and not isinstance(noise_line_regex, str):
        raise SpecValidationError(
            source_file=source_file,
            field="noise_line_regex",
            reason="must be a string if provided",
        )

    # Validate optional json_output_paths (must be a dict[str, str] if present)
    json_output_paths = raw.get("json_output_paths", None)
    if json_output_paths is not None:
        if not isinstance(json_output_paths, dict):
            raise SpecValidationError(
                source_file=source_file,
                field="json_output_paths",
                reason="must be a mapping of table names to output paths if provided",
            )
        for key, val in json_output_paths.items():
            if not isinstance(key, str) or not isinstance(val, str):
                raise SpecValidationError(
                    source_file=source_file,
                    field=f"json_output_paths.{key}",
                    reason="both key and value must be strings",
                )

    # Validate optional book_title (must be a non-empty string if present)
    book_title = raw.get("book_title", None)
    if book_title is not None:
        if not isinstance(book_title, str) or not book_title.strip():
            raise SpecValidationError(
                source_file=source_file,
                field="book_title",
                reason="must be a non-empty string if provided",
            )

    # Validate optional book_slug (must match slug pattern if present)
    book_slug = raw.get("book_slug", None)
    if book_slug is not None:
        if not isinstance(book_slug, str) or not _BOOK_SLUG_RE.match(book_slug):
            raise SpecValidationError(
                source_file=source_file,
                field="book_slug",
                reason=(
                    f"must be alphanumeric plus underscores, 1-64 characters; "
                    f"got: {book_slug!r}"
                ),
            )

    # Validate optional categories dict
    categories: dict[str, CategoryConfig] | None = None
    if has_categories:
        categories = _validate_categories(raw["categories"], source_file)

    return BookSpec(
        book_id=book_id,
        filenames=filenames,
        output_path=output_path,
        section_anchors=section_anchors,
        heading_patterns=heading_patterns,
        expected_fields=expected_fields,
        pipeline_stages=pipeline_stages,
        extraction_mode=extraction_mode,
        noise_line_regex=noise_line_regex,
        json_output_paths=json_output_paths,
        book_title=book_title,
        book_slug=book_slug,
        categories=categories,
    )


def _validate_categories(
    raw: object, source_file: Path
) -> dict[str, CategoryConfig]:
    """Validate the `categories` dict and return parsed CategoryConfig objects.

    Each category key must be a valid Game_Data_Category name, and each
    value must be a mapping containing at minimum an `output_path` field.
    """
    if not isinstance(raw, dict):
        raise SpecValidationError(
            source_file=source_file,
            field="categories",
            reason="must be a mapping of category names to config objects",
        )

    if len(raw) == 0:
        raise SpecValidationError(
            source_file=source_file,
            field="categories",
            reason="must contain at least one category",
        )

    categories: dict[str, CategoryConfig] = {}
    for cat_name, cat_raw in raw.items():
        if not isinstance(cat_name, str):
            raise SpecValidationError(
                source_file=source_file,
                field="categories",
                reason=f"category key must be a string; got: {cat_name!r}",
            )

        if cat_name not in _VALID_CATEGORY_NAMES:
            raise SpecValidationError(
                source_file=source_file,
                field=f"categories.{cat_name}",
                reason=(
                    f"unknown category '{cat_name}'; "
                    f"allowed values: {sorted(_VALID_CATEGORY_NAMES)}"
                ),
            )

        categories[cat_name] = _validate_category_config(
            cat_raw, cat_name, source_file
        )

    return categories


def _validate_category_config(
    raw: object, category_name: str, source_file: Path
) -> CategoryConfig:
    """Validate a single category config block and return a CategoryConfig."""
    field_prefix = f"categories.{category_name}"

    if not isinstance(raw, dict):
        raise SpecValidationError(
            source_file=source_file,
            field=field_prefix,
            reason="each category config must be a mapping",
        )

    # output_path is required for every category
    if "output_path" not in raw:
        raise SpecValidationError(
            source_file=source_file,
            field=f"{field_prefix}.output_path",
            reason="required field 'output_path' is missing",
        )

    output_path = raw["output_path"]
    if not isinstance(output_path, str) or not output_path.strip():
        raise SpecValidationError(
            source_file=source_file,
            field=f"{field_prefix}.output_path",
            reason="must be a non-empty string",
        )

    # Validate optional section_anchors within category
    section_anchors: list[SectionAnchor] = []
    if "section_anchors" in raw:
        anchors_raw = raw["section_anchors"]
        if not isinstance(anchors_raw, list):
            raise SpecValidationError(
                source_file=source_file,
                field=f"{field_prefix}.section_anchors",
                reason="must be a list",
            )
        section_anchors = [
            _validate_section_anchor(
                a, i, source_file, field_prefix=f"{field_prefix}.section_anchors"
            )
            for i, a in enumerate(anchors_raw)
        ]

    # Validate optional heading_pattern (singular, not a list like top-level)
    heading_pattern: HeadingPattern | None = None
    if "heading_pattern" in raw:
        hp_raw = raw["heading_pattern"]
        if not isinstance(hp_raw, dict):
            raise SpecValidationError(
                source_file=source_file,
                field=f"{field_prefix}.heading_pattern",
                reason="must be a mapping with 'regex' field",
            )
        heading_pattern = _validate_heading_pattern(
            hp_raw, 0, source_file, field_prefix=f"{field_prefix}.heading_pattern"
        )

    # Validate optional expected_fields within category
    expected_fields: list[str] = []
    if "expected_fields" in raw:
        ef_raw = raw["expected_fields"]
        if not isinstance(ef_raw, list):
            raise SpecValidationError(
                source_file=source_file,
                field=f"{field_prefix}.expected_fields",
                reason="must be a list of strings",
            )
        for i, ef in enumerate(ef_raw):
            if not isinstance(ef, str):
                raise SpecValidationError(
                    source_file=source_file,
                    field=f"{field_prefix}.expected_fields[{i}]",
                    reason=f"each expected field must be a string; got: {ef!r}",
                )
        expected_fields = ef_raw

    # Validate optional calling_map (dict[str, str])
    calling_map: dict[str, str] | None = None
    if "calling_map" in raw:
        cm_raw = raw["calling_map"]
        if not isinstance(cm_raw, dict):
            raise SpecValidationError(
                source_file=source_file,
                field=f"{field_prefix}.calling_map",
                reason="must be a mapping of section names to calling identifiers",
            )
        for key, val in cm_raw.items():
            if not isinstance(key, str) or not isinstance(val, str):
                raise SpecValidationError(
                    source_file=source_file,
                    field=f"{field_prefix}.calling_map.{key}",
                    reason="both key and value must be strings",
                )
        calling_map = cm_raw

    # Validate optional dot_symbol (string)
    dot_symbol: str | None = None
    if "dot_symbol" in raw:
        ds = raw["dot_symbol"]
        if not isinstance(ds, str):
            raise SpecValidationError(
                source_file=source_file,
                field=f"{field_prefix}.dot_symbol",
                reason="must be a string",
            )
        dot_symbol = ds

    # Validate optional stat_block_pattern (string)
    stat_block_pattern: str | None = None
    if "stat_block_pattern" in raw:
        sbp = raw["stat_block_pattern"]
        if not isinstance(sbp, str):
            raise SpecValidationError(
                source_file=source_file,
                field=f"{field_prefix}.stat_block_pattern",
                reason="must be a string",
            )
        stat_block_pattern = sbp

    # Validate optional tag_pattern (string)
    tag_pattern: str | None = None
    if "tag_pattern" in raw:
        tp = raw["tag_pattern"]
        if not isinstance(tp, str):
            raise SpecValidationError(
                source_file=source_file,
                field=f"{field_prefix}.tag_pattern",
                reason="must be a string",
            )
        tag_pattern = tp

    return CategoryConfig(
        output_path=output_path,
        section_anchors=section_anchors,
        heading_pattern=heading_pattern,
        expected_fields=expected_fields,
        calling_map=calling_map,
        dot_symbol=dot_symbol,
        stat_block_pattern=stat_block_pattern,
        tag_pattern=tag_pattern,
    )


def _validate_section_anchor(
    raw: dict, index: int, source_file: Path, *, field_prefix: str = "section_anchors"
) -> SectionAnchor:
    """Validate and construct a SectionAnchor from raw dict."""
    field_name = f"{field_prefix}[{index}]"

    if not isinstance(raw, dict):
        raise SpecValidationError(
            source_file=source_file,
            field=field_name,
            reason="each section anchor must be a mapping",
        )

    if "pattern" not in raw:
        raise SpecValidationError(
            source_file=source_file,
            field=f"{field_name}.pattern",
            reason="required field 'pattern' is missing",
        )

    pattern = raw["pattern"]
    if not isinstance(pattern, str) or not pattern.strip():
        raise SpecValidationError(
            source_file=source_file,
            field=f"{field_name}.pattern",
            reason="must be a non-empty string",
        )

    pattern_type = raw.get("pattern_type", "literal")
    if pattern_type not in _VALID_PATTERN_TYPES:
        raise SpecValidationError(
            source_file=source_file,
            field=f"{field_name}.pattern_type",
            reason=(
                f"invalid value '{pattern_type}'; "
                f"allowed values: {sorted(_VALID_PATTERN_TYPES)}"
            ),
        )

    case_insensitive = raw.get("case_insensitive", False)
    if not isinstance(case_insensitive, bool):
        raise SpecValidationError(
            source_file=source_file,
            field=f"{field_name}.case_insensitive",
            reason="must be a boolean",
        )

    aliases = raw.get("aliases", None)
    if aliases is not None:
        if not isinstance(aliases, list):
            raise SpecValidationError(
                source_file=source_file,
                field=f"{field_name}.aliases",
                reason="must be a list of strings",
            )
        for j, alias in enumerate(aliases):
            if not isinstance(alias, str):
                raise SpecValidationError(
                    source_file=source_file,
                    field=f"{field_name}.aliases[{j}]",
                    reason="each alias must be a string",
                )

    return SectionAnchor(
        pattern=pattern,
        pattern_type=pattern_type,
        case_insensitive=case_insensitive,
        aliases=aliases,
    )


def _validate_heading_pattern(
    raw: dict, index: int, source_file: Path, *, field_prefix: str | None = None
) -> HeadingPattern:
    """Validate and construct a HeadingPattern from raw dict."""
    if field_prefix is None:
        field_name = f"heading_patterns[{index}]"
    else:
        field_name = field_prefix

    if not isinstance(raw, dict):
        raise SpecValidationError(
            source_file=source_file,
            field=field_name,
            reason="each heading pattern must be a mapping",
        )

    if "regex" not in raw:
        raise SpecValidationError(
            source_file=source_file,
            field=f"{field_name}.regex",
            reason="required field 'regex' is missing",
        )

    regex = raw["regex"]
    if not isinstance(regex, str) or not regex.strip():
        raise SpecValidationError(
            source_file=source_file,
            field=f"{field_name}.regex",
            reason="must be a non-empty string",
        )

    flags = raw.get("flags", None)
    if flags is not None:
        if not isinstance(flags, list):
            raise SpecValidationError(
                source_file=source_file,
                field=f"{field_name}.flags",
                reason="must be a list of strings",
            )
        for j, flag in enumerate(flags):
            if not isinstance(flag, str):
                raise SpecValidationError(
                    source_file=source_file,
                    field=f"{field_name}.flags[{j}]",
                    reason="each flag must be a string",
                )

    return HeadingPattern(regex=regex, flags=flags)


def _parse_file(spec_file: Path) -> dict:
    """Parse a YAML or JSON spec file into a raw dict.

    Raises:
        SpecValidationError: If the file cannot be parsed or doesn't contain a mapping.
    """
    try:
        content = spec_file.read_text(encoding="utf-8")
        if spec_file.suffix == ".json":
            data = json.loads(content)
        else:
            data = yaml.safe_load(content)
    except (json.JSONDecodeError, yaml.YAMLError) as exc:
        raise SpecValidationError(
            source_file=spec_file,
            field="<file>",
            reason=f"failed to parse: {exc}",
        ) from exc

    if not isinstance(data, dict):
        raise SpecValidationError(
            source_file=spec_file,
            field="<file>",
            reason="spec file must contain a YAML/JSON mapping at the top level",
        )

    return data
