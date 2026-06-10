"""Unit tests for the boon extractor.

Tests both the positional (ALL CAPS) and dot-rated (● symbol) heading modes,
mechanical field parsing, tier derivation, prerequisite detection, and
configuration validation.
"""

from __future__ import annotations

import pytest

from extractors.boon_extractor import (
    BoonExtractor,
    _derive_tier_min,
    _name_to_camel_case,
    _parse_mechanical_fields,
    _build_mechanical_effects,
    _find_prerequisite_boon_ids,
    _extract_description,
)
from parser_framework.models import BookSpec


def _make_spec(book_id: str = "test_book") -> BookSpec:
    """Create a minimal BookSpec for testing."""
    return BookSpec(
        book_id=book_id,
        filenames=["Test_Book.pdf"],
        output_path="src/data/_extracted/test.txt",
        section_anchors=[],
        heading_patterns=[],
        expected_fields=[],
        pipeline_stages=["ingest", "extract"],
    )


# --- Helper function tests ---


class TestNameToCamelCase:
    def test_single_word(self):
        assert _name_to_camel_case("Artistry") == "artistry"

    def test_two_words(self):
        assert _name_to_camel_case("Epic Dexterity") == "epicDexterity"

    def test_three_words(self):
        assert _name_to_camel_case("Arcane Calculus") == "arcaneCalculus"

    def test_with_apostrophe(self):
        assert _name_to_camel_case("Earth's Fury") == "earthsFury"

    def test_with_unicode_apostrophe(self):
        assert _name_to_camel_case("Earth\u2019s Fury") == "earthsFury"

    def test_with_hyphen(self):
        assert _name_to_camel_case("Self-Healing") == "selfHealing"


class TestDeriveTierMin:
    def test_dots_1_to_4_are_hero(self):
        for dot in range(1, 5):
            assert _derive_tier_min(dot) == "hero"

    def test_dots_5_to_8_are_demigod(self):
        for dot in range(5, 9):
            assert _derive_tier_min(dot) == "demigod"

    def test_dots_9_to_12_are_god(self):
        for dot in range(9, 13):
            assert _derive_tier_min(dot) == "god"


class TestParseMechanicalFields:
    def test_all_fields(self):
        block = (
            "Cost: Imbue 1 Legend\n"
            "Duration: One scene\n"
            "Subject: One object\n"
            "Range: Close\n"
            "Action: Simple\n"
            "Clash: Presence + Legend vs. Composure + Legend\n"
            "Some description text."
        )
        fields = _parse_mechanical_fields(block)
        assert fields["cost"] == "Imbue 1 Legend"
        assert fields["duration"] == "One scene"
        assert fields["subject"] == "One object"
        assert fields["range"] == "Close"
        assert fields["action"] == "Simple"
        assert fields["clash"] == "Presence + Legend vs. Composure + Legend"

    def test_missing_fields(self):
        block = "Cost: Free\nDuration: Instant\nSome description follows."
        fields = _parse_mechanical_fields(block)
        assert fields["cost"] == "Free"
        assert fields["duration"] == "Instant"
        assert fields["subject"] == ""
        assert fields["range"] == ""
        assert fields["action"] == ""
        assert fields["clash"] == ""

    def test_no_fields(self):
        block = "This is just description text with no mechanical fields."
        fields = _parse_mechanical_fields(block)
        assert all(v == "" for v in fields.values())


class TestBuildMechanicalEffects:
    def test_full_output(self):
        fields = {
            "cost": "Imbue 1 Legend",
            "duration": "One scene",
            "subject": "Self",
            "range": "Close",
            "action": "Simple",
            "clash": "",
        }
        result = _build_mechanical_effects(fields)
        assert "Cost: Imbue 1 Legend" in result
        assert "Duration: One scene" in result
        assert "Clash:" not in result  # empty fields excluded

    def test_empty_fields(self):
        fields = {k.lower(): "" for k in ("Cost", "Duration", "Subject", "Range", "Action", "Clash")}
        assert _build_mechanical_effects(fields) == ""


class TestFindPrerequisiteBoonIds:
    def test_single_prerequisite(self):
        block = "Prerequisite: Disguise\nCost: Spend 1 Legend\n"
        names_to_dots = {"DISGUISE": 1, "IMPERSONATION": 2}
        result = _find_prerequisite_boon_ids(block, "illusions", names_to_dots)
        assert result == ["illusions_dot_01"]

    def test_no_prerequisite(self):
        block = "Cost: Imbue 1 Legend\nDuration: Scene\n"
        result = _find_prerequisite_boon_ids(block, "artistry", {})
        assert result == []

    def test_unmatched_prerequisite(self):
        block = "Prerequisite: Unknown Boon\nCost: Free\n"
        names_to_dots = {"DISGUISE": 1}
        result = _find_prerequisite_boon_ids(block, "illusions", names_to_dots)
        assert result == []


