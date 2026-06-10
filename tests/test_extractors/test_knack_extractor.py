"""Unit tests for the KnackExtractor.

Validates:
- Knack extraction from calling-organized sections
- camelCase ID derivation from names
- knackKind determination (mortal/immortal) from section context
- Source provenance tracking from page markers
- Correct callings assignment from calling_map
- Config validation
- Graceful handling of missing sections
"""

from __future__ import annotations

import pytest

from extractors.knack_extractor import KnackExtractor, _name_to_camel_case, _find_nearest_page
from parser_framework.models import BookSpec


def _make_spec(filenames: list[str] | None = None) -> BookSpec:
    """Create a minimal BookSpec for testing."""
    return BookSpec(
        book_id="test_book",
        filenames=filenames or ["TestBook.pdf"],
        output_path="src/data/_extracted/test_book.txt",
        section_anchors=[],
        heading_patterns=[],
        expected_fields=[],
        pipeline_stages=["ingest", "extract"],
    )


def _make_config(
    calling_map: dict[str, str] | None = None,
    heading_pattern: dict | None = None,
    section_anchors: list[dict] | None = None,
) -> dict:
    """Create a category config dict for knacks."""
    config: dict = {}
    if calling_map is not None:
        config["calling_map"] = calling_map
    if heading_pattern is not None:
        config["heading_pattern"] = heading_pattern
    if section_anchors is not None:
        config["section_anchors"] = section_anchors
    return config


class TestNameToCamelCase:
    """Tests for the _name_to_camel_case helper."""

    def test_simple_multi_word(self):
        assert _name_to_camel_case("Aura of Greatness") == "auraOfGreatness"

    def test_single_word(self):
        assert _name_to_camel_case("Forgettable") == "forgettable"

    def test_short_first_word(self):
        assert _name_to_camel_case("A Purpose") == "aPurpose"

    def test_apostrophe_stripped(self):
        assert _name_to_camel_case("Don't Tread on Me") == "dontTreadOnMe"

    def test_hyphenated_word(self):
        assert _name_to_camel_case("Self-Healing") == "selfHealing"

    def test_empty_string(self):
        assert _name_to_camel_case("") == ""

    def test_all_caps_word(self):
        assert _name_to_camel_case("RAGE") == "rage"

    def test_mixed_punctuation(self):
        assert _name_to_camel_case("Fire's Blessing (Greater)") == "firesBlessingGreater"


class TestFindNearestPage:
    """Tests for the _find_nearest_page helper."""

    def test_finds_preceding_marker(self):
        text = "===== Page 3 / 10 =====\nSome content here"
        assert _find_nearest_page(text, 40) == 3

    def test_returns_1_when_no_marker(self):
        text = "Some content without any page markers"
        assert _find_nearest_page(text, 20) == 1

    def test_finds_most_recent_marker(self):
        text = "===== Page 1 / 10 =====\nFirst\n===== Page 2 / 10 =====\nSecond"
        # Position after second marker
        assert _find_nearest_page(text, len(text)) == 2


