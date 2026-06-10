"""Unit tests for the book slice extractor.

Tests the BookSliceExtractor which assembles per-book bundle slices from
pre-extracted category results. Validates:
- _meta block structure with correct slug, title, sourcePdf, kind, note
- Inclusion of all bundleable categories that have entries
- Exclusion of empty categories from the slice
- Handling of CategoryResult objects and raw dicts
- Graceful handling when no category results are provided
- Config validation (output_path, kind, slug placeholder)
"""

from __future__ import annotations

import pytest

from extractors.base import CategoryResult, LogEntry
from extractors.book_slice_extractor import (
    BookSliceExtractor,
    _BUNDLEABLE_CATEGORIES,
    _DEFAULT_KIND,
    _META_NOTE,
    _VALID_KINDS,
)
from parser_framework.models import BookSpec


def _make_spec(
    book_id: str = "divine_armory",
    filenames: list[str] | None = None,
    book_title: str | None = "Divine Armory",
    book_slug: str | None = "divine_armory",
) -> BookSpec:
    """Create a minimal BookSpec for testing."""
    return BookSpec(
        book_id=book_id,
        filenames=filenames or ["7711-Divine_Armory.pdf"],
        output_path="src/data/_extracted/divine_armory.txt",
        section_anchors=[],
        heading_patterns=[],
        expected_fields=[],
        pipeline_stages=["ingest", "extract", "validate"],
        book_title=book_title,
        book_slug=book_slug,
    )


class TestBookSliceExtractorExtract:
    """Tests for the extract method."""

    def test_produces_meta_block_with_correct_fields(self):
        extractor = BookSliceExtractor()
        spec = _make_spec()
        config = {
            "output_path": "src/data/books/{slug}.json",
            "kind": "storypath_nexus",
            "_category_results": {},
        }

        result = extractor.extract("", spec, config)

        meta = result.entries["_meta"]
        assert meta["slug"] == "divine_armory"
        assert meta["title"] == "Divine Armory"
        assert meta["sourcePdf"] == "7711-Divine_Armory.pdf"
        assert meta["kind"] == "storypath_nexus"
        assert meta["note"] == _META_NOTE

    def test_uses_book_id_as_slug_fallback(self):
        extractor = BookSliceExtractor()
        spec = _make_spec(book_slug=None)
        config = {
            "output_path": "src/data/books/{slug}.json",
            "_category_results": {},
        }

        result = extractor.extract("", spec, config)
        assert result.entries["_meta"]["slug"] == "divine_armory"

    def test_uses_slug_as_title_fallback(self):
        extractor = BookSliceExtractor()
        spec = _make_spec(book_title=None, book_slug="divine_armory")
        config = {
            "output_path": "src/data/books/{slug}.json",
            "_category_results": {},
        }

        result = extractor.extract("", spec, config)
        assert result.entries["_meta"]["title"] == "Divine Armory"

    def test_defaults_kind_to_supplement(self):
        extractor = BookSliceExtractor()
        spec = _make_spec()
        config = {
            "output_path": "src/data/books/{slug}.json",
            "_category_results": {},
        }

        result = extractor.extract("", spec, config)
        assert result.entries["_meta"]["kind"] == _DEFAULT_KIND

    def test_includes_categories_with_entries(self):
        extractor = BookSliceExtractor()
        spec = _make_spec()
        equipment_entries = {
            "eqSword": {"id": "eqSword", "name": "Sword"},
            "eqShield": {"id": "eqShield", "name": "Shield"},
        }
        knack_entries = {
            "bravery": {"id": "bravery", "name": "Bravery"},
        }
        config = {
            "output_path": "src/data/books/{slug}.json",
            "kind": "storypath_nexus",
            "_category_results": {
                "equipment": CategoryResult(
                    category="equipment",
                    entries=equipment_entries,
                    entry_count=2,
                ),
                "knacks": CategoryResult(
                    category="knacks",
                    entries=knack_entries,
                    entry_count=1,
                ),
            },
        }

        result = extractor.extract("", spec, config)

        assert "equipment" in result.entries
        assert result.entries["equipment"] == equipment_entries
        assert "knacks" in result.entries
        assert result.entries["knacks"] == knack_entries
        assert result.entry_count == 2  # 2 categories included

    def test_excludes_empty_categories(self):
        extractor = BookSliceExtractor()
        spec = _make_spec()
        config = {
            "output_path": "src/data/books/{slug}.json",
            "kind": "storypath_nexus",
            "_category_results": {
                "equipment": CategoryResult(
                    category="equipment",
                    entries={"eq1": {"id": "eq1"}},
                    entry_count=1,
                ),
                "boons": CategoryResult(
                    category="boons",
                    entries={},
                    entry_count=0,
                ),
            },
        }

        result = extractor.extract("", spec, config)

        assert "equipment" in result.entries
        assert "boons" not in result.entries

    def test_accepts_raw_dict_results(self):
        extractor = BookSliceExtractor()
        spec = _make_spec()
        config = {
            "output_path": "src/data/books/{slug}.json",
            "kind": "storypath_nexus",
            "_category_results": {
                "birthrights": {"relic1": {"id": "relic1", "name": "Mjolnir"}},
            },
        }

        result = extractor.extract("", spec, config)

        assert "birthrights" in result.entries
        assert result.entries["birthrights"]["relic1"]["name"] == "Mjolnir"

    def test_excludes_non_bundleable_categories(self):
        extractor = BookSliceExtractor()
        spec = _make_spec()
        config = {
            "output_path": "src/data/books/{slug}.json",
            "_category_results": {
                "book_slices": {"nested": "data"},
                "equipment": {"eq1": {"id": "eq1"}},
            },
        }

        result = extractor.extract("", spec, config)

        assert "book_slices" not in result.entries
        assert "equipment" in result.entries

    def test_no_category_results_produces_meta_only(self):
        extractor = BookSliceExtractor()
        spec = _make_spec()
        config = {
            "output_path": "src/data/books/{slug}.json",
        }

        result = extractor.extract("", spec, config)

        assert "_meta" in result.entries
        assert result.entry_count == 0
        # Should log a warning about missing results
        assert any(log.reason == "not_found" for log in result.log)

    def test_invalid_kind_falls_back_to_default(self):
        extractor = BookSliceExtractor()
        spec = _make_spec()
        config = {
            "output_path": "src/data/books/{slug}.json",
            "kind": "invalid_kind",
            "_category_results": {},
        }

        result = extractor.extract("", spec, config)

        assert result.entries["_meta"]["kind"] == _DEFAULT_KIND
        assert any(log.reason == "validation_warning" for log in result.log)

    def test_category_is_book_slices(self):
        extractor = BookSliceExtractor()
        spec = _make_spec()
        config = {
            "output_path": "src/data/books/{slug}.json",
            "_category_results": {},
        }

        result = extractor.extract("", spec, config)
        assert result.category == "book_slices"

    def test_all_valid_kinds_accepted(self):
        extractor = BookSliceExtractor()
        spec = _make_spec()

        for kind in _VALID_KINDS:
            config = {
                "output_path": "src/data/books/{slug}.json",
                "kind": kind,
                "_category_results": {},
            }
            result = extractor.extract("", spec, config)
            assert result.entries["_meta"]["kind"] == kind
            assert not any(log.reason == "validation_warning" for log in result.log)

    def test_categories_sorted_in_output(self):
        extractor = BookSliceExtractor()
        spec = _make_spec()
        config = {
            "output_path": "src/data/books/{slug}.json",
            "_category_results": {
                "paths": {"p1": {"id": "p1"}},
                "boons": {"b1": {"id": "b1"}},
                "equipment": {"e1": {"id": "e1"}},
            },
        }

        result = extractor.extract("", spec, config)

        # Get keys that are not _meta
        category_keys = [k for k in result.entries.keys() if k != "_meta"]
        assert category_keys == sorted(category_keys)

    def test_handles_unexpected_result_type(self):
        extractor = BookSliceExtractor()
        spec = _make_spec()
        config = {
            "output_path": "src/data/books/{slug}.json",
            "_category_results": {
                "equipment": "not_a_dict_or_result",
            },
        }

        result = extractor.extract("", spec, config)

        assert "equipment" not in result.entries
        assert any(log.reason == "parse_error" for log in result.log)


