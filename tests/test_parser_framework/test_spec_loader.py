"""Unit tests for parser_framework/spec_loader.py.

Validates Requirements 7.1, 7.2, 7.4:
- Extended Book Spec schema validation: categories, book_title, book_slug,
  per-category output_path, section_anchors, heading_pattern, expected_fields
- Structural errors with field-level detail before pipeline starts
- Backward compatibility with existing specs (legacy json_output_paths, top-level anchors)
"""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

import pytest
import yaml

# Ensure src/scripts is importable
_REPO_ROOT = Path(__file__).resolve().parents[2]
_SCRIPTS_DIR = _REPO_ROOT / "src" / "scripts"

if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from parser_framework.models import BookSpec, CategoryConfig, HeadingPattern, SectionAnchor
from parser_framework.spec_loader import SpecValidationError, load_specs, validate_spec


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_legacy_spec(book_id: str = "test_book") -> dict:
    """Return a minimal valid legacy spec dict (no categories)."""
    return {
        "book_id": book_id,
        "filenames": ["test.pdf"],
        "output_path": "src/data/_extracted/test.txt",
        "section_anchors": [{"pattern": "SECTION ONE", "pattern_type": "literal"}],
        "heading_patterns": [{"regex": "^[A-Z]+$"}],
        "expected_fields": ["name", "description"],
        "pipeline_stages": ["ingest", "extract"],
    }


def _make_extended_spec(book_id: str = "test_book") -> dict:
    """Return a minimal valid extended spec dict (with categories)."""
    return {
        "book_id": book_id,
        "filenames": ["test.pdf"],
        "output_path": "src/data/_extracted/test.txt",
        "book_title": "Test Book",
        "book_slug": "test_book",
        "pipeline_stages": ["ingest", "extract", "validate"],
        "categories": {
            "knacks": {
                "output_path": "src/data/knacks_test.json",
                "section_anchors": [
                    {"pattern": "Guardian Knacks", "pattern_type": "literal"}
                ],
                "heading_pattern": {
                    "regex": "^(?P<name>[A-Z][A-Za-z' ]+)$",
                    "flags": ["MULTILINE"],
                },
                "expected_fields": ["id", "name", "callings", "description"],
            }
        },
    }


def _validate(spec_dict: dict) -> BookSpec:
    """Shortcut to validate a spec dict with a dummy source file."""
    return validate_spec(spec_dict, Path("/tmp/test.yaml"))


# ---------------------------------------------------------------------------
# Legacy backward compatibility (Requirement 7.1, 7.4)
# ---------------------------------------------------------------------------


class TestLegacyBackwardCompatibility:
    """Existing specs with legacy json_output_paths and top-level anchors still load."""

    def test_legacy_spec_loads_successfully(self):
        """A legacy spec with top-level anchors loads without error."""
        spec = _validate(_make_legacy_spec())
        assert spec.book_id == "test_book"
        assert spec.categories is None
        assert len(spec.section_anchors) == 1
        assert len(spec.heading_patterns) == 1
        assert spec.expected_fields == ["name", "description"]

    def test_legacy_spec_with_json_output_paths(self):
        """A legacy spec with json_output_paths loads correctly."""
        raw = _make_legacy_spec()
        raw["json_output_paths"] = {
            "boons": "src/data/boons_test.json",
            "purviews": "src/data/purviews_test.json",
        }
        spec = _validate(raw)
        assert spec.json_output_paths == {
            "boons": "src/data/boons_test.json",
            "purviews": "src/data/purviews_test.json",
        }

    def test_legacy_spec_without_categories_requires_top_level_anchors(self):
        """A spec without categories must have section_anchors."""
        raw = _make_legacy_spec()
        del raw["section_anchors"]
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "section_anchors" in exc_info.value.field

    def test_legacy_spec_without_categories_requires_heading_patterns(self):
        """A spec without categories must have heading_patterns."""
        raw = _make_legacy_spec()
        del raw["heading_patterns"]
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "heading_patterns" in exc_info.value.field

    def test_legacy_spec_without_categories_requires_expected_fields(self):
        """A spec without categories must have expected_fields."""
        raw = _make_legacy_spec()
        del raw["expected_fields"]
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "expected_fields" in exc_info.value.field

    def test_existing_book_specs_load_without_error(self):
        """All real book specs in src/scripts/book_specs/ load successfully."""
        specs_dir = _REPO_ROOT / "src" / "scripts" / "book_specs"
        if not specs_dir.is_dir():
            pytest.skip("book_specs directory not found")
        specs = load_specs(specs_dir)
        assert len(specs) >= 1, "Expected at least one book spec to load"


