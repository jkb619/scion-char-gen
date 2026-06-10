"""Unit tests for the pantheon category extractor.

Tests cover:
- Extraction of pantheon entries from well-structured text
- Section anchor matching (literal and regex)
- Heading pattern splitting by pantheon heading
- Asset skills parsing from "Asset Skills:" lines
- Deity parsing (multi-line and single-line formats)
- ID derivation from name (camelCase, handles special characters)
- Source provenance with page markers
- Graceful handling of missing sections and empty text
- Config validation
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

# Ensure src/scripts is importable
_SCRIPTS_DIR = Path(__file__).resolve().parents[2] / "src" / "scripts"
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from extractors.pantheon_extractor import PantheonExtractor, _to_camel_case_id
from parser_framework.models import BookSpec


def _make_spec(book_id: str = "scion_origin") -> BookSpec:
    """Create a minimal BookSpec for testing."""
    return BookSpec(
        book_id=book_id,
        filenames=["Scion_Origin.pdf"],
        output_path="src/data/_extracted/scion_origin.txt",
        section_anchors=[],
        heading_patterns=[],
        expected_fields=[],
        pipeline_stages=["ingest", "extract", "validate"],
    )


def _pantheons_config() -> dict:
    """Standard pantheons category config matching the design spec."""
    return {
        "output_path": "src/data/pantheons.json",
        "section_anchors": [
            {"pattern": "Pantheons", "pattern_type": "literal"},
        ],
        "heading_pattern": {
            "regex": r"^(?P<name>[A-Z\u00C0-\u017E].+?)\s*[\u2014\u2013]\s*(?P<tradition>[A-Z].+)$",
            "flags": ["MULTILINE"],
        },
        "expected_fields": [
            "id",
            "name",
            "assetSkills",
            "description",
            "mechanicalEffects",
            "deities",
            "source",
        ],
    }


# Sample text simulating ingested PDF output with page markers (multi-line deity format)
_SAMPLE_TEXT = """\
--- Page 94 ---
Some introductory chapter content here about character creation.

--- Page 95 ---
Pantheons

The following pantheons are available for play.

--- Page 170 ---
\u00c6sir \u2014 Norse
Gods of the Norse sphere\u2014fate, storms, and the long winter.

Asset Skills: Close Combat, Occult

Odin
Callings: Leader, Sage, Trickster
Purviews: Artistry, Death, Deception, Epic Stamina, Fortune, Journeys, War

Thor
Callings: Guardian, Leader, Warrior
Purviews: Epic Stamina, Epic Strength, Fertility, Sky

--- Page 172 ---
Theoi \u2014 Greek
The gods of Mount Olympus and the ancient Hellenic world.

Asset Skills: Athletics, Empathy

Zeus
Callings: Leader, Lover, Sage
Purviews: Epic Stamina, Fortune, Order, Sky

