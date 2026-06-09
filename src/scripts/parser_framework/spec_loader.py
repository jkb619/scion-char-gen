"""Book Spec discovery and validation.

Discovers .yaml, .yml, and .json spec files from a directory, parses them,
validates against the BookSpec schema, and detects duplicate book IDs.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

from parser_framework.models import BookSpec, HeadingPattern, SectionAnchor

# book_id must be alphanumeric + underscores, 1-64 characters
_BOOK_ID_RE = re.compile(r"^[a-zA-Z0-9_]{1,64}$")

_VALID_PIPELINE_STAGES = {"ingest", "extract", "validate"}
_VALID_PATTERN_TYPES = {"literal", "regex"}
_VALID_EXTRACTION_MODES = {"pypdf", "pymupdf"}

_SPEC_EXTENSIONS = {".yaml", ".yml", ".json"}

_REQUIRED_FIELDS = [
    "book_id",
    "filenames",
    "output_path",
    "section_anchors",
    "heading_patterns",
    "expected_fields",
    "pipeline_stages",
]


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

    # Validate section_anchors
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

    # Validate heading_patterns
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

    # Validate expected_fields
    expected_fields = raw["expected_fields"]
    if not isinstance(expected_fields, list):
        raise SpecValidationError(
            source_file=source_file,
            field="expected_fields",
            reason="must be a list",
        )

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
    )


def _validate_section_anchor(
    raw: dict, index: int, source_file: Path
) -> SectionAnchor:
    """Validate and construct a SectionAnchor from raw dict."""
    field_prefix = f"section_anchors[{index}]"

    if not isinstance(raw, dict):
        raise SpecValidationError(
            source_file=source_file,
            field=field_prefix,
            reason="each section anchor must be a mapping",
        )

    if "pattern" not in raw:
        raise SpecValidationError(
            source_file=source_file,
            field=f"{field_prefix}.pattern",
            reason="required field 'pattern' is missing",
        )

    pattern = raw["pattern"]
    if not isinstance(pattern, str) or not pattern.strip():
        raise SpecValidationError(
            source_file=source_file,
            field=f"{field_prefix}.pattern",
            reason="must be a non-empty string",
        )

    pattern_type = raw.get("pattern_type", "literal")
    if pattern_type not in _VALID_PATTERN_TYPES:
        raise SpecValidationError(
            source_file=source_file,
            field=f"{field_prefix}.pattern_type",
            reason=(
                f"invalid value '{pattern_type}'; "
                f"allowed values: {sorted(_VALID_PATTERN_TYPES)}"
            ),
        )

    case_insensitive = raw.get("case_insensitive", False)
    if not isinstance(case_insensitive, bool):
        raise SpecValidationError(
            source_file=source_file,
            field=f"{field_prefix}.case_insensitive",
            reason="must be a boolean",
        )

    aliases = raw.get("aliases", None)
    if aliases is not None:
        if not isinstance(aliases, list):
            raise SpecValidationError(
                source_file=source_file,
                field=f"{field_prefix}.aliases",
                reason="must be a list of strings",
            )
        for j, alias in enumerate(aliases):
            if not isinstance(alias, str):
                raise SpecValidationError(
                    source_file=source_file,
                    field=f"{field_prefix}.aliases[{j}]",
                    reason="each alias must be a string",
                )

    return SectionAnchor(
        pattern=pattern,
        pattern_type=pattern_type,
        case_insensitive=case_insensitive,
        aliases=aliases,
    )


def _validate_heading_pattern(
    raw: dict, index: int, source_file: Path
) -> HeadingPattern:
    """Validate and construct a HeadingPattern from raw dict."""
    field_prefix = f"heading_patterns[{index}]"

    if not isinstance(raw, dict):
        raise SpecValidationError(
            source_file=source_file,
            field=field_prefix,
            reason="each heading pattern must be a mapping",
        )

    if "regex" not in raw:
        raise SpecValidationError(
            source_file=source_file,
            field=f"{field_prefix}.regex",
            reason="required field 'regex' is missing",
        )

    regex = raw["regex"]
    if not isinstance(regex, str) or not regex.strip():
        raise SpecValidationError(
            source_file=source_file,
            field=f"{field_prefix}.regex",
            reason="must be a non-empty string",
        )

    flags = raw.get("flags", None)
    if flags is not None:
        if not isinstance(flags, list):
            raise SpecValidationError(
                source_file=source_file,
                field=f"{field_prefix}.flags",
                reason="must be a list of strings",
            )
        for j, flag in enumerate(flags):
            if not isinstance(flag, str):
                raise SpecValidationError(
                    source_file=source_file,
                    field=f"{field_prefix}.flags[{j}]",
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