# ---------------------------------------------------------------------------
# Extended spec schema validation (Requirement 7.2)
# ---------------------------------------------------------------------------


class TestExtendedSpecValidation:
    """Extended Book Spec schema fields are validated correctly."""

    def test_extended_spec_loads_successfully(self):
        """An extended spec with categories loads without error."""
        spec = _validate(_make_extended_spec())
        assert spec.book_id == "test_book"
        assert spec.book_title == "Test Book"
        assert spec.book_slug == "test_book"
        assert spec.categories is not None
        assert "knacks" in spec.categories

    def test_categories_dict_is_validated(self):
        """The categories field must be a dict if present."""
        raw = _make_extended_spec()
        raw["categories"] = "not_a_dict"
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "categories" in exc_info.value.field

    def test_categories_must_be_non_empty(self):
        """The categories dict must not be empty."""
        raw = _make_extended_spec()
        raw["categories"] = {}
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "categories" in exc_info.value.field
        assert "at least one" in exc_info.value.reason

    def test_invalid_category_name_rejected(self):
        """Unknown category names are rejected."""
        raw = _make_extended_spec()
        raw["categories"]["unknown_category"] = {
            "output_path": "src/data/unknown.json"
        }
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "unknown_category" in exc_info.value.field

    def test_all_valid_category_names_accepted(self):
        """All Game_Data_Category names are accepted."""
        valid_names = [
            "knacks", "boons", "purviews", "callings",
            "birthrights", "equipment", "paths", "pantheons", "book_slices",
        ]
        raw = _make_extended_spec()
        raw["categories"] = {
            name: {"output_path": f"src/data/{name}.json"}
            for name in valid_names
        }
        spec = _validate(raw)
        assert set(spec.categories.keys()) == set(valid_names)

    def test_book_title_must_be_non_empty_string(self):
        """book_title must be a non-empty string if provided."""
        raw = _make_extended_spec()
        raw["book_title"] = ""
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "book_title" in exc_info.value.field

    def test_book_title_rejects_non_string(self):
        """book_title must be a string."""
        raw = _make_extended_spec()
        raw["book_title"] = 42
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "book_title" in exc_info.value.field

    def test_book_slug_format_validation(self):
        """book_slug must be alphanumeric + underscores, 1-64 chars."""
        raw = _make_extended_spec()
        raw["book_slug"] = "has-dashes"
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "book_slug" in exc_info.value.field

    def test_book_slug_rejects_too_long(self):
        """book_slug rejects strings longer than 64 characters."""
        raw = _make_extended_spec()
        raw["book_slug"] = "a" * 65
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "book_slug" in exc_info.value.field

    def test_book_slug_optional(self):
        """book_slug is optional (spec loads without it)."""
        raw = _make_extended_spec()
        del raw["book_slug"]
        spec = _validate(raw)
        assert spec.book_slug is None

    def test_book_title_optional(self):
        """book_title is optional (spec loads without it)."""
        raw = _make_extended_spec()
        del raw["book_title"]
        spec = _validate(raw)
        assert spec.book_title is None


# ---------------------------------------------------------------------------
# Per-category config validation (Requirement 7.2)
# ---------------------------------------------------------------------------