# --- Extractor integration tests ---


class TestBoonExtractorPositional:
    """Test the positional ALL CAPS heading mode (Pandora's Box format)."""

    SAMPLE_TEXT = (
        "===== Page 1 / 10 =====\n"
        "STANDARD PURVIEWS\n"
        "These are the Purviews of the divine realm.\n"
        "ARTISTRY\n"
        "AESTHETIC IMPROVEMENT\n"
        "Cost: Imbue 1 Legend\n"
        "Duration: Scene\n"
        "Subject: One object\n"
        "Range: Close\n"
        "Action: Simple\n"
        "By adding artistic flourishes to an object, you improve it.\n"
        "\n"
        "ENTHRALLING PERFORMANCE\n"
        "Cost: Imbue 1 Legend\n"
        "Duration: Indefinite\n"
        "Subject: All characters\n"
        "Clash: Presence + Legend vs. Composure + Legend\n"
        "Range: Medium\n"
        "Action: Complex\n"
        "No one can look away from your art.\n"
        "\n"
        "===== Page 2 / 10 =====\n"
        "ESOTERIC INTERPRETATION\n"
        "Prerequisite: Enthralling Performance\n"
        "Cost: None\n"
        "Duration: Episode\n"
        "Subject: Self\n"
        "Action: Simple\n"
        "Once per session you discover hidden meanings.\n"
        "\n"
        "BEAUTY\n"
        "ALL ELSE FALLS AWAY\n"
        "Cost: Imbue 1 Legend\n"
        "Duration: One scene\n"
        "Subject: Self\n"
        "Range: Medium\n"
        "Action: Simple\n"
        "You are so beautiful everything else fades.\n"
    )

    def _make_config(self) -> dict:
        return {
            "section_anchors": [
                {"pattern": "ARTISTRY", "pattern_type": "literal"},
                {"pattern": "BEAUTY", "pattern_type": "literal"},
            ],
        }

    def test_extracts_boons_from_purview_sections(self):
        extractor = BoonExtractor()
        spec = _make_spec()
        result = extractor.extract(self.SAMPLE_TEXT, spec, self._make_config())

        assert result.category == "boons"
        assert result.entry_count > 0
        # Should find artistry boons
        assert "artistry_dot_01" in result.entries
        assert "artistry_dot_02" in result.entries

    def test_boon_id_format(self):
        extractor = BoonExtractor()
        spec = _make_spec()
        result = extractor.extract(self.SAMPLE_TEXT, spec, self._make_config())

        entry = result.entries["artistry_dot_01"]
        assert entry["id"] == "artistry_dot_01"

    def test_dot_rating_from_position(self):
        extractor = BoonExtractor()
        spec = _make_spec()
        result = extractor.extract(self.SAMPLE_TEXT, spec, self._make_config())

        assert result.entries["artistry_dot_01"]["dot"] == 1
        assert result.entries["artistry_dot_02"]["dot"] == 2

    def test_tier_min_derivation(self):
        extractor = BoonExtractor()
        spec = _make_spec()
        result = extractor.extract(self.SAMPLE_TEXT, spec, self._make_config())

        # Dots 1-4 are hero tier
        assert result.entries["artistry_dot_01"]["tierMin"] == "hero"

    def test_mechanical_fields_parsed(self):
        extractor = BoonExtractor()
        spec = _make_spec()
        result = extractor.extract(self.SAMPLE_TEXT, spec, self._make_config())

        entry = result.entries["artistry_dot_01"]
        assert entry["cost"] == "Imbue 1 Legend"
        assert entry["duration"] == "Scene"
        assert entry["subject"] == "One object"
        assert entry["range"] == "Close"
        assert entry["action"] == "Simple"

    def test_mechanical_effects_string(self):
        extractor = BoonExtractor()
        spec = _make_spec()
        result = extractor.extract(self.SAMPLE_TEXT, spec, self._make_config())

        entry = result.entries["artistry_dot_02"]
        assert "Cost: Imbue 1 Legend" in entry["mechanicalEffects"]
        assert "Clash: Presence + Legend vs. Composure + Legend" in entry["mechanicalEffects"]

    def test_purview_fields(self):
        extractor = BoonExtractor()
        spec = _make_spec()
        result = extractor.extract(self.SAMPLE_TEXT, spec, self._make_config())

        entry = result.entries["artistry_dot_01"]
        assert entry["purview"] == "artistry"
        assert entry["purviewName"] == "Artistry"

    def test_source_field_format(self):
        extractor = BoonExtractor()
        spec = _make_spec()
        result = extractor.extract(self.SAMPLE_TEXT, spec, self._make_config())

        entry = result.entries["artistry_dot_01"]
        assert entry["source"] == "Test_Book.pdf p.1"

    def test_prerequisite_detection(self):
        extractor = BoonExtractor()
        spec = _make_spec()
        result = extractor.extract(self.SAMPLE_TEXT, spec, self._make_config())

        entry = result.entries.get("artistry_dot_03")
        if entry:
            assert "artistry_dot_02" in entry["requiresBoonIds"]

    def test_legend_min_defaults_to_zero(self):
        extractor = BoonExtractor()
        spec = _make_spec()
        result = extractor.extract(self.SAMPLE_TEXT, spec, self._make_config())

        entry = result.entries["artistry_dot_01"]
        assert entry["legendMin"] == 0