Athena
Callings: Guardian, Judge, Sage
Purviews: Artistry, Order, War, Forge
"""


class TestPantheonExtractorExtract:
    """Tests for the extract method."""

    def test_basic_extraction(self):
        """Extracts pantheons with correct id, name, and structure."""
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        assert result.category == "pantheons"
        assert result.entry_count == 2
        assert "aesir" in result.entries
        assert "theoi" in result.entries

    def test_name_includes_tradition(self):
        """The name field preserves the full heading (e.g., 'Æsir — Norse')."""
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        aesir = result.entries["aesir"]
        assert "\u2014" in aesir["name"] or "\u2013" in aesir["name"]
        assert "Norse" in aesir["name"]

    def test_asset_skills_extracted(self):
        """Asset skills are parsed from the 'Asset Skills:' line."""
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        aesir = result.entries["aesir"]
        assert "closeCombat" in aesir["assetSkills"]
        assert "occult" in aesir["assetSkills"]

        theoi = result.entries["theoi"]
        assert "athletics" in theoi["assetSkills"]
        assert "empathy" in theoi["assetSkills"]

    def test_deities_extracted_multi_line(self):
        """Deities with multi-line format (name, then Callings, then Purviews)."""
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        aesir = result.entries["aesir"]
        assert len(aesir["deities"]) == 2

        odin = next(d for d in aesir["deities"] if d["id"] == "odin")
        assert odin["name"] == "Odin"
        assert "leader" in odin["callings"]
        assert "sage" in odin["callings"]
        assert "trickster" in odin["callings"]
        assert "artistry" in odin["purviews"]
        assert "epicStamina" in odin["purviews"]

    def test_deity_id_derivation(self):
        """Deity IDs are derived as camelCase from names."""
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        theoi = result.entries["theoi"]
        deity_ids = [d["id"] for d in theoi["deities"]]
        assert "zeus" in deity_ids
        assert "athena" in deity_ids

    def test_source_format(self):
        """Source field matches '<filename> p.<N>' format."""
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        source_pattern = re.compile(r"^.+ p\.\d+$")
        for entry in result.entries.values():
            assert source_pattern.match(entry["source"]), f"Bad source: {entry['source']}"

    def test_source_uses_first_filename(self):
        """Source field uses the first filename from the spec."""
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        for entry in result.entries.values():
            assert entry["source"].startswith("Scion_Origin.pdf")

    def test_page_number_from_marker(self):
        """Page number is extracted from the nearest preceding page marker."""
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        aesir = result.entries["aesir"]
        assert "p.170" in aesir["source"]

        theoi = result.entries["theoi"]
        assert "p.172" in theoi["source"]

    def test_empty_text_returns_empty_result(self):
        """Empty text produces zero entries with no exceptions."""
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract("", spec, config)

        assert result.entry_count == 0
        assert result.entries == {}

    def test_no_pantheons_section_returns_empty(self):
        """Text without a Pantheons section returns empty result."""
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        text = "Some unrelated text\nNothing about this topic here\n"
        result = extractor.extract(text, spec, config)

        assert result.entry_count == 0
        assert len(result.log) > 0  # Should log anchor not found

    def test_regex_section_anchor(self):
        """Regex pattern_type anchors work correctly."""
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()
        config["section_anchors"] = [
            {"pattern": r"^Pantheons$", "pattern_type": "regex"},
        ]

        result = extractor.extract(_SAMPLE_TEXT, spec, config)
        assert result.entry_count == 2

    def test_entry_has_all_expected_fields(self):
        """Each entry has all expected fields."""
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        expected_keys = {"id", "name", "assetSkills", "description", "mechanicalEffects", "source", "deities"}
        for entry in result.entries.values():
            assert set(entry.keys()) == expected_keys

    def test_description_extracted(self):
        """Description is non-empty for each pantheon."""
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        aesir = result.entries["aesir"]
        assert "Norse" in aesir["description"] or "storms" in aesir["description"]


class TestPantheonExtractorSingleLineDeities:
    """Tests for single-line deity format parsing."""

    _SINGLE_LINE_TEXT = """\
--- Page 50 ---
Pantheons

--- Page 51 ---
Kami \u2014 Japanese
The spirits and gods of Japan.

Asset Skills: Culture, Integrity