class TestCategoryConfigValidation:
    """Per-category extraction config fields are validated correctly."""

    def test_output_path_required_for_each_category(self):
        """Each category must have an output_path."""
        raw = _make_extended_spec()
        del raw["categories"]["knacks"]["output_path"]
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "categories.knacks.output_path" in exc_info.value.field

    def test_output_path_must_be_non_empty_string(self):
        """Category output_path must be a non-empty string."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"]["output_path"] = ""
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "categories.knacks.output_path" in exc_info.value.field

    def test_output_path_rejects_non_string(self):
        """Category output_path must be a string."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"]["output_path"] = 123
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "categories.knacks.output_path" in exc_info.value.field

    def test_section_anchors_must_be_list(self):
        """Category section_anchors must be a list."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"]["section_anchors"] = "not_a_list"
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "section_anchors" in exc_info.value.field

    def test_section_anchors_validates_each_entry(self):
        """Each section anchor must have a pattern field."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"]["section_anchors"] = [
            {"pattern_type": "literal"}  # missing 'pattern'
        ]
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "pattern" in exc_info.value.field

    def test_section_anchors_rejects_invalid_pattern_type(self):
        """Section anchor rejects invalid pattern_type values."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"]["section_anchors"] = [
            {"pattern": "Test", "pattern_type": "invalid"}
        ]
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "pattern_type" in exc_info.value.field

    def test_heading_pattern_must_be_dict(self):
        """Category heading_pattern must be a mapping."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"]["heading_pattern"] = "not_a_dict"
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "heading_pattern" in exc_info.value.field

    def test_heading_pattern_requires_regex(self):
        """heading_pattern must contain a regex field."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"]["heading_pattern"] = {"flags": ["MULTILINE"]}
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "regex" in exc_info.value.field

    def test_heading_pattern_regex_must_be_non_empty(self):
        """heading_pattern.regex must be a non-empty string."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"]["heading_pattern"] = {"regex": ""}
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "regex" in exc_info.value.field

    def test_heading_pattern_flags_must_be_list(self):
        """heading_pattern.flags must be a list if provided."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"]["heading_pattern"] = {
            "regex": "^[A-Z]+$",
            "flags": "MULTILINE",  # should be a list
        }
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "flags" in exc_info.value.field

    def test_expected_fields_must_be_list(self):
        """Category expected_fields must be a list."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"]["expected_fields"] = "not_a_list"
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "expected_fields" in exc_info.value.field

    def test_expected_fields_entries_must_be_strings(self):
        """Each entry in expected_fields must be a string."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"]["expected_fields"] = ["id", 42, "name"]
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "expected_fields" in exc_info.value.field

    def test_calling_map_must_be_dict(self):
        """calling_map must be a dict if present."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"]["calling_map"] = "not_a_dict"
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "calling_map" in exc_info.value.field

    def test_calling_map_values_must_be_strings(self):
        """calling_map values must be strings."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"]["calling_map"] = {"Guardian Knacks": 42}
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "calling_map" in exc_info.value.field

    def test_dot_symbol_must_be_string(self):
        """dot_symbol must be a string if present."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"]["dot_symbol"] = 123
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "dot_symbol" in exc_info.value.field

    def test_stat_block_pattern_must_be_string(self):
        """stat_block_pattern must be a string if present."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"]["stat_block_pattern"] = []
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "stat_block_pattern" in exc_info.value.field

    def test_tag_pattern_must_be_string(self):
        """tag_pattern must be a string if present."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"]["tag_pattern"] = False
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "tag_pattern" in exc_info.value.field

    def test_category_config_values_stored_correctly(self):
        """Valid category config values are stored on the CategoryConfig."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"]["calling_map"] = {"Guardian Knacks": "guardian"}
        raw["categories"]["knacks"]["dot_symbol"] = "●"
        spec = _validate(raw)

        knacks = spec.categories["knacks"]
        assert knacks.output_path == "src/data/knacks_test.json"
        assert len(knacks.section_anchors) == 1
        assert knacks.section_anchors[0].pattern == "Guardian Knacks"
        assert knacks.heading_pattern is not None
        assert knacks.heading_pattern.regex == "^(?P<name>[A-Z][A-Za-z' ]+)$"
        assert knacks.heading_pattern.flags == ["MULTILINE"]
        assert knacks.expected_fields == ["id", "name", "callings", "description"]
        assert knacks.calling_map == {"Guardian Knacks": "guardian"}
        assert knacks.dot_symbol == "●"

    def test_category_config_not_dict_rejected(self):
        """A category value that isn't a dict is rejected."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"] = "not_a_dict"
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "categories.knacks" in exc_info.value.field

    def test_multiple_categories_validated(self):
        """Multiple categories in one spec are all validated."""
        raw = _make_extended_spec()
        raw["categories"]["boons"] = {
            "output_path": "src/data/boons_test.json",
            "section_anchors": [
                {"pattern": "^(?P<purview>[A-Z][a-z]+)\\s+Boons$", "pattern_type": "regex"}
            ],
            "heading_pattern": {
                "regex": "^(?P<name>.+?)\\s*(?P<dots>[●]+)$",
                "flags": ["MULTILINE"],
            },
            "expected_fields": ["id", "name", "purview", "dot"],
            "dot_symbol": "●",
        }
        spec = _validate(raw)
        assert "knacks" in spec.categories
        assert "boons" in spec.categories
        assert spec.categories["boons"].dot_symbol == "●"


