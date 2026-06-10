"""Property-based tests for spec validation correctness.

# Feature: unified-pdf-extractor, Property 8: Spec Validation Correctness

For any YAML document, the spec validator SHALL accept it if and only if it
contains all required fields (`book_id`, `filenames`, `output_path`,
`pipeline_stages`) with correct types. Documents missing required fields or
with wrong types SHALL be rejected with an error identifying the invalid field.

**Validates: Requirements 7.2, 7.4**
"""

from __future__ import annotations

from pathlib import Path

from hypothesis import given, settings, assume
from hypothesis import strategies as st

from parser_framework.spec_loader import validate_spec, SpecValidationError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DUMMY_SOURCE = Path("/tmp/test_spec.yaml")

_REQUIRED_FIELDS = ["book_id", "filenames", "output_path", "pipeline_stages"]

_VALID_PIPELINE_STAGES = ["ingest", "extract", "validate"]


def _make_valid_spec_dict(
    book_id: str = "test_book",
    filenames: list[str] | None = None,
    output_path: str = "src/data/_extracted/test.txt",
    pipeline_stages: list[str] | None = None,
) -> dict:
    """Build a minimal valid spec dict that passes validation.

    Extended specs need either categories or legacy top-level anchors.
    We use legacy anchors for simplicity.
    """
    return {
        "book_id": book_id,
        "filenames": filenames or ["Test_Book.pdf"],
        "output_path": output_path,
        "pipeline_stages": pipeline_stages or ["ingest", "extract"],
        "section_anchors": [{"pattern": "Test Section", "pattern_type": "literal"}],
        "heading_patterns": [{"regex": "^(?P<name>.+)$", "flags": ["MULTILINE"]}],
        "expected_fields": ["id", "name"],
    }


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Strategy: valid book_id (alphanumeric + underscores, 1-64 chars)
_valid_book_id = st.from_regex(r"[a-zA-Z][a-zA-Z0-9_]{0,30}", fullmatch=True)

# Strategy: valid PDF filenames (non-empty strings)
_valid_filename = st.from_regex(r"[A-Z][A-Za-z0-9_]{2,20}\.pdf", fullmatch=True)
_valid_filenames = st.lists(_valid_filename, min_size=1, max_size=3)

# Strategy: valid output paths (non-empty strings)
_valid_output_path = st.from_regex(r"src/data/[a-z_/]{3,30}\.txt", fullmatch=True)

# Strategy: valid pipeline stages (non-empty subset of valid stages)
_valid_pipeline_stages = st.lists(
    st.sampled_from(_VALID_PIPELINE_STAGES),
    min_size=1,
    max_size=3,
    unique=True,
)

# Strategy: values that are NOT valid strings (wrong types for string fields)
_non_string_values = st.one_of(
    st.integers(),
    st.floats(allow_nan=False),
    st.booleans(),
    st.lists(st.integers(), max_size=3),
    st.dictionaries(st.text(max_size=3), st.integers(), max_size=2),
    st.none(),
)

# Strategy: values that are NOT valid lists (wrong types for list fields)
_non_list_values = st.one_of(
    st.integers(),
    st.floats(allow_nan=False),
    st.booleans(),
    st.text(min_size=1, max_size=10),
    st.none(),
)


@st.composite
def valid_spec_dict(draw):
    """Generate a fully valid spec dict that should pass validation."""
    book_id = draw(_valid_book_id)
    filenames = draw(_valid_filenames)
    output_path = draw(_valid_output_path)
    pipeline_stages = draw(_valid_pipeline_stages)

    return {
        "book_id": book_id,
        "filenames": filenames,
        "output_path": output_path,
        "pipeline_stages": pipeline_stages,
        "section_anchors": [{"pattern": "Test Section", "pattern_type": "literal"}],
        "heading_patterns": [{"regex": "^(?P<name>.+)$", "flags": ["MULTILINE"]}],
        "expected_fields": ["id", "name"],
    }


@st.composite
def spec_missing_one_required_field(draw):
    """Generate a spec dict that is missing exactly one required field."""
    spec = draw(valid_spec_dict())
    field_to_remove = draw(st.sampled_from(_REQUIRED_FIELDS))
    del spec[field_to_remove]
    return spec, field_to_remove


@st.composite
def spec_with_wrong_type_book_id(draw):
    """Generate a spec dict where book_id has a wrong type (not a valid string)."""
    spec = draw(valid_spec_dict())
    wrong_value = draw(_non_string_values)
    spec["book_id"] = wrong_value
    return spec


@st.composite
def spec_with_wrong_type_filenames(draw):
    """Generate a spec dict where filenames has a wrong type (not a list)."""
    spec = draw(valid_spec_dict())
    wrong_value = draw(_non_list_values)
    spec["filenames"] = wrong_value
    return spec


@st.composite
def spec_with_wrong_type_output_path(draw):
    """Generate a spec dict where output_path has a wrong type (not a string)."""
    spec = draw(valid_spec_dict())
    wrong_value = draw(_non_string_values)
    spec["output_path"] = wrong_value
    return spec