Amaterasu \u2014 Callings: Leader, Lover, Sage. Purviews: Artistry, Beauty, Sun, Order
Susano-o \u2014 Callings: Guardian, Trickster, Warrior. Purviews: Chaos, Epic Strength, Sky, Water
"""

    def test_single_line_deities_extracted(self):
        """Single-line deity format is parsed correctly."""
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract(self._SINGLE_LINE_TEXT, spec, config)

        assert result.entry_count == 1
        kami = result.entries["kami"]
        assert len(kami["deities"]) == 2

    def test_single_line_deity_callings(self):
        """Callings are parsed from single-line deity entries."""
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract(self._SINGLE_LINE_TEXT, spec, config)

        kami = result.entries["kami"]
        amaterasu = next(d for d in kami["deities"] if d["id"] == "amaterasu")
        assert "leader" in amaterasu["callings"]
        assert "lover" in amaterasu["callings"]
        assert "sage" in amaterasu["callings"]

    def test_single_line_deity_purviews(self):
        """Purviews are parsed from single-line deity entries."""
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract(self._SINGLE_LINE_TEXT, spec, config)

        kami = result.entries["kami"]
        amaterasu = next(d for d in kami["deities"] if d["id"] == "amaterasu")
        assert "artistry" in amaterasu["purviews"]
        assert "beauty" in amaterasu["purviews"]
        assert "sun" in amaterasu["purviews"]

    def test_hyphenated_deity_name_id(self):
        """Deity names with hyphens get the hyphen stripped in ID."""
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract(self._SINGLE_LINE_TEXT, spec, config)

        kami = result.entries["kami"]
        deity_ids = [d["id"] for d in kami["deities"]]
        assert "susanoo" in deity_ids


class TestPantheonExtractorValidateConfig:
    """Tests for the validate_config method."""

    def test_valid_config_no_errors(self):
        """A valid config returns an empty error list."""
        extractor = PantheonExtractor()
        config = _pantheons_config()

        errors = extractor.validate_config(config)
        assert errors == []

    def test_missing_section_anchors(self):
        """Missing section_anchors produces an error."""
        extractor = PantheonExtractor()
        config = _pantheons_config()
        del config["section_anchors"]

        errors = extractor.validate_config(config)
        assert any("section_anchors" in e for e in errors)

    def test_empty_section_anchors(self):
        """Empty section_anchors list produces an error."""
        extractor = PantheonExtractor()
        config = _pantheons_config()
        config["section_anchors"] = []

        errors = extractor.validate_config(config)
        assert any("section_anchors" in e for e in errors)

    def test_missing_heading_pattern(self):
        """Missing heading_pattern produces an error."""
        extractor = PantheonExtractor()
        config = _pantheons_config()
        del config["heading_pattern"]

        errors = extractor.validate_config(config)
        assert any("heading_pattern" in e for e in errors)

    def test_invalid_heading_regex(self):
        """Invalid regex in heading_pattern produces an error."""
        extractor = PantheonExtractor()
        config = _pantheons_config()
        config["heading_pattern"] = {"regex": "[invalid(", "flags": []}

        errors = extractor.validate_config(config)
        assert any("invalid" in e.lower() or "regex" in e.lower() for e in errors)

    def test_missing_expected_fields(self):
        """Missing expected_fields produces an error."""
        extractor = PantheonExtractor()
        config = _pantheons_config()
        del config["expected_fields"]

        errors = extractor.validate_config(config)
        assert any("expected_fields" in e for e in errors)


class TestPantheonExtractorEdgeCases:
    """Edge case tests."""

    def test_single_pantheon(self):
        """Extraction works with just one pantheon in the text."""
        text = (
            "--- Page 10 ---\n"
            "Pantheons\n"
            "\n"
            "\u00c6sir \u2014 Norse\n"
            "Gods of battle and wisdom.\n"
            "\n"
            "Asset Skills: Close Combat, Occult\n"
            "\n"
            "Thor\n"
            "Callings: Guardian, Warrior\n"
            "Purviews: Sky, Epic Strength\n"
        )
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract(text, spec, config)
        assert result.entry_count == 1
        assert "aesir" in result.entries

    def test_pantheon_with_no_deities(self):
        """A pantheon with no deity entries still gets extracted."""
        text = (
            "--- Page 10 ---\n"
            "Pantheons\n"
            "\n"
            "Orisha \u2014 Yoruba\n"
            "The divine spirits of the Yoruba people.\n"
            "\n"
            "Asset Skills: Empathy, Leadership\n"
        )
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract(text, spec, config)
        assert result.entry_count == 1
        orisha = result.entries["orisha"]
        assert orisha["deities"] == []
        # Should log that no deities were found
        assert any(le.field == "deities" for le in result.log)

    def test_pantheon_with_no_asset_skills(self):
        """A pantheon without Asset Skills line logs the issue."""
        text = (
            "--- Page 10 ---\n"
            "Pantheons\n"
            "\n"
            "Kami \u2014 Japanese\n"
            "The nature spirits of Shinto tradition.\n"
            "\n"
            "Amaterasu\n"
            "Callings: Leader, Sage\n"
            "Purviews: Sun, Artistry\n"
        )
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract(text, spec, config)
        assert result.entry_count == 1
        kami = result.entries["kami"]
        assert kami["assetSkills"] == []
        assert any(le.field == "assetSkills" for le in result.log)

    def test_no_page_markers_defaults_to_1(self):
        """When no page markers exist, page defaults to 1."""
        text = (
            "Pantheons\n"
            "\n"
            "Theoi \u2014 Greek\n"
            "Olympic gods of ancient Greece.\n"
            "\n"
            "Asset Skills: Athletics, Empathy\n"
        )
        extractor = PantheonExtractor()
        spec = _make_spec()
        config = _pantheons_config()

        result = extractor.extract(text, spec, config)
        assert result.entry_count == 1
        assert "p.1" in result.entries["theoi"]["source"]


class TestToCamelCaseId:
    """Tests for the _to_camel_case_id helper function."""

    def test_simple_name(self):
        assert _to_camel_case_id("Odin") == "odin"

    def test_multi_word(self):
        assert _to_camel_case_id("Epic Stamina") == "epicStamina"

    def test_special_chars_aesir(self):
        assert _to_camel_case_id("\u00c6sir") == "aesir"

    def test_accented_chars(self):
        assert _to_camel_case_id("Ska\u00f0i") == "skadi"

    def test_pantheon_heading_strips_tradition(self):
        assert _to_camel_case_id("\u00c6sir \u2014 Norse") == "aesir"

    def test_hyphenated_name_keeps_parts(self):
        assert _to_camel_case_id("Susano-o") == "susanoo"

    def test_en_dash_heading(self):
        assert _to_camel_case_id("Theoi \u2013 Greek") == "theoi"