class TestBoonExtractorDotRated:
    """Test the dot-rated symbol heading mode."""

    SAMPLE_TEXT = (
        "===== Page 5 / 10 =====\n"
        "Artistry Boons\n"
        "Aesthetic Improvement ●\n"
        "Cost: Imbue 1 Legend\n"
        "Duration: Scene\n"
        "Subject: One object\n"
        "Range: Close\n"
        "Action: Simple\n"
        "Improve objects with artistic flourishes.\n"
        "\n"
        "Enthralling Performance ●●\n"
        "Cost: Imbue 1 Legend\n"
        "Duration: Indefinite\n"
        "Subject: All characters\n"
        "Range: Medium\n"
        "Action: Complex\n"
        "Captivate your audience completely.\n"
        "\n"
        "Beauty Boons\n"
        "All Else Falls Away ●\n"
        "Cost: Imbue 1 Legend\n"
        "Duration: One scene\n"
        "Subject: Self\n"
        "Range: Medium\n"
        "Action: Simple\n"
        "Your beauty overwhelms all perception.\n"
    )

    def _make_config(self) -> dict:
        return {
            "section_anchors": [
                {
                    "pattern": r"^(?P<purview>[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+Boons$",
                    "pattern_type": "regex",
                }
            ],
            "heading_pattern": {
                "regex": r"^(?P<name>.+?)\s*(?P<dots>[●•]+)\s*$",
                "flags": ["MULTILINE"],
            },
            "dot_symbol": "●",
        }

    def test_extracts_boons_from_dot_rated_sections(self):
        extractor = BoonExtractor()
        spec = _make_spec()
        result = extractor.extract(self.SAMPLE_TEXT, spec, self._make_config())

        assert result.entry_count > 0
        assert "artistry_dot_01" in result.entries
        assert "artistry_dot_02" in result.entries

    def test_dot_rating_from_symbols(self):
        extractor = BoonExtractor()
        spec = _make_spec()
        result = extractor.extract(self.SAMPLE_TEXT, spec, self._make_config())

        # Position-based: first boon is dot 1, second is dot 2
        assert result.entries["artistry_dot_01"]["dot"] == 1
        assert result.entries["artistry_dot_02"]["dot"] == 2

    def test_multiple_purview_sections(self):
        extractor = BoonExtractor()
        spec = _make_spec()
        result = extractor.extract(self.SAMPLE_TEXT, spec, self._make_config())

        assert "beauty_dot_01" in result.entries


class TestBoonExtractorValidation:
    """Test configuration validation."""

    def test_valid_config(self):
        extractor = BoonExtractor()
        config = {
            "section_anchors": [
                {"pattern": r"^(?P<purview>[A-Z]+)$", "pattern_type": "regex"}
            ]
        }
        errors = extractor.validate_config(config)
        assert errors == []

    def test_missing_section_anchors(self):
        extractor = BoonExtractor()
        errors = extractor.validate_config({})
        assert any("section_anchors" in e for e in errors)

    def test_empty_section_anchors(self):
        extractor = BoonExtractor()
        errors = extractor.validate_config({"section_anchors": []})
        assert any("empty" in e for e in errors)

    def test_invalid_heading_pattern(self):
        extractor = BoonExtractor()
        config = {
            "section_anchors": [{"pattern": "test", "pattern_type": "literal"}],
            "heading_pattern": "not_a_dict",
        }
        errors = extractor.validate_config(config)
        assert any("heading_pattern" in e for e in errors)


class TestBoonExtractorGracefulHandling:
    """Test graceful handling of missing/empty sections."""

    def test_no_matching_sections(self):
        extractor = BoonExtractor()
        spec = _make_spec()
        config = {
            "section_anchors": [
                {"pattern": r"^(?P<purview>NONEXISTENT)\s+Boons$", "pattern_type": "regex"}
            ]
        }
        result = extractor.extract("Some random text with no boon sections.", spec, config)

        assert result.category == "boons"
        assert result.entry_count == 0
        assert len(result.log) > 0

    def test_section_found_but_no_boons(self):
        extractor = BoonExtractor()
        spec = _make_spec()
        text = "ARTISTRY\nThis purview has no boon entries formatted correctly.\n"
        config = {
            "section_anchors": [
                {"pattern": r"^(?P<purview>[A-Z]+)$", "pattern_type": "regex"}
            ]
        }
        result = extractor.extract(text, spec, config)

        assert result.entry_count == 0