class TestKnackExtractorExtract:
    """Tests for KnackExtractor.extract()."""

    def test_basic_extraction(self):
        """Extract a single knack from a guardian section."""
        text = (
            "===== Page 5 / 100 =====\n"
            "Guardian Knacks\n"
            "Shield Wall\n"
            "You can protect allies with your shield.\n"
            "Spend Momentum to apply armor to an adjacent ally.\n"
        )
        config = _make_config(
            calling_map={"Guardian Knacks": "guardian"},
            heading_pattern={"regex": r"^(?P<name>[A-Z][A-Za-z' ]+)$", "flags": ["MULTILINE"]},
        )
        spec = _make_spec()
        extractor = KnackExtractor()
        result = extractor.extract(text, spec, config)

        assert result.category == "knacks"
        assert result.entry_count == 1
        assert "shieldWall" in result.entries

        entry = result.entries["shieldWall"]
        assert entry["id"] == "shieldWall"
        assert entry["name"] == "Shield Wall"
        assert entry["callings"] == ["guardian"]
        assert entry["knackKind"] == "immortal"
        assert entry["tierMin"] == "hero"
        assert "p.5" in entry["source"]
        assert entry["description"] != ""

    def test_mortal_knack_kind_from_anchor(self):
        """Sections with 'Mortal' in the anchor produce mortal knacks."""
        text = (
            "===== Page 10 / 100 =====\n"
            "Mortal Knacks\n"
            "Quick Reflexes\n"
            "React faster than normal people.\n"
        )
        config = _make_config(
            calling_map={"Mortal Knacks": "guardian"},
            heading_pattern={"regex": r"^(?P<name>[A-Z][A-Za-z' ]+)$", "flags": ["MULTILINE"]},
        )
        spec = _make_spec()
        extractor = KnackExtractor()
        result = extractor.extract(text, spec, config)

        assert result.entry_count == 1
        entry = result.entries["quickReflexes"]
        assert entry["knackKind"] == "mortal"
        assert entry["tierMin"] == "mortal"

    def test_multiple_callings(self):
        """Extracts knacks from multiple calling sections."""
        text = (
            "===== Page 1 / 50 =====\n"
            "Guardian Knacks\n"
            "Shield Wall\n"
            "Protect allies.\n"
            "\n"
            "===== Page 3 / 50 =====\n"
            "Creator Knacks\n"
            "Perfect Form\n"
            "Shape materials with precision.\n"
        )
        config = _make_config(
            calling_map={
                "Guardian Knacks": "guardian",
                "Creator Knacks": "creator",
            },
            heading_pattern={"regex": r"^(?P<name>[A-Z][A-Za-z' ]+)$", "flags": ["MULTILINE"]},
        )
        spec = _make_spec()
        extractor = KnackExtractor()
        result = extractor.extract(text, spec, config)

        assert result.entry_count == 2
        assert result.entries["shieldWall"]["callings"] == ["guardian"]
        assert result.entries["perfectForm"]["callings"] == ["creator"]

    def test_source_includes_filename_and_page(self):
        """Source field follows the <filename> p.<N> format."""
        text = (
            "===== Page 42 / 200 =====\n"
            "Hunter Knacks\n"
            "Eagle Eye\n"
            "See further than others.\n"
        )
        config = _make_config(
            calling_map={"Hunter Knacks": "hunter"},
            heading_pattern={"regex": r"^(?P<name>[A-Z][A-Za-z' ]+)$", "flags": ["MULTILINE"]},
        )
        spec = _make_spec(filenames=["Scion_Hero.pdf"])
        extractor = KnackExtractor()
        result = extractor.extract(text, spec, config)

        entry = result.entries["eagleEye"]
        assert entry["source"] == "Scion_Hero.pdf p.42"

    def test_missing_section_logs_anchor_not_found(self):
        """When a calling_map anchor isn't in the text, log it and skip."""
        text = "===== Page 1 / 10 =====\nSome unrelated content."
        config = _make_config(
            calling_map={"Nonexistent Section": "warrior"},
            heading_pattern={"regex": r"^(?P<name>[A-Z][A-Za-z' ]+)$", "flags": ["MULTILINE"]},
        )
        spec = _make_spec()
        extractor = KnackExtractor()
        result = extractor.extract(text, spec, config)

        assert result.entry_count == 0
        assert any(log.reason == "anchor_not_found" for log in result.log)

    def test_empty_text_produces_empty_result(self):
        """Empty text produces no entries and no exceptions."""
        config = _make_config(
            calling_map={"Guardian Knacks": "guardian"},
            heading_pattern={"regex": r"^(?P<name>[A-Z][A-Za-z' ]+)$", "flags": ["MULTILINE"]},
        )
        spec = _make_spec()
        extractor = KnackExtractor()
        result = extractor.extract("", spec, config)

        assert result.entry_count == 0

    def test_multiple_knacks_in_one_section(self):
        """Multiple knacks within the same calling section are all extracted."""
        text = (
            "===== Page 7 / 50 =====\n"
            "Sage Knacks\n"
            "Keen Mind\n"
            "Recall information with perfect clarity.\n"
            "\n"
            "Deep Insight\n"
            "Understand motivations of others.\n"
            "\n"
            "Library of Ages\n"
            "Access ancient knowledge instinctively.\n"
        )
        config = _make_config(
            calling_map={"Sage Knacks": "sage"},
            heading_pattern={"regex": r"^(?P<name>[A-Z][A-Za-z' ]+)$", "flags": ["MULTILINE"]},
        )
        spec = _make_spec()
        extractor = KnackExtractor()
        result = extractor.extract(text, spec, config)

        assert result.entry_count == 3
        assert "keenMind" in result.entries
        assert "deepInsight" in result.entries
        assert "libraryOfAges" in result.entries
        for entry in result.entries.values():
            assert entry["callings"] == ["sage"]


class TestKnackExtractorValidateConfig:
    """Tests for KnackExtractor.validate_config()."""

    def test_valid_config(self):
        config = _make_config(
            calling_map={"Guardian Knacks": "guardian"},
            heading_pattern={"regex": r"^(?P<name>.+)$", "flags": ["MULTILINE"]},
        )
        extractor = KnackExtractor()
        errors = extractor.validate_config(config)
        assert errors == []

    def test_missing_calling_map(self):
        config = _make_config(heading_pattern={"regex": r"^.+$"})
        extractor = KnackExtractor()
        errors = extractor.validate_config(config)
        assert any("calling_map" in e for e in errors)

    def test_empty_calling_map(self):
        config = _make_config(calling_map={})
        extractor = KnackExtractor()
        errors = extractor.validate_config(config)
        assert any("empty" in e for e in errors)

    def test_calling_map_not_dict(self):
        config = {"calling_map": "not a dict"}
        extractor = KnackExtractor()
        errors = extractor.validate_config(config)
        assert any("dict" in e for e in errors)

    def test_heading_pattern_missing_regex(self):
        config = _make_config(
            calling_map={"Guardian Knacks": "guardian"},
            heading_pattern={"flags": ["MULTILINE"]},
        )
        extractor = KnackExtractor()
        errors = extractor.validate_config(config)
        assert any("regex" in e for e in errors)

    def test_heading_pattern_not_dict(self):
        config = {
            "calling_map": {"Guardian Knacks": "guardian"},
            "heading_pattern": "not a dict",
        }
        extractor = KnackExtractor()
        errors = extractor.validate_config(config)
        assert any("heading_pattern" in e for e in errors)
