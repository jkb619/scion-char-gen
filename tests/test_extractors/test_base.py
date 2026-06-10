"""Unit tests for the extractors base module.

Validates:
- CategoryExtractor ABC contract (cannot instantiate, subclass must implement methods)
- CategoryResult dataclass structure and defaults
- LogEntry dataclass structure and defaults
- EXTRACTOR_REGISTRY is importable and has the correct type
"""

from __future__ import annotations

import pytest

from extractors import EXTRACTOR_REGISTRY, CategoryExtractor, CategoryResult, LogEntry


class TestLogEntry:
    """Tests for the LogEntry dataclass."""

    def test_create_with_all_fields(self):
        log = LogEntry(entry_id="boon_01", field="dot", reason="not_found", detail="Missing dot symbols")
        assert log.entry_id == "boon_01"
        assert log.field == "dot"
        assert log.reason == "not_found"
        assert log.detail == "Missing dot symbols"

    def test_detail_defaults_to_none(self):
        log = LogEntry(entry_id="knack_03", field="name", reason="parse_error")
        assert log.detail is None

    def test_valid_reason_values(self):
        valid_reasons = [
            "not_found",
            "parse_error",
            "section_missing",
            "heading_unmatched",
            "anchor_not_found",
            "validation_warning",
        ]
        for reason in valid_reasons:
            log = LogEntry(entry_id="x", field="y", reason=reason)
            assert log.reason == reason


class TestCategoryResult:
    """Tests for the CategoryResult dataclass."""

    def test_create_with_entries(self):
        entries = {"fire_dot_01": {"name": "Blaze", "dot": 1}}
        result = CategoryResult(category="boons", entries=entries, entry_count=1)
        assert result.category == "boons"
        assert result.entries == entries
        assert result.entry_count == 1
        assert result.log == []

    def test_log_defaults_to_empty_list(self):
        result = CategoryResult(category="knacks", entries={}, entry_count=0)
        assert result.log == []

    def test_log_with_entries(self):
        log_entries = [
            LogEntry(entry_id="x", field="name", reason="not_found"),
            LogEntry(entry_id="y", field="desc", reason="parse_error", detail="bad format"),
        ]
        result = CategoryResult(category="purviews", entries={}, entry_count=0, log=log_entries)
        assert len(result.log) == 2
        assert result.log[0].entry_id == "x"
        assert result.log[1].detail == "bad format"

    def test_empty_result(self):
        result = CategoryResult(category="equipment", entries={}, entry_count=0)
        assert result.entries == {}
        assert result.entry_count == 0


class TestCategoryExtractorABC:
    """Tests for the CategoryExtractor abstract base class."""

    def test_cannot_instantiate_directly(self):
        with pytest.raises(TypeError, match="abstract methods"):
            CategoryExtractor()

    def test_subclass_missing_extract_raises(self):
        class Incomplete(CategoryExtractor):
            def validate_config(self, category_config):
                return []

        with pytest.raises(TypeError, match="abstract method"):
            Incomplete()

    def test_subclass_missing_validate_config_raises(self):
        class Incomplete(CategoryExtractor):
            def extract(self, text, spec, category_config):
                return CategoryResult(category="test", entries={}, entry_count=0)

        with pytest.raises(TypeError, match="abstract method"):
            Incomplete()

    def test_complete_subclass_works(self):
        class Complete(CategoryExtractor):
            def extract(self, text, spec, category_config):
                return CategoryResult(category="test", entries={"a": 1}, entry_count=1)

            def validate_config(self, category_config):
                return []

        extractor = Complete()
        result = extractor.extract("some text", None, {})
        assert result.category == "test"
        assert result.entry_count == 1
        assert extractor.validate_config({}) == []


class TestExtractorRegistry:
    """Tests for the EXTRACTOR_REGISTRY in __init__.py."""

    def test_registry_is_dict(self):
        assert isinstance(EXTRACTOR_REGISTRY, dict)

    def test_registry_values_would_be_extractor_subclasses(self):
        # Currently empty (placeholders commented out), but verify type annotation holds
        for name, cls in EXTRACTOR_REGISTRY.items():
            assert isinstance(name, str)
            assert issubclass(cls, CategoryExtractor)

    def test_all_exports(self):
        import extractors

        assert hasattr(extractors, "CategoryExtractor")
        assert hasattr(extractors, "CategoryResult")
        assert hasattr(extractors, "LogEntry")
        assert hasattr(extractors, "EXTRACTOR_REGISTRY")