# ---------------------------------------------------------------------------
# Error reporting detail (Requirement 7.4)
# ---------------------------------------------------------------------------


class TestErrorReportingDetail:
    """Structural errors reported with field-level detail before pipeline starts."""

    def test_error_includes_source_file_path(self):
        """SpecValidationError includes the source file path."""
        raw = _make_legacy_spec()
        del raw["book_id"]
        source = Path("/project/specs/my_spec.yaml")
        with pytest.raises(SpecValidationError) as exc_info:
            validate_spec(raw, source)
        assert exc_info.value.source_file == source
        assert "/project/specs/my_spec.yaml" in str(exc_info.value)

    def test_error_includes_field_name(self):
        """SpecValidationError includes the specific failing field."""
        raw = _make_legacy_spec()
        raw["book_id"] = "has-dashes"
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert exc_info.value.field == "book_id"

    def test_error_includes_reason(self):
        """SpecValidationError includes a human-readable reason."""
        raw = _make_legacy_spec()
        raw["pipeline_stages"] = ["invalid_stage"]
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "invalid stage" in exc_info.value.reason.lower() or "invalid" in exc_info.value.reason.lower()

    def test_nested_field_errors_include_full_path(self):
        """Errors in nested fields include the full field path."""
        raw = _make_extended_spec()
        raw["categories"]["knacks"]["section_anchors"] = [
            {"pattern": "", "pattern_type": "literal"}
        ]
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        # Should reference something like "categories.knacks.section_anchors[0].pattern"
        assert "categories.knacks" in exc_info.value.field

    def test_duplicate_book_id_error_reports_both_files(self):
        """Duplicate book_id error mentions the original file."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            spec1 = _make_legacy_spec(book_id="duplicate")
            spec2 = _make_legacy_spec(book_id="duplicate")

            (tmp_path / "first.yaml").write_text(yaml.dump(spec1), encoding="utf-8")
            (tmp_path / "second.yaml").write_text(yaml.dump(spec2), encoding="utf-8")

            with pytest.raises(SpecValidationError) as exc_info:
                load_specs(tmp_path)
            assert "duplicate" in str(exc_info.value)
            assert "book_id" in exc_info.value.field


# ---------------------------------------------------------------------------
# Required field validation (Requirement 7.2)
# ---------------------------------------------------------------------------


class TestRequiredFieldValidation:
    """Required fields are enforced and type-checked."""

    @pytest.mark.parametrize("field", ["book_id", "filenames", "output_path", "pipeline_stages"])
    def test_missing_required_field_rejected(self, field: str):
        """Missing required fields are rejected with specific field name."""
        raw = _make_legacy_spec()
        del raw[field]
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert field in exc_info.value.field

    def test_book_id_wrong_type_rejected(self):
        """Non-string book_id is rejected."""
        raw = _make_legacy_spec()
        raw["book_id"] = 123
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "book_id" in exc_info.value.field

    def test_filenames_not_list_rejected(self):
        """filenames must be a list."""
        raw = _make_legacy_spec()
        raw["filenames"] = "single_file.pdf"
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "filenames" in exc_info.value.field

    def test_filenames_empty_list_rejected(self):
        """filenames must not be empty."""
        raw = _make_legacy_spec()
        raw["filenames"] = []
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "filenames" in exc_info.value.field

    def test_filenames_empty_string_entry_rejected(self):
        """filenames entries must be non-empty strings."""
        raw = _make_legacy_spec()
        raw["filenames"] = ["valid.pdf", ""]
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "filenames" in exc_info.value.field

    def test_output_path_empty_string_rejected(self):
        """output_path must be a non-empty string."""
        raw = _make_legacy_spec()
        raw["output_path"] = ""
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "output_path" in exc_info.value.field

    def test_pipeline_stages_empty_list_rejected(self):
        """pipeline_stages must not be empty."""
        raw = _make_legacy_spec()
        raw["pipeline_stages"] = []
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "pipeline_stages" in exc_info.value.field

    def test_pipeline_stages_invalid_value_rejected(self):
        """pipeline_stages must only contain valid stage names."""
        raw = _make_legacy_spec()
        raw["pipeline_stages"] = ["ingest", "not_a_stage"]
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "pipeline_stages" in exc_info.value.field

    def test_extraction_mode_invalid_rejected(self):
        """extraction_mode must be 'pypdf' or 'pymupdf'."""
        raw = _make_legacy_spec()
        raw["extraction_mode"] = "custom_mode"
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "extraction_mode" in exc_info.value.field

    def test_noise_line_regex_non_string_rejected(self):
        """noise_line_regex must be a string if provided."""
        raw = _make_legacy_spec()
        raw["noise_line_regex"] = 42
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "noise_line_regex" in exc_info.value.field

    def test_json_output_paths_non_dict_rejected(self):
        """json_output_paths must be a dict if provided."""
        raw = _make_legacy_spec()
        raw["json_output_paths"] = ["not", "a", "dict"]
        with pytest.raises(SpecValidationError) as exc_info:
            _validate(raw)
        assert "json_output_paths" in exc_info.value.field


# ---------------------------------------------------------------------------
# Extended spec + legacy coexistence (Requirement 7.1)
# ---------------------------------------------------------------------------


class TestExtendedLegacyCoexistence:
    """Extended specs can coexist with legacy top-level anchors/patterns."""

    def test_extended_spec_with_legacy_anchors(self):
        """Extended spec can still have top-level section_anchors for framework compat."""
        raw = _make_extended_spec()
        raw["section_anchors"] = [{"pattern": "LEGACY", "pattern_type": "literal"}]
        raw["heading_patterns"] = [{"regex": "^LEGACY$"}]
        raw["expected_fields"] = ["legacy_field"]
        spec = _validate(raw)
        # Both categories and legacy fields are present
        assert spec.categories is not None
        assert len(spec.section_anchors) == 1
        assert spec.section_anchors[0].pattern == "LEGACY"

    def test_extended_spec_without_legacy_fields(self):
        """Extended spec loads without top-level anchors/patterns (not required)."""
        raw = _make_extended_spec()
        assert "section_anchors" not in raw
        assert "heading_patterns" not in raw
        assert "expected_fields" not in raw
        spec = _validate(raw)
        assert spec.section_anchors == []
        assert spec.heading_patterns == []
        assert spec.expected_fields == []


# ---------------------------------------------------------------------------
# File parsing (JSON and YAML support)
# ---------------------------------------------------------------------------


class TestFileFormats:
    """Spec files can be YAML (.yaml, .yml) or JSON (.json)."""

    def test_yaml_file_loads(self):
        """A .yaml spec file loads correctly."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            spec = _make_legacy_spec(book_id="yaml_test")
            (tmp_path / "test.yaml").write_text(yaml.dump(spec), encoding="utf-8")
            specs = load_specs(tmp_path)
            assert len(specs) == 1
            assert specs[0].book_id == "yaml_test"

    def test_yml_file_loads(self):
        """A .yml spec file loads correctly."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            spec = _make_legacy_spec(book_id="yml_test")
            (tmp_path / "test.yml").write_text(yaml.dump(spec), encoding="utf-8")
            specs = load_specs(tmp_path)
            assert len(specs) == 1
            assert specs[0].book_id == "yml_test"

    def test_json_file_loads(self):
        """A .json spec file loads correctly."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            spec = _make_legacy_spec(book_id="json_test")
            (tmp_path / "test.json").write_text(json.dumps(spec), encoding="utf-8")
            specs = load_specs(tmp_path)
            assert len(specs) == 1
            assert specs[0].book_id == "json_test"

    def test_invalid_yaml_raises_error(self):
        """Malformed YAML raises SpecValidationError."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            (tmp_path / "bad.yaml").write_text("{ invalid yaml: [", encoding="utf-8")
            with pytest.raises(SpecValidationError) as exc_info:
                load_specs(tmp_path)
            assert "<file>" in exc_info.value.field

    def test_non_mapping_yaml_raises_error(self):
        """YAML that is not a mapping raises SpecValidationError."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            (tmp_path / "list.yaml").write_text("- item1\n- item2\n", encoding="utf-8")
            with pytest.raises(SpecValidationError) as exc_info:
                load_specs(tmp_path)
            assert "<file>" in exc_info.value.field
