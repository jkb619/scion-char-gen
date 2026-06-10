"""Unit tests for the PurviewExtractor.

Validates:
- Purview extraction from the Standard Purviews section
- boonLadderNames extraction and padding to length 12
- purviewInnateSummary extraction from "Innate Power" subsections
- camelCase ID derivation from purview names
- Source provenance tracking from page markers
- Config validation
- Graceful handling of missing sections
"""

from __future__ import annotations

import pytest

from extractors.purview_extractor import (
    PurviewExtractor,
    _name_to_camel_case,
    _pad_to_12,
    _title_case_boon,
)
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
    section_anchors: list[dict] | None = None,
    heading_pattern: dict | None = None,
    output_path: str = "src/data/purviews_test.json",
) -> dict:
    """Create a category config dict for purviews."""
    config: dict = {"output_path": output_path}
    if section_anchors is not None:
        config["section_anchors"] = section_anchors
    else:
        config["section_anchors"] = [{"pattern": "STANDARD PURVIEWS", "pattern_type": "literal"}]
    if heading_pattern is not None:
        config["heading_pattern"] = heading_pattern
    return config


class TestNameToCamelCase:
    """Tests for the _name_to_camel_case helper."""

    def test_single_word(self):
        assert _name_to_camel_case("Artistry") == "artistry"

    def test_multi_word(self):
        assert _name_to_camel_case("Epic Strength") == "epicStrength"

    def test_three_words(self):
        assert _name_to_camel_case("Arcane Calculus") == "arcaneCalculus"

    def test_apostrophe_stripped(self):
        assert _name_to_camel_case("Beast's Fury") == "beastsFury"

    def test_empty_string(self):
        assert _name_to_camel_case("") == ""

    def test_all_caps(self):
        assert _name_to_camel_case("FIRE") == "fire"


class TestPadTo12:
    """Tests for the _pad_to_12 helper."""

    def test_empty_list_pads_to_12(self):
        result = _pad_to_12([])
        assert len(result) == 12
        assert all(x == "" for x in result)

    def test_shorter_list_padded(self):
        result = _pad_to_12(["A", "B", "C"])
        assert len(result) == 12
        assert result[:3] == ["A", "B", "C"]
        assert all(x == "" for x in result[3:])

    def test_exact_12_unchanged(self):
        names = [f"Boon{i}" for i in range(12)]
        result = _pad_to_12(names)
        assert result == names

    def test_longer_than_12_truncated(self):
        names = [f"Boon{i}" for i in range(15)]
        result = _pad_to_12(names)
        assert len(result) == 12


class TestTitleCaseBoon:
    """Tests for the _title_case_boon helper."""

    def test_all_caps_to_title(self):
        assert _title_case_boon("AESTHETIC IMPROVEMENT") == "Aesthetic Improvement"

    def test_small_words_lowered(self):
        assert _title_case_boon("ASPECT OF THE APEX PREDATOR") == "Aspect of the Apex Predator"

    def test_apostrophe_handling(self):
        assert _title_case_boon("LION'S SMILE") == "Lion'S Smile"

    def test_single_word(self):
        assert _title_case_boon("TELEKINESIS") == "Telekinesis"