class TestBookSliceExtractorValidateConfig:
    """Tests for the validate_config method."""

    def test_valid_config_returns_no_errors(self):
        extractor = BookSliceExtractor()
        config = {
            "output_path": "src/data/books/{slug}.json",
            "kind": "storypath_nexus",
        }

        errors = extractor.validate_config(config)
        assert errors == []

    def test_missing_output_path_reports_error(self):
        extractor = BookSliceExtractor()
        config = {"kind": "supplement"}

        errors = extractor.validate_config(config)
        assert len(errors) == 1
        assert "output_path" in errors[0]

    def test_non_string_output_path_reports_error(self):
        extractor = BookSliceExtractor()
        config = {"output_path": 123}

        errors = extractor.validate_config(config)
        assert len(errors) == 1
        assert "string" in errors[0]

    def test_output_path_without_slug_placeholder_reports_error(self):
        extractor = BookSliceExtractor()
        config = {"output_path": "src/data/books/fixed_name.json"}

        errors = extractor.validate_config(config)
        assert len(errors) == 1
        assert "{slug}" in errors[0]

    def test_invalid_kind_reports_error(self):
        extractor = BookSliceExtractor()
        config = {
            "output_path": "src/data/books/{slug}.json",
            "kind": "invalid_value",
        }

        errors = extractor.validate_config(config)
        assert len(errors) == 1
        assert "kind" in errors[0]

    def test_no_kind_is_valid(self):
        extractor = BookSliceExtractor()
        config = {
            "output_path": "src/data/books/{slug}.json",
        }

        errors = extractor.validate_config(config)
        assert errors == []

    def test_all_valid_kinds_pass_validation(self):
        extractor = BookSliceExtractor()
        for kind in _VALID_KINDS:
            config = {
                "output_path": "src/data/books/{slug}.json",
                "kind": kind,
            }
            errors = extractor.validate_config(config)
            assert errors == [], f"Kind '{kind}' should be valid but got: {errors}"


class TestBookSliceExtractorRegistration:
    """Tests that the extractor is properly registered."""

    def test_registered_in_extractor_registry(self):
        from extractors import EXTRACTOR_REGISTRY

        assert "book_slices" in EXTRACTOR_REGISTRY
        assert EXTRACTOR_REGISTRY["book_slices"] is BookSliceExtractor

    def test_in_package_all_exports(self):
        import extractors

        assert "BookSliceExtractor" in extractors.__all__
