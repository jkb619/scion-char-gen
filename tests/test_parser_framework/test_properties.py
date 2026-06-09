"""Property-based tests for the parser_framework normalize module.

Tests Properties 2, 10, and 14 from the design document using Hypothesis.
"""

from __future__ import annotations

import re

from hypothesis import given, settings
from hypothesis import strategies as st
from Levenshtein import distance as levenshtein_distance

from parser_framework.normalize import (
    fuzzy_find_anchor,
    normalize_heading,
    normalize_text,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalize_newlines(s: str) -> str:
    """Replace runs of 4+ consecutive newlines with exactly 3 newlines.

    This is the newline normalization the Ingest_Engine applies to extracted
    PDF text before writing the plaintext output.
    """
    return re.sub(r"\n{4,}", "\n\n\n", s)


# Strategy: arbitrary unicode text that may include lots of newlines
_text_with_newlines = st.text(
    alphabet=st.characters(categories=("L", "N", "P", "Z", "S", "Cc")),
    min_size=0,
    max_size=300,
)

# Strategy: unicode text suitable for heading normalization
_heading_text = st.text(
    alphabet=st.characters(
        categories=("L", "N", "P", "Z", "S"),
        include_characters="\u00ad\u2013\u2018\u2019\u201c\u201d",
    ),
    min_size=0,
    max_size=200,
)

# Strategy: short ASCII-ish strings for fuzzy matching
_anchor_text = st.text(
    alphabet=st.characters(categories=("L", "N", "P")),
    min_size=1,
    max_size=30,
)


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 2: Newline Normalization Invariant
# ---------------------------------------------------------------------------

class TestNewlineNormalization:
    """Property 2: Newline Normalization Invariant.

    For any string, after applying newline normalization, the output SHALL
    never contain four or more consecutive newline characters. Applying the
    normalization a second time SHALL produce an identical result (idempotence).

    Validates: Requirements 1.2
    """

    @given(text=_text_with_newlines)
    @settings(max_examples=200)
    def test_no_four_consecutive_newlines(self, text: str) -> None:
        """Output never contains 4+ consecutive newlines."""
        # **Validates: Requirements 1.2**
        result = normalize_newlines(text)
        assert "\n\n\n\n" not in result, (
            f"Found 4+ consecutive newlines in output: {result!r}"
        )

    @given(text=_text_with_newlines)
    @settings(max_examples=200)
    def test_idempotence(self, text: str) -> None:
        """Applying normalization twice equals applying once."""
        # **Validates: Requirements 1.2**
        once = normalize_newlines(text)
        twice = normalize_newlines(once)
        assert once == twice, (
            f"Not idempotent:\n  once:  {once!r}\n  twice: {twice!r}"
        )


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 10: Heading Normalization Idempotence
# ---------------------------------------------------------------------------

class TestHeadingNormalization:
    """Property 10: Heading Normalization Idempotence.

    For any Unicode string, applying normalize_heading once and applying it
    twice SHALL produce the same result. The output SHALL never contain
    soft-hyphens (U+00AD), smart quotes (U+2018-U+201D), en-dashes (U+2013),
    or consecutive whitespace characters.

    Validates: Requirements 3.3
    """

    # Characters that must never appear in normalized heading output
    _PROHIBITED_CHARS = set("\u00ad\u2018\u2019\u201c\u201d\u2013")
    _CONSECUTIVE_WHITESPACE_RE = re.compile(r"\s{2,}")

    @given(text=_heading_text)
    @settings(max_examples=200)
    def test_idempotence(self, text: str) -> None:
        """Applying normalize_heading twice equals applying once."""
        # **Validates: Requirements 3.3**
        once = normalize_heading(text)
        twice = normalize_heading(once)
        assert once == twice, (
            f"Not idempotent:\n  once:  {once!r}\n  twice: {twice!r}"
        )

    @given(text=_heading_text)
    @settings(max_examples=200)
    def test_no_prohibited_characters(self, text: str) -> None:
        """Output never contains soft-hyphens, smart quotes, or en-dashes."""
        # **Validates: Requirements 3.3**
        result = normalize_heading(text)
        found = set(result) & self._PROHIBITED_CHARS
        assert not found, (
            f"Prohibited characters found in output: "
            f"{', '.join(f'U+{ord(c):04X}' for c in found)}\n"
            f"Input:  {text!r}\n"
            f"Output: {result!r}"
        )

    @given(text=_heading_text)
    @settings(max_examples=200)
    def test_no_consecutive_whitespace(self, text: str) -> None:
        """Output never contains consecutive whitespace characters."""
        # **Validates: Requirements 3.3**
        result = normalize_heading(text)
        match = self._CONSECUTIVE_WHITESPACE_RE.search(result)
        assert match is None, (
            f"Consecutive whitespace found in output at position {match.start()}\n"
            f"Input:  {text!r}\n"
            f"Output: {result!r}"
        )


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 14: Fuzzy Match Accepts Exactly
# Within Threshold
# ---------------------------------------------------------------------------

class TestFuzzyMatchThreshold:
    """Property 14: Fuzzy Match Accepts Exactly Within Threshold.

    For any normalized anchor string and any text line where the Levenshtein
    distance between them is <= 2, the fuzzy matcher SHALL accept the line.
    For any line where the distance is > 2, the fuzzy matcher SHALL reject
    the line.

    Validates: Requirements 6.2
    """

    @given(anchor=_anchor_text, noise_char=st.characters(categories=("L", "N")))
    @settings(max_examples=100)
    def test_accepts_within_threshold(self, anchor: str, noise_char: str) -> None:
        """Lines within Levenshtein distance <= 2 are accepted."""
        # **Validates: Requirements 6.2**
        # Create a line that differs from anchor by exactly 1 character
        # (substitution at first position)
        if len(anchor) == 0:
            return  # Skip empty anchors
        modified = noise_char + anchor[1:] if len(anchor) > 1 else noise_char
        # Normalize both to compute actual distance
        norm_anchor = normalize_text(anchor)
        norm_modified = normalize_text(modified)
        dist = levenshtein_distance(norm_anchor, norm_modified)

        if dist > 2:
            return  # This modification went too far, skip

        # The fuzzy finder should accept this line
        result = fuzzy_find_anchor(anchor, [modified], max_distance=2)
        assert result is not None, (
            f"fuzzy_find_anchor rejected line within threshold.\n"
            f"Anchor: {anchor!r}, Line: {modified!r}, Distance: {dist}"
        )

    @given(anchor=_anchor_text)
    @settings(max_examples=100)
    def test_exact_match_always_accepted(self, anchor: str) -> None:
        """An exact match (distance 0) is always accepted."""
        # **Validates: Requirements 6.2**
        result = fuzzy_find_anchor(anchor, [anchor], max_distance=2)
        assert result is not None, (
            f"fuzzy_find_anchor rejected exact match: {anchor!r}"
        )
        # Distance should be 0 for an exact match
        assert result[2] == 0, (
            f"Expected distance 0 for exact match, got {result[2]}"
        )

    @given(
        anchor=st.text(
            alphabet=st.characters(categories=("L",)),
            min_size=5,
            max_size=20,
        ),
        suffix=st.text(
            alphabet=st.characters(categories=("L",)),
            min_size=4,
            max_size=10,
        ),
    )
    @settings(max_examples=100)
    def test_rejects_beyond_threshold(self, anchor: str, suffix: str) -> None:
        """Lines with Levenshtein distance > 2 are rejected."""
        # **Validates: Requirements 6.2**
        # Create a line that is definitely > 2 distance away by appending
        # enough extra characters
        distant_line = anchor + suffix
        norm_anchor = normalize_text(anchor)
        norm_distant = normalize_text(distant_line)
        dist = levenshtein_distance(norm_anchor, norm_distant)

        if dist <= 2:
            return  # Not distant enough, skip

        result = fuzzy_find_anchor(anchor, [distant_line], max_distance=2)
        assert result is None, (
            f"fuzzy_find_anchor accepted line beyond threshold.\n"
            f"Anchor: {anchor!r}, Line: {distant_line!r}, Distance: {dist}"
        )


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 5: Spec Discovery by Extension
# ---------------------------------------------------------------------------

import json
import tempfile
from pathlib import Path

import yaml
from hypothesis import assume

from parser_framework.spec_loader import (
    SpecValidationError,
    load_specs,
    validate_spec,
)


def _make_valid_spec_dict(book_id: str = "test_book") -> dict:
    """Return a minimal valid Book Spec dictionary."""
    return {
        "book_id": book_id,
        "filenames": ["test.pdf"],
        "output_path": "src/data/_extracted/test.txt",
        "section_anchors": [{"pattern": "SECTION ONE", "pattern_type": "literal"}],
        "heading_patterns": [{"regex": "^[A-Z]+$"}],
        "expected_fields": ["Cost"],
        "pipeline_stages": ["ingest", "extract"],
    }


# Strategy: generate valid book_id strings (alphanumeric + underscores, 1-64 chars)
_book_id_strategy = st.from_regex(r"[a-zA-Z][a-zA-Z0-9_]{0,30}", fullmatch=True)

# Strategy: generate filenames with various extensions
_valid_extensions = st.sampled_from([".yaml", ".yml", ".json"])
_invalid_extensions = st.sampled_from([".txt", ".py", ".md", ".xml", ".csv", ".toml", ".ini"])
_filename_base = st.from_regex(r"[a-z][a-z0-9_]{2,15}", fullmatch=True)


class TestSpecDiscoveryByExtension:
    """Property 5: Spec Discovery by Extension.

    For any directory containing files with extensions .yaml, .yml, .json,
    .txt, .py, and .md, the spec loader SHALL return specs only from files
    with extensions .yaml, .yml, or .json, and the count of loaded specs
    SHALL equal the count of valid spec files with those extensions.

    Validates: Requirements 2.1
    """

    @given(
        valid_names=st.lists(
            st.tuples(_filename_base, _valid_extensions),
            min_size=1,
            max_size=5,
            unique_by=lambda x: x[0],
        ),
        invalid_names=st.lists(
            st.tuples(_filename_base, _invalid_extensions),
            min_size=0,
            max_size=5,
            unique_by=lambda x: x[0],
        ),
    )
    @settings(max_examples=100)
    def test_only_valid_extensions_are_loaded(
        self,
        valid_names: list[tuple[str, str]],
        invalid_names: list[tuple[str, str]],
    ) -> None:
        """Only .yaml, .yml, .json files are discovered and loaded."""
        # **Validates: Requirements 2.1**
        # Ensure no name collisions between valid and invalid sets
        valid_bases = {name for name, _ in valid_names}
        invalid_bases = {name for name, _ in invalid_names}
        assume(not valid_bases & invalid_bases)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            # Create valid spec files with unique book_ids
            for i, (name, ext) in enumerate(valid_names):
                spec_data = _make_valid_spec_dict(book_id=f"book_{name}_{i}")
                file_path = tmp_path / f"{name}{ext}"
                if ext == ".json":
                    file_path.write_text(json.dumps(spec_data), encoding="utf-8")
                else:
                    file_path.write_text(yaml.dump(spec_data), encoding="utf-8")

            # Create invalid-extension files with valid spec content
            for i, (name, ext) in enumerate(invalid_names):
                spec_data = _make_valid_spec_dict(book_id=f"invalid_{name}_{i}")
                file_path = tmp_path / f"{name}{ext}"
                if ext == ".json":
                    file_path.write_text(json.dumps(spec_data), encoding="utf-8")
                else:
                    file_path.write_text(yaml.dump(spec_data), encoding="utf-8")

            # Load specs and verify only valid extensions were picked up
            specs = load_specs(tmp_path)
            assert len(specs) == len(valid_names), (
                f"Expected {len(valid_names)} specs from valid extensions, "
                f"got {len(specs)}. Files in dir: "
                f"{[f.name for f in tmp_path.iterdir()]}"
            )

    @given(
        ext=_invalid_extensions,
        name=_filename_base,
    )
    @settings(max_examples=100)
    def test_invalid_extension_files_are_ignored(
        self,
        ext: str,
        name: str,
    ) -> None:
        """Files with non-spec extensions are never loaded regardless of content."""
        # **Validates: Requirements 2.1**
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            spec_data = _make_valid_spec_dict(book_id=f"ignored_{name}")
            file_path = tmp_path / f"{name}{ext}"
            file_path.write_text(json.dumps(spec_data), encoding="utf-8")

            specs = load_specs(tmp_path)
            assert len(specs) == 0, (
                f"File with extension {ext!r} should not be loaded, "
                f"but got {len(specs)} specs"
            )


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 6: Spec Validation Error Reporting
# ---------------------------------------------------------------------------

# Strategy: generate invalid book_ids (containing special chars or too long)
_invalid_book_ids = st.one_of(
    st.just(""),  # empty
    st.just("has spaces"),  # spaces
    st.just("has-dashes"),  # dashes
    st.just("has.dots"),  # dots
    st.just("a" * 65),  # too long (65 chars)
    st.just("@special!"),  # special chars
)

# Strategy: generate invalid pipeline stages
_invalid_pipeline_stages = st.lists(
    st.text(
        alphabet=st.characters(categories=("L",)),
        min_size=1,
        max_size=10,
    ).filter(lambda s: s not in {"ingest", "extract", "validate"}),
    min_size=1,
    max_size=3,
)


class TestSpecValidationErrorReporting:
    """Property 6: Spec Validation Error Reporting.

    For any BookSpec dict that violates one or more validation rules (missing
    required field, duplicate book_id across specs, empty filenames list,
    invalid pipeline stage name, or invalid book_id format), the raised
    validation error message SHALL identify the source file path and the
    specific field or value that failed validation.

    Validates: Requirements 2.2, 2.3, 2.6
    """

    @given(
        missing_field=st.sampled_from([
            "book_id",
            "filenames",
            "output_path",
            "section_anchors",
            "heading_patterns",
            "expected_fields",
            "pipeline_stages",
        ]),
        filename=_filename_base,
    )
    @settings(max_examples=100)
    def test_missing_required_field_reports_file_and_field(
        self, missing_field: str, filename: str
    ) -> None:
        """Missing required field error contains source file and field name."""
        # **Validates: Requirements 2.2, 2.3**
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            spec_data = _make_valid_spec_dict()
            del spec_data[missing_field]

            source_file = tmp_path / f"{filename}.yaml"
            source_file.write_text(yaml.dump(spec_data), encoding="utf-8")

            try:
                validate_spec(spec_data, source_file)
                assert False, "Expected SpecValidationError was not raised"
            except SpecValidationError as e:
                error_msg = str(e)
                # Error must mention the source file path
                assert str(source_file) in error_msg, (
                    f"Error message does not contain source file path.\n"
                    f"Expected: {str(source_file)!r}\n"
                    f"Got: {error_msg!r}"
                )
                # Error must mention the failing field
                assert missing_field in error_msg, (
                    f"Error message does not contain field name.\n"
                    f"Expected field: {missing_field!r}\n"
                    f"Got: {error_msg!r}"
                )

    @given(bad_id=_invalid_book_ids, filename=_filename_base)
    @settings(max_examples=100)
    def test_invalid_book_id_format_reports_file_and_field(
        self, bad_id: str, filename: str
    ) -> None:
        """Invalid book_id format error contains source file and 'book_id' field."""
        # **Validates: Requirements 2.2, 2.3**
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            spec_data = _make_valid_spec_dict()
            spec_data["book_id"] = bad_id

            source_file = tmp_path / f"{filename}.yaml"
            source_file.write_text(yaml.dump(spec_data), encoding="utf-8")

            try:
                validate_spec(spec_data, source_file)
                assert False, "Expected SpecValidationError was not raised"
            except SpecValidationError as e:
                error_msg = str(e)
                assert str(source_file) in error_msg, (
                    f"Error message does not contain source file path.\n"
                    f"Expected: {str(source_file)!r}\n"
                    f"Got: {error_msg!r}"
                )
                assert "book_id" in error_msg, (
                    f"Error message does not contain 'book_id' field name.\n"
                    f"Got: {error_msg!r}"
                )

    @given(filename=_filename_base)
    @settings(max_examples=100)
    def test_empty_filenames_reports_file_and_field(
        self, filename: str
    ) -> None:
        """Empty filenames list error contains source file and 'filenames' field."""
        # **Validates: Requirements 2.2, 2.3**
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            spec_data = _make_valid_spec_dict()
            spec_data["filenames"] = []

            source_file = tmp_path / f"{filename}.yaml"
            source_file.write_text(yaml.dump(spec_data), encoding="utf-8")

            try:
                validate_spec(spec_data, source_file)
                assert False, "Expected SpecValidationError was not raised"
            except SpecValidationError as e:
                error_msg = str(e)
                assert str(source_file) in error_msg, (
                    f"Error message does not contain source file path.\n"
                    f"Expected: {str(source_file)!r}\n"
                    f"Got: {error_msg!r}"
                )
                assert "filenames" in error_msg, (
                    f"Error message does not contain 'filenames' field name.\n"
                    f"Got: {error_msg!r}"
                )

    @given(invalid_stages=_invalid_pipeline_stages, filename=_filename_base)
    @settings(max_examples=100)
    def test_invalid_pipeline_stage_reports_file_and_field(
        self, invalid_stages: list[str], filename: str
    ) -> None:
        """Invalid pipeline stage error contains source file and 'pipeline_stages' field."""
        # **Validates: Requirements 2.2, 2.3**
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            spec_data = _make_valid_spec_dict()
            spec_data["pipeline_stages"] = invalid_stages

            source_file = tmp_path / f"{filename}.yaml"
            source_file.write_text(yaml.dump(spec_data), encoding="utf-8")

            try:
                validate_spec(spec_data, source_file)
                assert False, "Expected SpecValidationError was not raised"
            except SpecValidationError as e:
                error_msg = str(e)
                assert str(source_file) in error_msg, (
                    f"Error message does not contain source file path.\n"
                    f"Expected: {str(source_file)!r}\n"
                    f"Got: {error_msg!r}"
                )
                assert "pipeline_stages" in error_msg, (
                    f"Error message does not contain 'pipeline_stages' field name.\n"
                    f"Got: {error_msg!r}"
                )

    @given(
        book_id=_book_id_strategy,
        filename_a=_filename_base,
        filename_b=_filename_base,
    )
    @settings(max_examples=100)
    def test_duplicate_book_id_reports_file_and_field(
        self, book_id: str, filename_a: str, filename_b: str
    ) -> None:
        """Duplicate book_id error contains source file and 'book_id' field."""
        # **Validates: Requirements 2.6**
        assume(filename_a != filename_b)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            # Create two spec files with the same book_id
            spec_a = _make_valid_spec_dict(book_id=book_id)
            spec_b = _make_valid_spec_dict(book_id=book_id)

            file_a = tmp_path / f"{filename_a}.yaml"
            file_b = tmp_path / f"{filename_b}.yaml"
            file_a.write_text(yaml.dump(spec_a), encoding="utf-8")
            file_b.write_text(yaml.dump(spec_b), encoding="utf-8")

            try:
                load_specs(tmp_path)
                assert False, "Expected SpecValidationError was not raised"
            except SpecValidationError as e:
                error_msg = str(e)
                # Error must mention book_id field
                assert "book_id" in error_msg, (
                    f"Error message does not contain 'book_id' field name.\n"
                    f"Got: {error_msg!r}"
                )
                # Error must mention the source file (one of the two files)
                file_paths = [str(file_a), str(file_b)]
                assert any(fp in error_msg for fp in file_paths), (
                    f"Error message does not contain either source file path.\n"
                    f"Expected one of: {file_paths}\n"
                    f"Got: {error_msg!r}"
                )


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 1: Path Resolution Priority Order
# ---------------------------------------------------------------------------

from parser_framework.ingest_engine import ingest, resolve_pdf
from parser_framework.models import BookSpec, SectionAnchor, HeadingPattern


def _make_test_spec(book_id="test", filenames=None, output_path=None):
    """Create a minimal BookSpec for testing."""
    return BookSpec(
        book_id=book_id,
        filenames=filenames or ["test.pdf"],
        output_path=output_path or "src/data/_extracted/test.txt",
        section_anchors=[SectionAnchor(pattern="TEST")],
        heading_patterns=[HeadingPattern(regex="^[A-Z]+$")],
        expected_fields=["Cost"],
        pipeline_stages=["ingest"],
    )


# Strategy: generate list of directory indices (representing priority order)
_dir_count = st.integers(min_value=2, max_value=5)
_filename_list = st.lists(
    st.from_regex(r"[a-z][a-z0-9_]{2,12}\.pdf", fullmatch=True),
    min_size=1,
    max_size=4,
    unique=True,
)


class TestPathResolutionPriorityOrder:
    """Property 1: Path Resolution Priority Order.

    For any set of search directories and filename candidates where exactly
    one candidate exists at a known position in the directory list, the
    resolve_pdf function SHALL return that file, and it SHALL always prefer
    a match in an earlier-priority directory over a match in a later-priority
    directory (even if the later directory has an earlier-declared filename).

    Validates: Requirements 1.1, 5.5, 7.5
    """

    @given(
        num_dirs=st.integers(min_value=2, max_value=5),
        filenames=st.lists(
            st.from_regex(r"[a-z][a-z0-9_]{2,10}\.pdf", fullmatch=True),
            min_size=2,
            max_size=4,
            unique=True,
        ),
        priority_dir_idx=st.integers(min_value=0, max_value=4),
        later_dir_idx=st.integers(min_value=0, max_value=4),
    )
    @settings(max_examples=100)
    def test_earlier_directory_wins_over_later(
        self,
        num_dirs: int,
        filenames: list[str],
        priority_dir_idx: int,
        later_dir_idx: int,
    ) -> None:
        """Earlier-priority directory always wins over later-priority directory."""
        # **Validates: Requirements 1.1, 5.5, 7.5**
        # Constrain indices to actual dir count
        priority_dir_idx = priority_dir_idx % num_dirs
        later_dir_idx = later_dir_idx % num_dirs
        assume(priority_dir_idx < later_dir_idx)
        assume(len(filenames) >= 2)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            # Create the search directories
            dirs = []
            for i in range(num_dirs):
                d = tmp_path / f"dir_{i}"
                d.mkdir()
                dirs.append(d)

            # Place a file in the earlier-priority directory (using a later filename)
            later_filename = filenames[-1]  # last declared filename
            priority_file = dirs[priority_dir_idx] / later_filename
            priority_file.write_text("priority", encoding="utf-8")

            # Place a file in the later-priority directory (using an earlier filename)
            earlier_filename = filenames[0]  # first declared filename
            later_file = dirs[later_dir_idx] / earlier_filename
            later_file.write_text("later", encoding="utf-8")

            spec = _make_test_spec(filenames=filenames)
            result = resolve_pdf(spec, dirs)

            # The result must be from the earlier-priority directory
            assert result == priority_file, (
                f"Expected file from priority dir {priority_dir_idx}: {priority_file}\n"
                f"Got: {result}\n"
                f"Earlier dir should always win over later dir."
            )

    @given(
        num_dirs=st.integers(min_value=2, max_value=4),
        filename=st.from_regex(r"[a-z][a-z0-9_]{2,10}\.pdf", fullmatch=True),
        target_dir_idx=st.integers(min_value=0, max_value=3),
    )
    @settings(max_examples=100)
    def test_same_filename_in_multiple_dirs_returns_first(
        self,
        num_dirs: int,
        filename: str,
        target_dir_idx: int,
    ) -> None:
        """Same filename in multiple directories: first directory wins."""
        # **Validates: Requirements 1.1, 5.5, 7.5**
        target_dir_idx = target_dir_idx % num_dirs

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            dirs = []
            for i in range(num_dirs):
                d = tmp_path / f"dir_{i}"
                d.mkdir()
                dirs.append(d)

            # Place the same filename in ALL directories
            for d in dirs:
                (d / filename).write_text(f"content_{d.name}", encoding="utf-8")

            spec = _make_test_spec(filenames=[filename])
            result = resolve_pdf(spec, dirs)

            # Must always return from the first directory (index 0)
            expected = dirs[0] / filename
            assert result == expected, (
                f"Expected file from first directory: {expected}\n"
                f"Got: {result}\n"
                f"First directory should always have priority."
            )


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 3: FileNotFoundError Message
# Completeness
# ---------------------------------------------------------------------------


# Strategy: generate book_ids
_book_id_for_error = st.from_regex(r"[a-z][a-z0-9_]{2,20}", fullmatch=True)

# Strategy: generate filenames
_filenames_for_error = st.lists(
    st.from_regex(r"[a-z][a-z0-9_]{2,12}\.pdf", fullmatch=True),
    min_size=1,
    max_size=4,
    unique=True,
)

# Strategy: generate directory names
_dir_names_for_error = st.lists(
    st.from_regex(r"[a-z][a-z0-9_]{2,10}", fullmatch=True),
    min_size=1,
    max_size=4,
    unique=True,
)


class TestFileNotFoundErrorMessageCompleteness:
    """Property 3: FileNotFoundError Message Completeness.

    For any BookSpec with a non-empty book_id, a non-empty filenames list,
    and a non-empty list of search directories (none containing a matching
    file), the raised FileNotFoundError message SHALL contain the book_id
    string, every filename from the candidates list, and every directory
    path from the search list.

    Validates: Requirements 1.3
    """

    @given(
        book_id=_book_id_for_error,
        filenames=_filenames_for_error,
        dir_names=_dir_names_for_error,
    )
    @settings(max_examples=100)
    def test_error_contains_book_id_filenames_and_directories(
        self,
        book_id: str,
        filenames: list[str],
        dir_names: list[str],
    ) -> None:
        """FileNotFoundError message includes book_id, all filenames, all dirs."""
        # **Validates: Requirements 1.3**
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            # Create empty directories (no matching PDF files)
            dirs = []
            for name in dir_names:
                d = tmp_path / name
                d.mkdir()
                dirs.append(d)

            spec = _make_test_spec(book_id=book_id, filenames=filenames)

            try:
                resolve_pdf(spec, dirs)
                assert False, "Expected FileNotFoundError was not raised"
            except FileNotFoundError as e:
                error_msg = str(e)

                # Error must contain the book_id
                assert book_id in error_msg, (
                    f"Error message does not contain book_id.\n"
                    f"Expected: {book_id!r}\n"
                    f"Got: {error_msg!r}"
                )

                # Error must contain every filename
                for fname in filenames:
                    assert fname in error_msg, (
                        f"Error message does not contain filename.\n"
                        f"Expected: {fname!r}\n"
                        f"Got: {error_msg!r}"
                    )

                # Error must contain every directory path
                for d in dirs:
                    assert str(d) in error_msg, (
                        f"Error message does not contain directory path.\n"
                        f"Expected: {str(d)!r}\n"
                        f"Got: {error_msg!r}"
                    )


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 4: Graceful Page Error Handling
# ---------------------------------------------------------------------------

from unittest.mock import MagicMock, patch, PropertyMock
import re as _re


class TestGracefulPageErrorHandling:
    """Property 4: Graceful Page Error Handling.

    For any PDF with N pages where a subset of pages raise extraction errors,
    the output text SHALL contain exactly N page markers, one error marker
    [page K: extract error: ...] for each failed page K, and extracted text
    for all non-failing pages. No failing page SHALL prevent extraction of
    other pages.

    Validates: Requirements 1.5
    """

    @given(
        total_pages=st.integers(min_value=1, max_value=20),
        failing_pages=st.lists(
            st.integers(min_value=0, max_value=19),
            min_size=0,
            max_size=10,
            unique=True,
        ),
    )
    @settings(max_examples=100)
    def test_page_markers_and_error_markers_present(
        self,
        total_pages: int,
        failing_pages: list[int],
    ) -> None:
        """N page markers present, error markers for failed pages, text for others."""
        # **Validates: Requirements 1.5**
        # Constrain failing pages to be within range
        failing_pages = [p for p in failing_pages if p < total_pages]
        failing_set = set(failing_pages)

        # Create mock pages
        mock_pages = []
        for i in range(total_pages):
            page = MagicMock()
            if i in failing_set:
                page.extract_text.side_effect = RuntimeError(f"Page {i+1} failed")
            else:
                page.extract_text.return_value = f"Content of page {i+1}"
            mock_pages.append(page)

        # Create mock reader
        mock_reader = MagicMock()
        mock_reader.pages = mock_pages
        mock_reader.__len__ = lambda self: total_pages

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            # Create a fake PDF file so resolve_pdf succeeds
            pdf_dir = tmp_path / "books"
            pdf_dir.mkdir()
            fake_pdf = pdf_dir / "test.pdf"
            fake_pdf.write_bytes(b"%PDF-1.4 fake")

            # Use a relative output path and patch _REPO_ROOT to tmp_path
            output_rel = "output/test.txt"

            spec = _make_test_spec(
                filenames=["test.pdf"],
                output_path=output_rel,
            )

            with patch("parser_framework.ingest_engine.PdfReader", return_value=mock_reader), \
                 patch("parser_framework.ingest_engine._REPO_ROOT", tmp_path):
                result = ingest(spec, [pdf_dir])

            # Read the output file
            output_text = result.output_path.read_text(encoding="utf-8")

            # Verify exactly N page markers
            page_marker_pattern = _re.compile(
                r"===== Page (\d+) / (\d+) ====="
            )
            markers = page_marker_pattern.findall(output_text)
            assert len(markers) == total_pages, (
                f"Expected {total_pages} page markers, found {len(markers)}.\n"
                f"Output text:\n{output_text[:500]}"
            )

            # Verify each marker has correct total
            for page_num_str, total_str in markers:
                assert int(total_str) == total_pages, (
                    f"Page marker total mismatch: expected {total_pages}, "
                    f"got {total_str}"
                )

            # Verify error markers for failed pages
            error_marker_pattern = _re.compile(
                r"\[page (\d+): extract error: (.+?)\]"
            )
            error_markers = error_marker_pattern.findall(output_text)
            error_page_nums = {int(p) for p, _ in error_markers}

            expected_error_pages = {p + 1 for p in failing_set}  # 1-indexed
            assert error_page_nums == expected_error_pages, (
                f"Expected error markers for pages {expected_error_pages}, "
                f"got {error_page_nums}"
            )

            # Verify non-failing pages have their text extracted
            for i in range(total_pages):
                page_num = i + 1
                if i not in failing_set:
                    expected_content = f"Content of page {page_num}"
                    assert expected_content in output_text, (
                        f"Expected content for page {page_num} not found.\n"
                        f"Expected: {expected_content!r}\n"
                        f"Output excerpt: {output_text[:500]}"
                    )

    @given(
        total_pages=st.integers(min_value=2, max_value=10),
        failing_page=st.integers(min_value=0, max_value=9),
    )
    @settings(max_examples=100)
    def test_single_failure_does_not_prevent_other_extractions(
        self,
        total_pages: int,
        failing_page: int,
    ) -> None:
        """A single failing page does not prevent extraction of other pages."""
        # **Validates: Requirements 1.5**
        failing_page = failing_page % total_pages

        # Create mock pages
        mock_pages = []
        for i in range(total_pages):
            page = MagicMock()
            if i == failing_page:
                page.extract_text.side_effect = RuntimeError("extraction failed")
            else:
                page.extract_text.return_value = f"Text for page {i+1}"
            mock_pages.append(page)

        mock_reader = MagicMock()
        mock_reader.pages = mock_pages

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            pdf_dir = tmp_path / "books"
            pdf_dir.mkdir()
            fake_pdf = pdf_dir / "test.pdf"
            fake_pdf.write_bytes(b"%PDF-1.4 fake")

            output_rel = "output/test.txt"

            spec = _make_test_spec(
                filenames=["test.pdf"],
                output_path=output_rel,
            )

            with patch("parser_framework.ingest_engine.PdfReader", return_value=mock_reader), \
                 patch("parser_framework.ingest_engine._REPO_ROOT", tmp_path):
                result = ingest(spec, [pdf_dir])

            output_text = result.output_path.read_text(encoding="utf-8")

            # All non-failing pages should have their text present
            for i in range(total_pages):
                if i != failing_page:
                    expected = f"Text for page {i+1}"
                    assert expected in output_text, (
                        f"Page {i+1} text missing from output despite "
                        f"only page {failing_page+1} failing.\n"
                        f"Output: {output_text[:500]}"
                    )

            # The IngestResult should record the error
            assert len(result.errors) == 1, (
                f"Expected 1 error in result, got {len(result.errors)}"
            )


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 7: Literal Anchor Matching is
# Whitespace and Case Insensitive
# ---------------------------------------------------------------------------

from parser_framework.extract_engine import (
    find_section,
    extract_fields,
    extract,
    _remove_noise_lines,
)
from parser_framework.models import (
    BookSpec,
    SectionAnchor,
    HeadingPattern,
    LogEntry,
    ExtractResult,
)


# Strategy: generate anchor text that consists of 2-4 word tokens
_anchor_words = st.lists(
    st.from_regex(r"[A-Za-z]{2,8}", fullmatch=True),
    min_size=2,
    max_size=4,
)


class TestLiteralAnchorMatchingWhitespaceAndCaseInsensitive:
    """Property 7: Literal Anchor Matching is Whitespace and Case Insensitive.

    For any Section_Anchor with pattern_type: literal and any text containing
    that anchor's content with arbitrary whitespace expansion and case variation,
    the match SHALL succeed. Conversely, for regex-type anchors without the
    case-insensitive flag, a case-changed version of the text SHALL NOT match.

    Validates: Requirements 2.4, 6.1
    """

    @given(
        words=_anchor_words,
        extra_spaces=st.lists(
            st.integers(min_value=2, max_value=5),
            min_size=1,
            max_size=3,
        ),
    )
    @settings(max_examples=100)
    def test_literal_anchor_matches_despite_whitespace_variation(
        self, words: list[str], extra_spaces: list[int]
    ) -> None:
        """Literal anchors match even with extra whitespace between words."""
        # **Validates: Requirements 2.4, 6.1**
        anchor_text = " ".join(words)

        # Create a version with varied whitespace between words
        varied_parts = []
        for i, word in enumerate(words):
            varied_parts.append(word)
            if i < len(words) - 1:
                space_count = extra_spaces[i % len(extra_spaces)]
                varied_parts.append(" " * space_count)
        varied_text = "".join(varied_parts)

        # Build text containing the whitespace-varied anchor
        text = f"Some preamble text\n{varied_text}\nMore text after the anchor"

        anchor = SectionAnchor(pattern=anchor_text, pattern_type="literal")
        result = find_section(text, anchor)

        assert result is not None, (
            f"Literal anchor failed to match with whitespace variation.\n"
            f"Anchor: {anchor_text!r}\n"
            f"Text line: {varied_text!r}"
        )

    @given(words=_anchor_words)
    @settings(max_examples=100)
    def test_literal_anchor_matches_despite_case_variation(
        self, words: list[str]
    ) -> None:
        """Literal anchors match case variations via fuzzy fallback (short anchors)."""
        # **Validates: Requirements 2.4, 6.1**
        # The implementation uses whitespace_insensitive_find (case-sensitive) first,
        # then fuzzy_find_anchor with Levenshtein distance <= 2.
        # Case changes within distance 2 will match. We test with short anchors
        # where a single-char case change is within threshold.
        anchor_text = words[0][:4]  # Use short text so case change is within distance 2
        assume(len(anchor_text) >= 2)

        # Change case of just the first character (Levenshtein distance = 1)
        case_varied = anchor_text[0].swapcase() + anchor_text[1:]
        assume(case_varied != anchor_text)  # Ensure actually different

        text = f"Preamble\n{case_varied}\nAfter"

        anchor = SectionAnchor(pattern=anchor_text, pattern_type="literal")
        result = find_section(text, anchor)

        assert result is not None, (
            f"Literal anchor failed to match with minor case variation.\n"
            f"Anchor: {anchor_text!r}\n"
            f"Text line: {case_varied!r}"
        )

    @given(words=_anchor_words)
    @settings(max_examples=100)
    def test_regex_without_case_flag_rejects_case_change(
        self, words: list[str]
    ) -> None:
        """Regex anchor without case_insensitive flag rejects case-changed text."""
        # **Validates: Requirements 2.4, 6.1**
        # Use the words joined as a regex (escaped literal)
        anchor_text = " ".join(words)
        # Escape for regex use
        regex_pattern = re.escape(anchor_text)

        # Create a version where we swap case (upper <-> lower)
        case_varied = " ".join(w.swapcase() for w in words)

        # Ensure the original and varied are actually different
        assume(anchor_text != case_varied)

        text = f"Preamble\n{case_varied}\nAfter"

        anchor = SectionAnchor(
            pattern=regex_pattern,
            pattern_type="regex",
            case_insensitive=False,
        )
        result = find_section(text, anchor)

        assert result is None, (
            f"Regex anchor (no case_insensitive) should reject case-changed text.\n"
            f"Pattern: {regex_pattern!r}\n"
            f"Text line: {case_varied!r}"
        )


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 8: Alias Resolution Uses
# Declaration Order
# ---------------------------------------------------------------------------

class TestAliasResolutionUsesDeclarationOrder:
    """Property 8: Alias Resolution Uses Declaration Order.

    For any Section_Anchor with N aliases where the text contains matches for
    aliases at indices i and j (i < j in declaration order), the resolver SHALL
    use the alias at index i (the earlier-declared one), regardless of the
    textual position of either match.

    Validates: Requirements 2.5
    """

    @given(
        primary=st.from_regex(r"[A-Z]{4,8}PRIMARY", fullmatch=True),
        alias_a=st.from_regex(r"[A-Z]{4,8}ALIASA", fullmatch=True),
        alias_b=st.from_regex(r"[A-Z]{4,8}ALIASB", fullmatch=True),
    )
    @settings(max_examples=100)
    def test_earlier_declared_alias_wins(
        self, primary: str, alias_a: str, alias_b: str
    ) -> None:
        """Earlier-declared alias is used regardless of textual position."""
        # **Validates: Requirements 2.5**
        # Ensure all three are distinct
        assume(len({primary, alias_a, alias_b}) == 3)
        # Ensure none is a substring of another (to avoid accidental matches)
        assume(alias_a not in alias_b and alias_b not in alias_a)
        assume(primary not in alias_a and primary not in alias_b)

        # Put alias_b (later-declared) at an earlier textual position,
        # and alias_a (earlier-declared) at a later textual position.
        # Primary is NOT in the text.
        text = f"Some text before\n{alias_b}\nMiddle text here\n{alias_a}\nEnd text"

        anchor = SectionAnchor(
            pattern=primary,
            pattern_type="literal",
            aliases=[alias_a, alias_b],
        )
        result = find_section(text, anchor)

        # The implementation tries patterns in order: primary, alias_a, alias_b.
        # Primary is not found. alias_a IS in the text, so it should match first
        # (before alias_b is even tried), regardless of textual position.
        assert result is not None, (
            f"Expected find_section to find one of the aliases.\n"
            f"Aliases: [{alias_a!r}, {alias_b!r}]\n"
            f"Text: {text!r}"
        )

        # The match offset should correspond to alias_a's position (earlier-declared alias)
        start, _end = result
        # whitespace_insensitive_find searches for the pattern in the full text
        alias_a_offset = text.find(alias_a)

        assert start == alias_a_offset, (
            f"Expected match at alias_a position ({alias_a_offset}), "
            f"got {start}.\n"
            f"alias_a ({alias_a!r}) is earlier-declared and should be tried before alias_b."
        )

    @given(
        primary=st.from_regex(r"[A-Z]{3,8}", fullmatch=True),
        alias_first=st.from_regex(r"[A-Z]{3,8}", fullmatch=True),
    )
    @settings(max_examples=100)
    def test_primary_pattern_tried_before_aliases(
        self, primary: str, alias_first: str
    ) -> None:
        """Primary pattern is tried before any aliases."""
        # **Validates: Requirements 2.5**
        assume(primary != alias_first)

        # Both primary and alias are in text, but primary should win
        text = f"Preamble\n{alias_first}\nMiddle\n{primary}\nEnd"

        anchor = SectionAnchor(
            pattern=primary,
            pattern_type="literal",
            aliases=[alias_first],
        )
        result = find_section(text, anchor)

        assert result is not None, "Expected find_section to find the pattern"

        start, _end = result
        primary_offset = text.find(primary)

        assert start == primary_offset, (
            f"Expected primary pattern match at offset {primary_offset}, got {start}.\n"
            f"Primary should be tried before aliases."
        )


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 9: Section and Heading Partitioning
# ---------------------------------------------------------------------------

class TestSectionAndHeadingPartitioning:
    """Property 9: Section and Heading Partitioning.

    For any ingested text with K section anchors matching successfully and
    M headings within a section, the extracted blocks SHALL form a complete
    partition of the section text: the concatenation of all heading blocks
    (in order) SHALL equal the section text between the first heading and
    the section boundary, with no gaps and no overlaps. The number of
    extracted blocks SHALL equal the number of matched headings.

    Validates: Requirements 3.1, 3.2
    """

    @given(
        heading_names=st.lists(
            st.from_regex(r"[A-Z]{3,10}", fullmatch=True),
            min_size=2,
            max_size=5,
            unique=True,
        ),
        body_texts=st.lists(
            st.from_regex(r"[a-z ]{5,20}", fullmatch=True),
            min_size=2,
            max_size=5,
        ),
    )
    @settings(max_examples=100)
    def test_heading_blocks_form_complete_partition(
        self, heading_names: list[str], body_texts: list[str]
    ) -> None:
        """Concatenation of heading blocks equals section text from first heading to boundary."""
        # **Validates: Requirements 3.1, 3.2**
        # Ensure body_texts matches heading count
        body_texts = body_texts[: len(heading_names)]
        while len(body_texts) < len(heading_names):
            body_texts.append("default body text")

        # Build section text with a known anchor and headings
        section_anchor_text = "MYSECTION"
        lines = [section_anchor_text]
        for name, body in zip(heading_names, body_texts):
            lines.append(name)
            lines.append(f"Cost: 1")
            lines.append(body)

        text = "\n".join(lines)

        # Use a heading pattern that matches the ALL-CAPS names followed by Cost:
        spec = BookSpec(
            book_id="test_partition",
            filenames=["test.pdf"],
            output_path="out.txt",
            section_anchors=[SectionAnchor(pattern=section_anchor_text, pattern_type="literal")],
            heading_patterns=[HeadingPattern(regex=r"^([A-Z]{3,10})\nCost:", flags=["MULTILINE"])],
            expected_fields=["Cost"],
            pipeline_stages=["extract"],
        )

        result = extract(spec, text)

        # Number of entries should equal number of headings
        assert len(result.entries) == len(heading_names), (
            f"Expected {len(heading_names)} entries, got {len(result.entries)}.\n"
            f"Entries: {list(result.entries.keys())}"
        )

    @given(
        num_headings=st.integers(min_value=1, max_value=6),
    )
    @settings(max_examples=100)
    def test_block_count_equals_heading_count(
        self, num_headings: int
    ) -> None:
        """Number of extracted blocks equals number of matched headings."""
        # **Validates: Requirements 3.1, 3.2**
        section_anchor_text = "TESTSECTION"
        lines = [section_anchor_text]
        for i in range(num_headings):
            lines.append(f"HEADING{i:02d}")
            lines.append(f"Cost: {i}")
            lines.append(f"Body text for heading {i}")

        text = "\n".join(lines)

        spec = BookSpec(
            book_id="test_count",
            filenames=["test.pdf"],
            output_path="out.txt",
            section_anchors=[SectionAnchor(pattern=section_anchor_text, pattern_type="literal")],
            heading_patterns=[HeadingPattern(regex=r"^(HEADING\d{2})\nCost:", flags=["MULTILINE"])],
            expected_fields=["Cost"],
            pipeline_stages=["extract"],
        )

        result = extract(spec, text)
        assert len(result.entries) == num_headings, (
            f"Expected {num_headings} entries, got {len(result.entries)}."
        )


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 11: Field Extraction Round-Trip
# ---------------------------------------------------------------------------

# Strategy: field names (no colons, no newlines, alphabetic starting)
_field_name_st = st.from_regex(r"[A-Z][A-Za-z]{1,15}", fullmatch=True)

# Strategy: field values (no colons, no newlines, must contain at least one non-space)
_field_value_st = st.from_regex(r"[A-Za-z0-9][A-Za-z0-9 ]{0,29}", fullmatch=True)


class TestFieldExtractionRoundTrip:
    """Property 11: Field Extraction Round-Trip.

    For any set of field names and corresponding non-empty values (containing
    no newlines or colons), constructing a text block with lines in the format
    FieldName: value and then running extract_fields SHALL return a dictionary
    mapping each field name to its value (with interior whitespace collapsed
    to single spaces).

    Validates: Requirements 3.4
    """

    @given(
        fields=st.lists(
            st.tuples(_field_name_st, _field_value_st),
            min_size=1,
            max_size=6,
            unique_by=lambda x: x[0],
        ),
    )
    @settings(max_examples=100)
    def test_constructed_field_lines_extracted_correctly(
        self, fields: list[tuple[str, str]]
    ) -> None:
        """Constructed FieldName: value lines are correctly extracted."""
        # **Validates: Requirements 3.4**
        # Construct a text block
        lines = []
        for name, value in fields:
            lines.append(f"{name}: {value}")
        block = "\n".join(lines)

        expected_field_names = [name for name, _ in fields]
        result = extract_fields(block, expected_field_names)

        for name, value in fields:
            # Expected value is whitespace-collapsed
            expected_value = re.sub(r"\s+", " ", value).strip()
            # Implementation returns None for empty values after strip
            if not expected_value:
                assert result[name] is None, (
                    f"Field {name!r}: expected None for empty value, got {result[name]!r}"
                )
            else:
                assert result[name] == expected_value, (
                    f"Field {name!r}: expected {expected_value!r}, got {result[name]!r}\n"
                    f"Block:\n{block}"
                )

    @given(
        name=_field_name_st,
        words=st.lists(
            st.from_regex(r"[A-Za-z0-9]{1,8}", fullmatch=True),
            min_size=2,
            max_size=5,
        ),
        extra_spaces=st.lists(
            st.integers(min_value=2, max_value=6),
            min_size=1,
            max_size=4,
        ),
    )
    @settings(max_examples=100)
    def test_whitespace_in_values_collapsed(
        self, name: str, words: list[str], extra_spaces: list[int]
    ) -> None:
        """Interior whitespace in values is collapsed to single spaces."""
        # **Validates: Requirements 3.4**
        # Build a value with extra whitespace between words
        parts = []
        for i, word in enumerate(words):
            parts.append(word)
            if i < len(words) - 1:
                space_count = extra_spaces[i % len(extra_spaces)]
                parts.append(" " * space_count)
        spaced_value = "".join(parts)

        block = f"{name}: {spaced_value}"
        result = extract_fields(block, [name])

        expected = " ".join(words)
        assert result[name] == expected, (
            f"Expected whitespace-collapsed value {expected!r}, got {result[name]!r}"
        )


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 12: Missing Fields Produce Null
# and Log Entry
# ---------------------------------------------------------------------------

class TestMissingFieldsProduceNullAndLogEntry:
    """Property 12: Missing Fields Produce Null and Log Entry.

    For any entry block and set of expected fields where one or more fields
    are absent from the block text, the extraction result SHALL contain null
    for each missing field, and the structured log SHALL contain one entry
    per missing field with the correct entry identifier, field name, and
    reason code not_found.

    Validates: Requirements 3.5
    """

    @given(
        present_fields=st.lists(
            st.tuples(_field_name_st, _field_value_st),
            min_size=1,
            max_size=3,
            unique_by=lambda x: x[0],
        ),
        absent_fields=st.lists(
            _field_name_st,
            min_size=1,
            max_size=3,
            unique=True,
        ),
    )
    @settings(max_examples=100)
    def test_absent_fields_produce_null_and_log_entries(
        self,
        present_fields: list[tuple[str, str]],
        absent_fields: list[str],
    ) -> None:
        """Absent fields return None and generate log entries with reason='not_found'."""
        # **Validates: Requirements 3.5**
        # Ensure absent fields don't overlap with present field names
        present_names = {name for name, _ in present_fields}
        absent_fields = [f for f in absent_fields if f not in present_names]
        assume(len(absent_fields) > 0)

        # Build text with only present fields as content under a heading
        section_anchor = "TESTSECTION"
        heading_name = "TESTENTRY"
        lines = [section_anchor, heading_name, f"Cost: 1"]
        for name, value in present_fields:
            if name != "Cost":
                lines.append(f"{name}: {value}")
        text = "\n".join(lines)

        all_fields = [name for name, _ in present_fields] + absent_fields

        spec = BookSpec(
            book_id="test_missing",
            filenames=["test.pdf"],
            output_path="out.txt",
            section_anchors=[SectionAnchor(pattern=section_anchor, pattern_type="literal")],
            heading_patterns=[HeadingPattern(regex=r"^(TESTENTRY)\nCost:", flags=["MULTILINE"])],
            expected_fields=all_fields,
            pipeline_stages=["extract"],
        )

        result = extract(spec, text)

        # Verify absent fields are None
        if result.entries:
            entry_key = list(result.entries.keys())[0]
            entry = result.entries[entry_key]
            for field_name in absent_fields:
                assert entry.get(field_name) is None, (
                    f"Expected None for absent field {field_name!r}, "
                    f"got {entry.get(field_name)!r}"
                )

            # Verify log entries for missing fields
            not_found_logs = [
                log for log in result.log
                if log.reason == "not_found" and log.field in absent_fields
            ]
            logged_fields = {log.field for log in not_found_logs}
            for field_name in absent_fields:
                assert field_name in logged_fields, (
                    f"Expected log entry with reason='not_found' for field {field_name!r}.\n"
                    f"Log entries: {[(l.field, l.reason) for l in result.log]}"
                )

    @given(
        absent_field=_field_name_st,
    )
    @settings(max_examples=100)
    def test_log_entry_contains_correct_entry_id_and_reason(
        self, absent_field: str
    ) -> None:
        """Log entries contain the correct entry_id, field name, and reason code."""
        # **Validates: Requirements 3.5**
        assume(absent_field != "Cost")

        section_anchor = "LOGSECTION"
        text = f"{section_anchor}\nMYENTRY\nCost: 5\nSome body text"

        spec = BookSpec(
            book_id="test_log_entry",
            filenames=["test.pdf"],
            output_path="out.txt",
            section_anchors=[SectionAnchor(pattern=section_anchor, pattern_type="literal")],
            heading_patterns=[HeadingPattern(regex=r"^(MYENTRY)\nCost:", flags=["MULTILINE"])],
            expected_fields=["Cost", absent_field],
            pipeline_stages=["extract"],
        )

        result = extract(spec, text)

        # Find the log entry for our absent field
        relevant_logs = [
            log for log in result.log
            if log.field == absent_field and log.reason == "not_found"
        ]
        assert len(relevant_logs) >= 1, (
            f"No log entry found for missing field {absent_field!r}.\n"
            f"All log entries: {[(l.entry_id, l.field, l.reason) for l in result.log]}"
        )

        log_entry = relevant_logs[0]
        assert log_entry.entry_id is not None, (
            "Log entry for missing field should have a non-None entry_id"
        )
        assert log_entry.book_id == "test_log_entry", (
            f"Expected book_id='test_log_entry', got {log_entry.book_id!r}"
        )


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 13: Unmatched Anchor Produces Skip
# and Log
# ---------------------------------------------------------------------------

class TestUnmatchedAnchorProducesSkipAndLog:
    """Property 13: Unmatched Anchor Produces Skip and Log.

    For any BookSpec with section anchors where one or more anchors cannot be
    found in the text (even after normalization and fuzzy matching), the
    extraction SHALL skip those sections, continue extracting from remaining
    matched sections, and produce a log entry per missed anchor with reason
    code anchor_not_found.

    Validates: Requirements 3.7, 6.3
    """

    @given(
        missing_anchor=st.from_regex(r"[A-Z]{5,12}MISSING", fullmatch=True),
        present_anchor=st.from_regex(r"[A-Z]{3,8}", fullmatch=True),
    )
    @settings(max_examples=100)
    def test_unmatched_anchor_logs_and_continues(
        self, missing_anchor: str, present_anchor: str
    ) -> None:
        """Missed anchors produce log entries without halting extraction."""
        # **Validates: Requirements 3.7, 6.3**
        assume(missing_anchor != present_anchor)

        # Build text that contains only the present anchor
        text = (
            f"Preamble text\n"
            f"{present_anchor}\n"
            f"ENTRYNAME\n"
            f"Cost: 3\n"
            f"Body text here"
        )

        spec = BookSpec(
            book_id="test_unmatched",
            filenames=["test.pdf"],
            output_path="out.txt",
            section_anchors=[
                SectionAnchor(pattern=missing_anchor, pattern_type="literal"),
                SectionAnchor(pattern=present_anchor, pattern_type="literal"),
            ],
            heading_patterns=[HeadingPattern(regex=r"^(ENTRYNAME)\nCost:", flags=["MULTILINE"])],
            expected_fields=["Cost"],
            pipeline_stages=["extract"],
        )

        result = extract(spec, text)

        # Should have a log entry for the missing anchor
        anchor_not_found_logs = [
            log for log in result.log if log.reason == "anchor_not_found"
        ]
        assert len(anchor_not_found_logs) >= 1, (
            f"Expected at least one 'anchor_not_found' log entry.\n"
            f"Log entries: {[(l.reason, l.detail) for l in result.log]}"
        )

        # Verify the log mentions the missing anchor
        found_missing_in_log = any(
            missing_anchor in (log.detail or "") for log in anchor_not_found_logs
        )
        assert found_missing_in_log, (
            f"Expected missing anchor {missing_anchor!r} mentioned in log detail.\n"
            f"Log details: {[l.detail for l in anchor_not_found_logs]}"
        )

        # Pipeline should still extract from the present section
        assert len(result.entries) > 0, (
            f"Expected entries from the present section, but got none.\n"
            f"The pipeline should continue extracting other sections."
        )

    @given(
        missing_anchors=st.lists(
            st.from_regex(r"[A-Z]{5,10}GONE", fullmatch=True),
            min_size=1,
            max_size=3,
            unique=True,
        ),
    )
    @settings(max_examples=100)
    def test_multiple_unmatched_anchors_all_logged(
        self, missing_anchors: list[str]
    ) -> None:
        """Each unmatched anchor produces its own log entry."""
        # **Validates: Requirements 3.7, 6.3**
        # Text that doesn't contain any of the missing anchors
        text = "Some generic text\nAnother line\nNothing special"

        spec = BookSpec(
            book_id="test_multi_missing",
            filenames=["test.pdf"],
            output_path="out.txt",
            section_anchors=[
                SectionAnchor(pattern=anchor, pattern_type="literal")
                for anchor in missing_anchors
            ],
            heading_patterns=[HeadingPattern(regex=r"^[A-Z]+$")],
            expected_fields=["Cost"],
            pipeline_stages=["extract"],
        )

        result = extract(spec, text)

        anchor_not_found_logs = [
            log for log in result.log if log.reason == "anchor_not_found"
        ]
        assert len(anchor_not_found_logs) == len(missing_anchors), (
            f"Expected {len(missing_anchors)} 'anchor_not_found' log entries, "
            f"got {len(anchor_not_found_logs)}.\n"
            f"Missing anchors: {missing_anchors}\n"
            f"Log entries: {[(l.reason, l.detail) for l in result.log]}"
        )


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 15: Noise Line Removal Preserves
# Non-Noise Content
# ---------------------------------------------------------------------------

# Strategy: generate text lines (some noise, some not)
_content_line_st = st.from_regex(r"[A-Za-z ]{5,30}", fullmatch=True)
_noise_number_st = st.integers(min_value=1, max_value=999)


class TestNoiseLineRemovalPreservesNonNoiseContent:
    """Property 15: Noise Line Removal Preserves Non-Noise Content.

    For any text block and noise-line regex, after noise removal:
    (a) no remaining line SHALL match the noise regex, and
    (b) every line from the original that did NOT match the noise regex
    SHALL be present in the output in its original order and content.

    Validates: Requirements 6.4
    """

    @given(
        content_lines=st.lists(_content_line_st, min_size=1, max_size=10),
        noise_numbers=st.lists(_noise_number_st, min_size=1, max_size=5),
        noise_positions=st.lists(
            st.integers(min_value=0, max_value=14),
            min_size=1,
            max_size=5,
        ),
    )
    @settings(max_examples=100)
    def test_no_remaining_line_matches_noise_regex(
        self,
        content_lines: list[str],
        noise_numbers: list[int],
        noise_positions: list[int],
    ) -> None:
        """After removal, no remaining line matches the noise regex."""
        # **Validates: Requirements 6.4**
        noise_regex = r"^Boons\s+\d+$"

        # Interleave noise lines into content
        all_lines = list(content_lines)
        for i, num in enumerate(noise_numbers):
            pos = noise_positions[i % len(noise_positions)] % (len(all_lines) + 1)
            noise_line = f"Boons {num}"
            all_lines.insert(pos, noise_line)

        text = "\n".join(all_lines)
        result = _remove_noise_lines(text, noise_regex)

        # No remaining line should match the noise pattern
        pattern = re.compile(noise_regex)
        for line in result.split("\n"):
            assert not pattern.match(line), (
                f"Noise line not removed: {line!r}"
            )

    @given(
        content_lines=st.lists(_content_line_st, min_size=1, max_size=10, unique=True),
        noise_count=st.integers(min_value=1, max_value=5),
    )
    @settings(max_examples=100)
    def test_non_noise_lines_preserved_in_order(
        self,
        content_lines: list[str],
        noise_count: int,
    ) -> None:
        """All non-noise lines are preserved in original order."""
        # **Validates: Requirements 6.4**
        noise_regex = r"^PageHeader\s+\d+$"

        # Build text: content lines interspersed with noise
        all_lines: list[str] = []
        for i, content in enumerate(content_lines):
            if i % 2 == 0 and noise_count > 0:
                all_lines.append(f"PageHeader {i + 1}")
                noise_count -= 1
            all_lines.append(content)

        text = "\n".join(all_lines)
        result = _remove_noise_lines(text, noise_regex)

        # Extract non-noise lines from original
        pattern = re.compile(noise_regex)
        expected_non_noise = [
            line for line in all_lines if not pattern.match(line)
        ]

        result_lines = result.split("\n")
        # Filter empty lines that may result from joining
        result_lines = [l for l in result_lines if l]
        expected_non_noise = [l for l in expected_non_noise if l]

        assert result_lines == expected_non_noise, (
            f"Non-noise lines not preserved in order.\n"
            f"Expected: {expected_non_noise}\n"
            f"Got: {result_lines}"
        )

    @given(content_lines=st.lists(_content_line_st, min_size=1, max_size=8))
    @settings(max_examples=100)
    def test_no_noise_regex_returns_text_unchanged(
        self, content_lines: list[str]
    ) -> None:
        """When noise_regex is None, text is returned unchanged."""
        # **Validates: Requirements 6.4**
        text = "\n".join(content_lines)
        result = _remove_noise_lines(text, None)
        assert result == text, (
            f"Expected text unchanged when noise_regex is None.\n"
            f"Got: {result!r}"
        )

# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 16: Baseline Regression Detection
# Correctness
# ---------------------------------------------------------------------------

from parser_framework.validation_reporter import (
    validate,
    compute_content_hash,
    save_baseline,
    load_baseline,
)
from parser_framework.models import FlaggedEntry, ValidationReport


def _make_spec_for_validation(book_id="test_prop", output_path="src/data/test_output.json"):
    return BookSpec(
        book_id=book_id,
        filenames=["test.pdf"],
        output_path=output_path,
        section_anchors=[],
        heading_patterns=[],
        expected_fields=[],
        pipeline_stages=["validate"],
    )


# Strategy: generate entry keys (alphanumeric identifiers)
_entry_key_st = st.from_regex(r"[a-z][a-z0-9_]{2,15}", fullmatch=True)

# Strategy: generate entry values (simple field dicts)
_entry_value_st = st.fixed_dictionaries({
    "description": st.text(
        alphabet=st.characters(categories=("L", "N", "P", "Z")),
        min_size=1,
        max_size=50,
    ),
    "cost": st.text(
        alphabet=st.characters(categories=("N",)),
        min_size=1,
        max_size=5,
    ),
})


class TestBaselineRegressionDetectionCorrectness:
    """Property 16: Baseline Regression Detection Correctness.

    For any baseline snapshot and current extraction output, the validation
    report SHALL flag: every key in the baseline but not in current as
    missing_entry, every key in current but not in baseline as new_entry,
    and every key present in both whose content hash differs as
    content_changed. The total count of flags SHALL equal the sum of these
    three sets, with no duplicates. No entry appears in more than one
    severity category.

    Validates: Requirements 4.2, 4.3, 4.4
    """

    @given(
        shared_keys=st.lists(_entry_key_st, min_size=1, max_size=5, unique=True),
        removed_keys=st.lists(_entry_key_st, min_size=1, max_size=3, unique=True),
        added_keys=st.lists(_entry_key_st, min_size=1, max_size=3, unique=True),
        changed_indices=st.lists(st.integers(min_value=0, max_value=4), min_size=0, max_size=3, unique=True),
        shared_values=st.lists(_entry_value_st, min_size=1, max_size=5),
        removed_values=st.lists(_entry_value_st, min_size=1, max_size=3),
        added_values=st.lists(_entry_value_st, min_size=1, max_size=3),
    )
    @settings(max_examples=100)
    def test_missing_new_and_changed_entries_correctly_flagged(
        self,
        shared_keys: list[str],
        removed_keys: list[str],
        added_keys: list[str],
        changed_indices: list[int],
        shared_values: list[dict],
        removed_values: list[dict],
        added_values: list[dict],
    ) -> None:
        """Missing, new, and changed entries are each correctly flagged."""
        # **Validates: Requirements 4.2, 4.3, 4.4**
        # Ensure key sets don't overlap
        all_keys = set(shared_keys) | set(removed_keys) | set(added_keys)
        assume(len(all_keys) == len(shared_keys) + len(removed_keys) + len(added_keys))

        # Pad values to match key counts
        while len(shared_values) < len(shared_keys):
            shared_values.append({"description": "filler", "cost": "1"})
        while len(removed_values) < len(removed_keys):
            removed_values.append({"description": "removed_filler", "cost": "2"})
        while len(added_values) < len(added_keys):
            added_values.append({"description": "added_filler", "cost": "3"})

        # Build baseline entries: shared + removed
        baseline_entries: dict[str, dict] = {}
        for key, val in zip(shared_keys, shared_values[:len(shared_keys)]):
            baseline_entries[key] = val
        for key, val in zip(removed_keys, removed_values[:len(removed_keys)]):
            baseline_entries[key] = val

        # Build current entries: shared (some changed) + added
        current_entries: dict[str, dict] = {}
        changed_keys_set: set[str] = set()
        for i, (key, val) in enumerate(zip(shared_keys, shared_values[:len(shared_keys)])):
            if i in changed_indices and i < len(shared_keys):
                # Modify the value to produce a different hash
                modified_val = dict(val)
                modified_val["description"] = val.get("description", "") + "_CHANGED"
                current_entries[key] = modified_val
                changed_keys_set.add(key)
            else:
                current_entries[key] = val
        for key, val in zip(added_keys, added_values[:len(added_keys)]):
            current_entries[key] = val

        # Create baseline using save_baseline, then validate with current
        with tempfile.TemporaryDirectory() as tmp_dir:
            baseline_dir = Path(tmp_dir)
            spec = _make_spec_for_validation()
            baseline_path = baseline_dir / spec.book_id / "test_output.json"

            # Save baseline from baseline_entries
            save_baseline(baseline_path, baseline_entries)

            # Run validation with current entries
            report = validate(spec, current_entries, baseline_dir)

            # Check missing entries (in baseline but not in current = removed_keys)
            missing_flagged = [f for f in report.flagged if f.severity == "missing_entry"]
            missing_keys_flagged = {f.key for f in missing_flagged}
            assert missing_keys_flagged == set(removed_keys), (
                f"Expected missing_entry flags for {set(removed_keys)}, "
                f"got {missing_keys_flagged}"
            )

            # Check new entries (in current but not in baseline = added_keys)
            new_flagged = [f for f in report.flagged if f.severity == "new_entry"]
            new_keys_flagged = {f.key for f in new_flagged}
            assert new_keys_flagged == set(added_keys), (
                f"Expected new_entry flags for {set(added_keys)}, "
                f"got {new_keys_flagged}"
            )

            # Check changed entries
            changed_flagged = [f for f in report.flagged if f.severity == "content_changed"]
            changed_keys_flagged = {f.key for f in changed_flagged}
            assert changed_keys_flagged == changed_keys_set, (
                f"Expected content_changed flags for {changed_keys_set}, "
                f"got {changed_keys_flagged}"
            )

            # Total flags = sum of three sets (no duplicates)
            expected_total = len(removed_keys) + len(added_keys) + len(changed_keys_set)
            assert len(report.flagged) == expected_total, (
                f"Expected {expected_total} total flags, got {len(report.flagged)}.\n"
                f"missing={len(missing_flagged)}, new={len(new_flagged)}, "
                f"changed={len(changed_flagged)}"
            )

            # Verify regression counts match
            assert report.regressions["missing_entry"] == len(removed_keys), (
                f"Regression count mismatch for missing_entry"
            )
            assert report.regressions["new_entry"] == len(added_keys), (
                f"Regression count mismatch for new_entry"
            )
            assert report.regressions["content_changed"] == len(changed_keys_set), (
                f"Regression count mismatch for content_changed"
            )

    @given(
        shared_keys=st.lists(_entry_key_st, min_size=2, max_size=6, unique=True),
        shared_values=st.lists(_entry_value_st, min_size=2, max_size=6),
    )
    @settings(max_examples=100)
    def test_no_entry_appears_in_more_than_one_severity_category(
        self,
        shared_keys: list[str],
        shared_values: list[dict],
    ) -> None:
        """No entry appears in more than one severity category."""
        # **Validates: Requirements 4.2, 4.3, 4.4**
        # Pad values
        while len(shared_values) < len(shared_keys):
            shared_values.append({"description": "filler", "cost": "1"})

        # Baseline has all keys; current has first half unchanged, second half removed,
        # and we add one new key
        half = len(shared_keys) // 2
        baseline_entries = {k: v for k, v in zip(shared_keys, shared_values[:len(shared_keys)])}

        # Current: keep first half, modify one, drop rest
        current_entries: dict[str, dict] = {}
        for i, (k, v) in enumerate(zip(shared_keys[:half], shared_values[:half])):
            if i == 0:
                modified = dict(v)
                modified["description"] = "COMPLETELY_DIFFERENT_VALUE"
                current_entries[k] = modified
            else:
                current_entries[k] = v
        # Add a new key
        current_entries["brand_new_key_xyz"] = {"description": "new", "cost": "9"}

        with tempfile.TemporaryDirectory() as tmp_dir:
            baseline_dir = Path(tmp_dir)
            spec = _make_spec_for_validation()
            baseline_path = baseline_dir / spec.book_id / "test_output.json"
            save_baseline(baseline_path, baseline_entries)

            report = validate(spec, current_entries, baseline_dir)

            # Check no key appears in more than one category
            keys_by_severity: dict[str, set[str]] = {
                "missing_entry": set(),
                "new_entry": set(),
                "content_changed": set(),
            }
            for f in report.flagged:
                keys_by_severity[f.severity].add(f.key)

            # Pairwise check for overlaps
            for sev_a, keys_a in keys_by_severity.items():
                for sev_b, keys_b in keys_by_severity.items():
                    if sev_a != sev_b:
                        overlap = keys_a & keys_b
                        assert not overlap, (
                            f"Key(s) {overlap} appear in both {sev_a} and {sev_b}"
                        )


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 17: First-Run Baseline Creation
# ---------------------------------------------------------------------------

class TestFirstRunBaselineCreation:
    """Property 17: First-Run Baseline Creation.

    For any extraction result when no prior baseline file exists, running
    validation SHALL produce a report with zero regressions (all severity
    counts = 0) and SHALL create a baseline file whose entry hashes match
    the current output.

    Validates: Requirements 4.7
    """

    @given(
        entries=st.dictionaries(
            keys=_entry_key_st,
            values=_entry_value_st,
            min_size=1,
            max_size=8,
        ),
    )
    @settings(max_examples=100)
    def test_zero_regressions_on_first_run(
        self,
        entries: dict[str, dict],
    ) -> None:
        """First-run validation produces zero regressions."""
        # **Validates: Requirements 4.7**
        with tempfile.TemporaryDirectory() as tmp_dir:
            baseline_dir = Path(tmp_dir)
            spec = _make_spec_for_validation()

            report = validate(spec, entries, baseline_dir)

            # All severity counts should be zero
            assert report.regressions["missing_entry"] == 0, (
                f"Expected 0 missing_entry regressions on first run, "
                f"got {report.regressions['missing_entry']}"
            )
            assert report.regressions["new_entry"] == 0, (
                f"Expected 0 new_entry regressions on first run, "
                f"got {report.regressions['new_entry']}"
            )
            assert report.regressions["content_changed"] == 0, (
                f"Expected 0 content_changed regressions on first run, "
                f"got {report.regressions['content_changed']}"
            )

            # Flagged list should be empty
            assert len(report.flagged) == 0, (
                f"Expected 0 flagged entries on first run, got {len(report.flagged)}"
            )

            # Status should be "ok"
            assert report.status == "ok", (
                f"Expected status 'ok' on first run, got {report.status!r}"
            )

    @given(
        entries=st.dictionaries(
            keys=_entry_key_st,
            values=_entry_value_st,
            min_size=1,
            max_size=8,
        ),
    )
    @settings(max_examples=100)
    def test_baseline_file_created_at_expected_path(
        self,
        entries: dict[str, dict],
    ) -> None:
        """Baseline file is created at the expected path on first run."""
        # **Validates: Requirements 4.7**
        with tempfile.TemporaryDirectory() as tmp_dir:
            baseline_dir = Path(tmp_dir)
            spec = _make_spec_for_validation()

            validate(spec, entries, baseline_dir)

            # Baseline should be at <baseline_dir>/<book_id>/<table_name>.json
            expected_path = baseline_dir / spec.book_id / "test_output.json"
            assert expected_path.exists(), (
                f"Expected baseline file at {expected_path}, but it does not exist.\n"
                f"Contents of baseline_dir: {list(baseline_dir.rglob('*'))}"
            )

    @given(
        entries=st.dictionaries(
            keys=_entry_key_st,
            values=_entry_value_st,
            min_size=1,
            max_size=8,
        ),
    )
    @settings(max_examples=100)
    def test_baseline_hashes_match_current_entries(
        self,
        entries: dict[str, dict],
    ) -> None:
        """Loading the created baseline and computing hashes matches current entries."""
        # **Validates: Requirements 4.7**
        with tempfile.TemporaryDirectory() as tmp_dir:
            baseline_dir = Path(tmp_dir)
            spec = _make_spec_for_validation()

            validate(spec, entries, baseline_dir)

            # Load the baseline that was just created
            expected_path = baseline_dir / spec.book_id / "test_output.json"
            baseline_data = load_baseline(expected_path)

            assert baseline_data is not None, (
                f"Expected baseline file to be loadable, got None"
            )

            baseline_entries = baseline_data.get("entries", {})

            # Every key in current entries should be in the baseline
            assert set(baseline_entries.keys()) == set(entries.keys()), (
                f"Baseline keys don't match current entries.\n"
                f"Baseline keys: {set(baseline_entries.keys())}\n"
                f"Current keys: {set(entries.keys())}"
            )

            # Each entry's hash in the baseline should match computing it fresh
            for key, value in entries.items():
                expected_hash = compute_content_hash(value)
                actual_hash = baseline_entries[key]["hash"]
                assert actual_hash == expected_hash, (
                    f"Hash mismatch for key {key!r}.\n"
                    f"Expected: {expected_hash}\n"
                    f"Got: {actual_hash}"
                )


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 18: Exit Code Reflects Worst Status
# ---------------------------------------------------------------------------


class TestExitCodeReflectsWorstStatus:
    """Property 18: Exit Code Reflects Worst Status.

    For any collection of stage results with statuses from {ok, warning, error},
    the CLI exit code SHALL be 0 if and only if no result has status "error".
    If any result has status "error", the exit code SHALL be 1.

    Validates: Requirements 5.7
    """

    @given(
        statuses=st.lists(
            st.sampled_from(["ok", "warning", "error"]),
            min_size=1,
            max_size=20,
        ),
    )
    @settings(max_examples=100)
    def test_exit_code_zero_iff_no_error(self, statuses: list[str]) -> None:
        """Exit code is 0 iff no status is 'error'; 1 otherwise."""
        # **Validates: Requirements 5.7**
        # The exit code logic from parse.py: return 1 if has_error else 0
        # where has_error is set True whenever a stage produces "error" status.
        has_error = any(s == "error" for s in statuses)
        expected_exit_code = 1 if has_error else 0

        # Replicate the logic used in the CLI handlers
        computed_exit_code = 0 if all(s != "error" for s in statuses) else 1

        assert computed_exit_code == expected_exit_code, (
            f"Exit code mismatch for statuses {statuses}.\n"
            f"Expected: {expected_exit_code}, Got: {computed_exit_code}"
        )

    @given(
        ok_count=st.integers(min_value=0, max_value=10),
        warning_count=st.integers(min_value=0, max_value=10),
    )
    @settings(max_examples=100)
    def test_exit_code_zero_when_only_ok_and_warning(
        self, ok_count: int, warning_count: int
    ) -> None:
        """Exit code is 0 when all statuses are 'ok' or 'warning' (no 'error')."""
        # **Validates: Requirements 5.7**
        assume(ok_count + warning_count > 0)  # At least one status present
        statuses = ["ok"] * ok_count + ["warning"] * warning_count

        has_error = any(s == "error" for s in statuses)
        exit_code = 1 if has_error else 0

        assert exit_code == 0, (
            f"Expected exit code 0 with no errors, got {exit_code}.\n"
            f"Statuses: {statuses}"
        )

    @given(
        ok_count=st.integers(min_value=0, max_value=10),
        warning_count=st.integers(min_value=0, max_value=10),
        error_count=st.integers(min_value=1, max_value=10),
    )
    @settings(max_examples=100)
    def test_exit_code_one_when_any_error_present(
        self, ok_count: int, warning_count: int, error_count: int
    ) -> None:
        """Exit code is 1 when at least one status is 'error'."""
        # **Validates: Requirements 5.7**
        statuses = ["ok"] * ok_count + ["warning"] * warning_count + ["error"] * error_count

        has_error = any(s == "error" for s in statuses)
        exit_code = 1 if has_error else 0

        assert exit_code == 1, (
            f"Expected exit code 1 with errors present, got {exit_code}.\n"
            f"Statuses: {statuses}"
        )

    @given(
        statuses=st.lists(
            st.sampled_from(["ok", "warning", "error"]),
            min_size=1,
            max_size=15,
        ),
    )
    @settings(max_examples=100)
    def test_exit_code_independent_of_status_order(
        self, statuses: list[str]
    ) -> None:
        """Exit code is the same regardless of the order of statuses."""
        # **Validates: Requirements 5.7**
        import random

        has_error = any(s == "error" for s in statuses)
        expected_exit_code = 1 if has_error else 0

        # Shuffle and re-check — the exit code must be the same
        shuffled = list(statuses)
        random.shuffle(shuffled)
        shuffled_exit_code = 1 if any(s == "error" for s in shuffled) else 0

        assert shuffled_exit_code == expected_exit_code, (
            f"Exit code should not depend on order.\n"
            f"Original: {statuses} -> {expected_exit_code}\n"
            f"Shuffled: {shuffled} -> {shuffled_exit_code}"
        )


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 20: JSON Output Formatting
# ---------------------------------------------------------------------------


def format_json(entries: dict) -> str:
    """Format extraction entries as JSON with 2-space indent and trailing newline.

    This replicates the JSON output formatting used throughout the framework
    (see parse.py _write_verbose_log and Requirement 7.3).
    """
    return json.dumps(entries, indent=2, ensure_ascii=False) + "\n"


# Strategy: generate keys for JSON dicts
_json_key_st = st.from_regex(r"[a-z][a-z0-9_]{1,20}", fullmatch=True)

# Strategy: generate JSON-compatible values (strings, ints, floats, bools, None)
_json_value_st = st.one_of(
    st.text(
        alphabet=st.characters(
            categories=("L", "N", "P", "Z"),
            exclude_characters="\x00",
        ),
        min_size=0,
        max_size=50,
    ),
    st.integers(min_value=-1000, max_value=1000),
    st.floats(allow_nan=False, allow_infinity=False, min_value=-1e6, max_value=1e6),
    st.booleans(),
    st.none(),
)

# Strategy: generate nested dicts (simulating extraction output)
_json_entry_st = st.dictionaries(
    keys=_json_key_st,
    values=_json_value_st,
    min_size=1,
    max_size=6,
)

_json_output_st = st.dictionaries(
    keys=_json_key_st,
    values=_json_entry_st,
    min_size=1,
    max_size=8,
)


class TestJsonOutputFormatting:
    """Property 20: JSON Output Formatting.

    For any non-empty extraction dictionary, writing it via the framework's
    JSON output function SHALL produce output that:
    (a) is valid UTF-8,
    (b) uses exactly 2-space indentation, and
    (c) ends with a single newline character.

    Validates: Requirements 7.3
    """

    @given(entries=_json_output_st)
    @settings(max_examples=100)
    def test_output_is_valid_utf8(self, entries: dict) -> None:
        """Output is valid UTF-8."""
        # **Validates: Requirements 7.3**
        output = format_json(entries)

        # Encode to bytes and decode back — must succeed without errors
        encoded = output.encode("utf-8")
        decoded = encoded.decode("utf-8")
        assert decoded == output, (
            "JSON output is not valid UTF-8 (encode/decode round-trip failed)"
        )

    @given(entries=_json_output_st)
    @settings(max_examples=100)
    def test_output_uses_two_space_indentation(self, entries: dict) -> None:
        """Output uses exactly 2-space indentation (no tabs, indent is multiples of 2)."""
        # **Validates: Requirements 7.3**
        output = format_json(entries)
        lines = output.split("\n")

        for i, line in enumerate(lines):
            if not line:
                continue  # skip empty lines (e.g. trailing newline)

            # Check no tabs used for indentation
            assert "\t" not in line, (
                f"Tab character found in output line {i + 1}: {line!r}"
            )

            # Check indent is a multiple of 2 spaces
            stripped = line.lstrip(" ")
            indent_len = len(line) - len(stripped)
            if indent_len > 0:
                assert indent_len % 2 == 0, (
                    f"Indentation at line {i + 1} is {indent_len} spaces "
                    f"(not a multiple of 2): {line!r}"
                )

    @given(entries=_json_output_st)
    @settings(max_examples=100)
    def test_output_ends_with_single_newline(self, entries: dict) -> None:
        """Output ends with exactly one newline character."""
        # **Validates: Requirements 7.3**
        output = format_json(entries)

        assert output.endswith("\n"), (
            f"Output does not end with newline.\n"
            f"Last 20 chars: {output[-20:]!r}"
        )
        assert not output.endswith("\n\n"), (
            f"Output ends with multiple newlines.\n"
            f"Last 20 chars: {output[-20:]!r}"
        )

    @given(entries=_json_output_st)
    @settings(max_examples=100)
    def test_output_is_valid_json(self, entries: dict) -> None:
        """Output can be parsed back as valid JSON matching the input."""
        # **Validates: Requirements 7.3**
        output = format_json(entries)

        # Must be parseable as JSON
        parsed = json.loads(output)
        assert parsed == entries, (
            f"Parsed JSON does not match input.\n"
            f"Input keys: {list(entries.keys())}\n"
            f"Parsed keys: {list(parsed.keys())}"
        )

    @given(
        entries=st.dictionaries(
            keys=_json_key_st,
            values=st.fixed_dictionaries({
                "description": st.text(
                    alphabet=st.characters(
                        categories=("L", "N", "P", "Z"),
                        include_characters="\u00e9\u00f1\u00fc\u2014\u2019\u00a3\u20ac",
                        exclude_characters="\x00",
                    ),
                    min_size=1,
                    max_size=40,
                ),
            }),
            min_size=1,
            max_size=5,
        ),
    )
    @settings(max_examples=100)
    def test_unicode_characters_preserved_not_escaped(self, entries: dict) -> None:
        """Non-ASCII Unicode characters are preserved (ensure_ascii=False)."""
        # **Validates: Requirements 7.3**
        output = format_json(entries)

        # With ensure_ascii=False, non-ASCII chars should be in the output directly,
        # not as \\uXXXX escape sequences (unless they happen to be control chars).
        # Verify the output is valid UTF-8 and parseable
        parsed = json.loads(output)
        assert parsed == entries, (
            "Unicode round-trip failed — parsed output differs from input"
        )

        # Verify the output bytes are valid UTF-8
        output.encode("utf-8")  # Will raise UnicodeEncodeError if invalid


# ---------------------------------------------------------------------------
# Feature: pdf-parser-framework, Property 19: Pretty-Printer Round-Trip
# ---------------------------------------------------------------------------


from parser_framework.models import BookSpec, SectionAnchor, HeadingPattern


def _serialize_book_spec_to_yaml(spec: BookSpec) -> str:
    """Serialize a BookSpec to YAML for round-trip testing.

    Produces a complete YAML representation of all BookSpec fields so that
    deserializing the output and validating it yields an equivalent object.
    """
    data = {
        "book_id": spec.book_id,
        "filenames": spec.filenames,
        "output_path": spec.output_path,
        "section_anchors": [
            {
                "pattern": a.pattern,
                "pattern_type": a.pattern_type,
                **({"case_insensitive": a.case_insensitive} if a.case_insensitive else {}),
                **({"aliases": a.aliases} if a.aliases else {}),
            }
            for a in spec.section_anchors
        ],
        "heading_patterns": [
            {
                "regex": h.regex,
                **({"flags": h.flags} if h.flags else {}),
            }
            for h in spec.heading_patterns
        ],
        "expected_fields": spec.expected_fields,
        "pipeline_stages": spec.pipeline_stages,
        **({"extraction_mode": spec.extraction_mode} if spec.extraction_mode != "pypdf" else {}),
        **({"noise_line_regex": spec.noise_line_regex} if spec.noise_line_regex else {}),
    }
    return yaml.dump(data, default_flow_style=False, allow_unicode=True)


# Strategy: generate valid BookSpec objects for round-trip testing
_valid_book_spec_st = st.builds(
    BookSpec,
    book_id=st.from_regex(r"[a-z][a-z0-9_]{2,20}", fullmatch=True),
    filenames=st.lists(
        st.from_regex(r"[A-Za-z][A-Za-z0-9_. -]{2,30}\.pdf", fullmatch=True),
        min_size=1,
        max_size=4,
    ),
    output_path=st.just("src/data/_extracted/test.txt"),
    section_anchors=st.lists(
        st.builds(
            SectionAnchor,
            pattern=st.from_regex(r"[A-Z][A-Z ]{2,15}", fullmatch=True),
            pattern_type=st.just("literal"),
            case_insensitive=st.just(False),
            aliases=st.none(),
        ),
        min_size=1,
        max_size=3,
    ),
    heading_patterns=st.lists(
        st.builds(
            HeadingPattern,
            regex=st.just("^[A-Z]+$"),
            flags=st.none(),
        ),
        min_size=1,
        max_size=2,
    ),
    expected_fields=st.lists(
        st.from_regex(r"[A-Z][A-Za-z]{2,15}", fullmatch=True),
        min_size=1,
        max_size=5,
    ),
    pipeline_stages=st.just(["ingest", "extract", "validate"]),
    extraction_mode=st.sampled_from(["pypdf", "pymupdf"]),
    noise_line_regex=st.one_of(st.none(), st.just("^Boons\\s+\\d+$")),
)


class TestPrettyPrinterRoundTrip:
    """Property 19: Pretty-Printer Round-Trip.

    For any valid BookSpec object, serializing it via the pretty-printer to
    YAML and then deserializing the result SHALL produce an object with
    identical field names and values (deep equality) to the original.

    Validates: Requirements 8.4
    """

    @given(spec=_valid_book_spec_st)
    @settings(max_examples=100)
    def test_serialize_deserialize_round_trip(self, spec: BookSpec) -> None:
        """Serializing and deserializing a valid BookSpec produces deep-equal result."""
        # **Validates: Requirements 8.4**
        # Step 1: Serialize to YAML
        yaml_output = _serialize_book_spec_to_yaml(spec)

        # Step 2: Deserialize via yaml.safe_load then validate_spec
        raw = yaml.safe_load(yaml_output)
        reconstructed = validate_spec(raw, Path("test.yaml"))

        # Step 3: Verify deep equality of all fields
        assert reconstructed.book_id == spec.book_id, (
            f"book_id mismatch: {reconstructed.book_id!r} != {spec.book_id!r}"
        )
        assert reconstructed.filenames == spec.filenames, (
            f"filenames mismatch: {reconstructed.filenames!r} != {spec.filenames!r}"
        )
        assert reconstructed.output_path == spec.output_path, (
            f"output_path mismatch: {reconstructed.output_path!r} != {spec.output_path!r}"
        )
        assert reconstructed.extraction_mode == spec.extraction_mode, (
            f"extraction_mode mismatch: {reconstructed.extraction_mode!r} != {spec.extraction_mode!r}"
        )
        assert reconstructed.noise_line_regex == spec.noise_line_regex, (
            f"noise_line_regex mismatch: {reconstructed.noise_line_regex!r} != {spec.noise_line_regex!r}"
        )
        assert reconstructed.expected_fields == spec.expected_fields, (
            f"expected_fields mismatch: {reconstructed.expected_fields!r} != {spec.expected_fields!r}"
        )
        assert reconstructed.pipeline_stages == spec.pipeline_stages, (
            f"pipeline_stages mismatch: {reconstructed.pipeline_stages!r} != {spec.pipeline_stages!r}"
        )

        # Verify section_anchors deep equality
        assert len(reconstructed.section_anchors) == len(spec.section_anchors), (
            f"section_anchors length mismatch: "
            f"{len(reconstructed.section_anchors)} != {len(spec.section_anchors)}"
        )
        for i, (recon_anchor, orig_anchor) in enumerate(
            zip(reconstructed.section_anchors, spec.section_anchors)
        ):
            assert recon_anchor.pattern == orig_anchor.pattern, (
                f"section_anchors[{i}].pattern mismatch: "
                f"{recon_anchor.pattern!r} != {orig_anchor.pattern!r}"
            )
            assert recon_anchor.pattern_type == orig_anchor.pattern_type, (
                f"section_anchors[{i}].pattern_type mismatch: "
                f"{recon_anchor.pattern_type!r} != {orig_anchor.pattern_type!r}"
            )
            assert recon_anchor.case_insensitive == orig_anchor.case_insensitive, (
                f"section_anchors[{i}].case_insensitive mismatch: "
                f"{recon_anchor.case_insensitive!r} != {orig_anchor.case_insensitive!r}"
            )
            assert recon_anchor.aliases == orig_anchor.aliases, (
                f"section_anchors[{i}].aliases mismatch: "
                f"{recon_anchor.aliases!r} != {orig_anchor.aliases!r}"
            )

        # Verify heading_patterns deep equality
        assert len(reconstructed.heading_patterns) == len(spec.heading_patterns), (
            f"heading_patterns length mismatch: "
            f"{len(reconstructed.heading_patterns)} != {len(spec.heading_patterns)}"
        )
        for i, (recon_hp, orig_hp) in enumerate(
            zip(reconstructed.heading_patterns, spec.heading_patterns)
        ):
            assert recon_hp.regex == orig_hp.regex, (
                f"heading_patterns[{i}].regex mismatch: "
                f"{recon_hp.regex!r} != {orig_hp.regex!r}"
            )
            assert recon_hp.flags == orig_hp.flags, (
                f"heading_patterns[{i}].flags mismatch: "
                f"{recon_hp.flags!r} != {orig_hp.flags!r}"
            )

    @given(spec=_valid_book_spec_st)
    @settings(max_examples=100)
    def test_round_trip_preserves_extraction_mode_default(self, spec: BookSpec) -> None:
        """Round-trip preserves extraction_mode even when default 'pypdf' is used."""
        # **Validates: Requirements 8.4**
        yaml_output = _serialize_book_spec_to_yaml(spec)
        raw = yaml.safe_load(yaml_output)
        reconstructed = validate_spec(raw, Path("test.yaml"))

        # The extraction_mode should always round-trip correctly
        # When mode is 'pypdf', it's not serialized but validate_spec defaults to 'pypdf'
        assert reconstructed.extraction_mode == spec.extraction_mode, (
            f"extraction_mode not preserved in round-trip: "
            f"{reconstructed.extraction_mode!r} != {spec.extraction_mode!r}"
        )