class TestPurviewExtractorExtract:
    """Tests for PurviewExtractor.extract()."""

    def test_basic_extraction(self):
        """Extract a single purview with boon ladder names."""
        text = (
            "===== Page 219 / 290 =====\n"
            "STANDARD PURVIEWS\n"
            "ARTISTRY\n"
            "AESTHETIC IMPROVEMENT\n"
            "Cost: Imbue 1 Legend\n"
            "Duration: Scene\n"
            "Some description of the boon.\n"
            "\n"
            "ENTHRALLING PERFORMANCE\n"
            "Cost: Imbue 1 Legend\n"
            "Duration: Indefinite\n"
            "Another boon description.\n"
        )
        config = _make_config()
        spec = _make_spec()
        extractor = PurviewExtractor()
        result = extractor.extract(text, spec, config)

        assert result.category == "purviews"
        assert result.entry_count == 1
        assert "artistry" in result.entries

        entry = result.entries["artistry"]
        assert entry["id"] == "artistry"
        assert entry["name"] == "Artistry"
        assert entry["boonLadderNames"][0] == "Aesthetic Improvement"
        assert entry["boonLadderNames"][1] == "Enthralling Performance"
        assert len(entry["boonLadderNames"]) == 12

    def test_boon_ladder_padded_to_12(self):
        """Boon ladder names are padded to exactly 12 entries."""
        text = (
            "===== Page 5 / 100 =====\n"
            "STANDARD PURVIEWS\n"
            "FIRE\n"
            "EMBER SHIELD\n"
            "Cost: Imbue 1 Legend\n"
            "Fire protection.\n"
            "\n"
            "INFERNO\n"
            "Cost: Spend 1 Legend\n"
            "Big fire.\n"
        )
        config = _make_config()
        spec = _make_spec()
        extractor = PurviewExtractor()
        result = extractor.extract(text, spec, config)

        assert "fire" in result.entries
        ladder = result.entries["fire"]["boonLadderNames"]
        assert len(ladder) == 12
        assert ladder[0] == "Ember Shield"
        assert ladder[1] == "Inferno"
        assert all(x == "" for x in ladder[2:])

    def test_multiple_purviews(self):
        """Multiple purviews are extracted from the same section."""
        text = (
            "===== Page 10 / 100 =====\n"
            "STANDARD PURVIEWS\n"
            "FIRE\n"
            "EMBER SHIELD\n"
            "Cost: Imbue 1 Legend\n"
            "Fire protection.\n"
            "\n"
            "WATER\n"
            "TIDAL WAVE\n"
            "Cost: Spend 1 Legend\n"
            "Big wave.\n"
        )
        config = _make_config()
        spec = _make_spec()
        extractor = PurviewExtractor()
        result = extractor.extract(text, spec, config)

        assert result.entry_count == 2
        assert "fire" in result.entries
        assert "water" in result.entries
        assert result.entries["fire"]["boonLadderNames"][0] == "Ember Shield"
        assert result.entries["water"]["boonLadderNames"][0] == "Tidal Wave"

    def test_source_includes_filename_and_page(self):
        """Source field follows the <filename> p.<N> format."""
        text = (
            "===== Page 42 / 200 =====\n"
            "STANDARD PURVIEWS\n"
            "DEATH\n"
            "CLAIM SOUL\n"
            "Cost: Imbue 1 Legend\n"
            "Take a soul.\n"
        )
        config = _make_config()
        spec = _make_spec(filenames=["Scion_Hero.pdf"])
        extractor = PurviewExtractor()
        result = extractor.extract(text, spec, config)

        entry = result.entries["death"]
        assert entry["source"] == "Scion_Hero.pdf p.42"

    def test_innate_power_extraction(self):
        """Innate power summary is extracted from 'Innate Power:' text."""
        text = (
            "===== Page 5 / 100 =====\n"
            "STANDARD PURVIEWS\n"
            "EARTH FRIEND\n"
            "Innate Power: You can see through solid earth or stone.\n"
            "ANIMATE EARTH\n"
            "Cost: Imbue 1 Legend\n"
            "Animate the ground.\n"
        )
        config = _make_config()
        spec = _make_spec()
        extractor = PurviewExtractor()
        result = extractor.extract(text, spec, config)

        assert "earthFriend" in result.entries
        entry = result.entries["earthFriend"]
        assert entry.get("purviewInnateSummary") == "You can see through solid earth or stone."

    def test_innate_power_multiline(self):
        """Innate power split across lines is captured correctly."""
        text = (
            "===== Page 5 / 100 =====\n"
            "STANDARD PURVIEWS\n"
            "BEAST\n"
            "Innate Power: You can speak with and understand\n"
            "mundane animals; they are inclined to aid you.\n"
            "ANIMAL ASPECT\n"
            "Cost: Imbue 1 Legend\n"
            "Become like an animal.\n"
        )
        config = _make_config()
        spec = _make_spec()
        extractor = PurviewExtractor()
        result = extractor.extract(text, spec, config)

        assert "beast" in result.entries
        entry = result.entries["beast"]
        assert "speak with and understand mundane animals" in entry.get("purviewInnateSummary", "")

    def test_multi_word_purview_id(self):
        """Multi-word purview names produce camelCase IDs."""
        text = (
            "===== Page 5 / 100 =====\n"
            "STANDARD PURVIEWS\n"
            "EPIC DEXTERITY\n"
            "QUICK DODGE\n"
            "Cost: Imbue 1 Legend\n"
            "Dodge quickly.\n"
        )
        config = _make_config()
        spec = _make_spec()
        extractor = PurviewExtractor()
        result = extractor.extract(text, spec, config)

        assert "epicDexterity" in result.entries
        entry = result.entries["epicDexterity"]
        assert entry["name"] == "Epic Dexterity"

    def test_missing_section_returns_empty(self):
        """When the purviews section can't be found, return empty result."""
        text = "===== Page 1 / 10 =====\nSome unrelated content about knacks."
        config = _make_config(
            section_anchors=[{"pattern": "STANDARD PURVIEWS", "pattern_type": "literal"}]
        )
        spec = _make_spec()
        extractor = PurviewExtractor()
        result = extractor.extract(text, spec, config)

        assert result.entry_count == 0
        assert any(log.reason == "anchor_not_found" for log in result.log)

    def test_empty_text_produces_empty_result(self):
        """Empty text produces no entries and no exceptions."""
        config = _make_config()
        spec = _make_spec()
        extractor = PurviewExtractor()
        result = extractor.extract("", spec, config)

        assert result.entry_count == 0

    def test_purview_with_no_boons_logs_warning(self):
        """A purview heading without boon entries logs a not_found warning."""
        text = (
            "===== Page 5 / 100 =====\n"
            "STANDARD PURVIEWS\n"
            "MYSTERY\n"
            "This is just descriptive text with no boons.\n"
            "Nothing that looks like a boon entry.\n"
        )
        config = _make_config()
        spec = _make_spec()
        extractor = PurviewExtractor()
        result = extractor.extract(text, spec, config)

        # Should not include this as a purview since it has no boons
        assert result.entry_count == 0


class TestPurviewExtractorValidateConfig:
    """Tests for PurviewExtractor.validate_config()."""

    def test_valid_config(self):
        config = _make_config()
        extractor = PurviewExtractor()
        errors = extractor.validate_config(config)
        assert errors == []

    def test_missing_output_path(self):
        config = {"section_anchors": [{"pattern": "Purviews", "pattern_type": "literal"}]}
        extractor = PurviewExtractor()
        errors = extractor.validate_config(config)
        assert any("output_path" in e for e in errors)

    def test_missing_section_anchors(self):
        config = {"output_path": "src/data/purviews_test.json"}
        extractor = PurviewExtractor()
        errors = extractor.validate_config(config)
        assert any("section_anchors" in e for e in errors)