@st.composite
def spec_with_wrong_type_pipeline_stages(draw):
    """Generate a spec dict where pipeline_stages has a wrong type (not a list)."""
    spec = draw(valid_spec_dict())
    wrong_value = draw(_non_list_values)
    spec["pipeline_stages"] = wrong_value
    return spec


# ---------------------------------------------------------------------------
# Feature: unified-pdf-extractor, Property 8: Spec Validation Correctness
# ---------------------------------------------------------------------------


class TestSpecValidationCorrectness:
    """Property 8: Spec Validation Correctness.

    For any YAML document, the spec validator SHALL accept it if and only if it
    contains all required fields (`book_id`, `filenames`, `output_path`,
    `pipeline_stages`) with correct types. Documents missing required fields or
    with wrong types SHALL be rejected with an error identifying the invalid field.

    **Validates: Requirements 7.2, 7.4**
    """

    @given(spec=valid_spec_dict())
    @settings(max_examples=100)
    def test_valid_specs_are_accepted(self, spec: dict) -> None:
        """A spec with all required fields and correct types SHALL be accepted."""
        # **Validates: Requirements 7.2, 7.4**
        result = validate_spec(spec, _DUMMY_SOURCE)
        assert result is not None
        assert result.book_id == spec["book_id"]
        assert result.filenames == spec["filenames"]
        assert result.output_path == spec["output_path"]
        assert result.pipeline_stages == spec["pipeline_stages"]

    @given(data=spec_missing_one_required_field())
    @settings(max_examples=100)
    def test_missing_required_field_is_rejected(self, data: tuple) -> None:
        """A spec missing any required field SHALL be rejected with an error
        identifying the missing field."""
        # **Validates: Requirements 7.2, 7.4**
        spec, missing_field = data
        try:
            validate_spec(spec, _DUMMY_SOURCE)
            assert False, (
                f"Expected SpecValidationError for missing field '{missing_field}', "
                f"but validation passed.\nSpec: {spec}"
            )
        except SpecValidationError as e:
            # The error should identify the invalid/missing field
            assert missing_field in e.field or missing_field in str(e), (
                f"Error should reference the missing field '{missing_field}'.\n"
                f"Got field: {e.field!r}\n"
                f"Got message: {str(e)}"
            )

    @given(spec=spec_with_wrong_type_book_id())
    @settings(max_examples=100)
    def test_wrong_type_book_id_is_rejected(self, spec: dict) -> None:
        """A spec where book_id is not a valid string SHALL be rejected."""
        # **Validates: Requirements 7.2, 7.4**
        try:
            validate_spec(spec, _DUMMY_SOURCE)
            assert False, (
                f"Expected SpecValidationError for wrong type book_id={spec['book_id']!r}, "
                f"but validation passed."
            )
        except SpecValidationError as e:
            assert "book_id" in e.field, (
                f"Error should reference 'book_id' field.\n"
                f"Got field: {e.field!r}\n"
                f"Got message: {str(e)}"
            )

    @given(spec=spec_with_wrong_type_filenames())
    @settings(max_examples=100)
    def test_wrong_type_filenames_is_rejected(self, spec: dict) -> None:
        """A spec where filenames is not a list SHALL be rejected."""
        # **Validates: Requirements 7.2, 7.4**
        try:
            validate_spec(spec, _DUMMY_SOURCE)
            assert False, (
                f"Expected SpecValidationError for wrong type filenames={spec['filenames']!r}, "
                f"but validation passed."
            )
        except SpecValidationError as e:
            assert "filenames" in e.field, (
                f"Error should reference 'filenames' field.\n"
                f"Got field: {e.field!r}\n"
                f"Got message: {str(e)}"
            )

    @given(spec=spec_with_wrong_type_output_path())
    @settings(max_examples=100)
    def test_wrong_type_output_path_is_rejected(self, spec: dict) -> None:
        """A spec where output_path is not a valid string SHALL be rejected."""
        # **Validates: Requirements 7.2, 7.4**
        try:
            validate_spec(spec, _DUMMY_SOURCE)
            assert False, (
                f"Expected SpecValidationError for wrong type output_path={spec['output_path']!r}, "
                f"but validation passed."
            )
        except SpecValidationError as e:
            assert "output_path" in e.field, (
                f"Error should reference 'output_path' field.\n"
                f"Got field: {e.field!r}\n"
                f"Got message: {str(e)}"
            )

    @given(spec=spec_with_wrong_type_pipeline_stages())
    @settings(max_examples=100)
    def test_wrong_type_pipeline_stages_is_rejected(self, spec: dict) -> None:
        """A spec where pipeline_stages is not a list SHALL be rejected."""
        # **Validates: Requirements 7.2, 7.4**
        try:
            validate_spec(spec, _DUMMY_SOURCE)
            assert False, (
                f"Expected SpecValidationError for wrong type pipeline_stages={spec['pipeline_stages']!r}, "
                f"but validation passed."
            )
        except SpecValidationError as e:
            assert "pipeline_stages" in e.field, (
                f"Error should reference 'pipeline_stages' field.\n"
                f"Got field: {e.field!r}\n"
                f"Got message: {str(e)}"
            )
