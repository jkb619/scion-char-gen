"""Unit tests for the calling category extractor.

Tests cover:
- Extraction of calling entries from well-structured text
- Section anchor matching (literal and regex)
- Heading pattern splitting
- Description and mechanical effects parsing
- ID derivation from name (lowercase)
- Source provenance with page markers
- Graceful handling of missing sections and empty text
- Config validation
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Ensure src/scripts is importable
_SCRIPTS_DIR = Path(__file__).resolve().parents[2] / "src" / "scripts"
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from extractors.calling_extractor import CallingExtractor
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


def _callings_config() -> dict:
    """Standard callings category config matching the design spec."""
    return {
        "output_path": "src/data/callings.json",
        "section_anchors": [
            {"pattern": "Callings", "pattern_type": "literal"},
        ],
        "heading_pattern": {
            "regex": r"^(?P<name>Creator|Guardian|Healer|Hunter|Judge|Liminal|Lover|Sage|Trickster|Warrior)$",
            "flags": ["MULTILINE"],
        },
        "expected_fields": [
            "id",
            "name",
            "description",
            "mechanicalEffects",
            "source",
        ],
    }


# Sample text simulating ingested PDF output with page markers
_SAMPLE_TEXT = """\
--- Page 95 ---
Some introductory chapter content here.

--- Page 98 ---
Callings

Each Scion has a Calling that defines their archetypal role.

--- Page 99 ---
Creator

Builders, makers, inventors—those who shape things that last.

Knacks: Creator Knacks allow you to craft items and solve problems creatively.

Guardian

Protectors who stand between harm and what they value.

Knacks: Guardian Knacks help you defend allies and hold the line.

--- Page 100 ---
Healer

Those who mend bodies, minds, and communities.

Knacks: Healer Knacks let you restore health and morale.
"""


class TestCallingExtractorExtract:
    """Tests for the extract method."""

    def test_basic_extraction(self):
        """Extracts callings with correct id, name, description, and source."""
        extractor = CallingExtractor()
        spec = _make_spec()
        config = _callings_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        assert result.category == "callings"
        assert result.entry_count == 3
        assert "creator" in result.entries
        assert "guardian" in result.entries
        assert "healer" in result.entries

    def test_id_derived_from_name_lowercase(self):
        """The id field is the name lowercased."""
        extractor = CallingExtractor()
        spec = _make_spec()
        config = _callings_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        for entry_id, entry in result.entries.items():
            assert entry["id"] == entry["name"].lower()

    def test_source_format(self):
        """Source field matches '<filename> p.<N>' format."""
        extractor = CallingExtractor()
        spec = _make_spec()
        config = _callings_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        import re
        source_pattern = re.compile(r"^.+ p\.\d+$")
        for entry in result.entries.values():
            assert source_pattern.match(entry["source"]), f"Bad source: {entry['source']}"

    def test_source_uses_first_filename(self):
        """Source field uses the first filename from the spec."""
        extractor = CallingExtractor()
        spec = _make_spec()
        config = _callings_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        for entry in result.entries.values():
            assert entry["source"].startswith("Scion_Origin.pdf")

    def test_description_extracted(self):
        """Description is non-empty for each calling."""
        extractor = CallingExtractor()
        spec = _make_spec()
        config = _callings_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        creator = result.entries["creator"]
        assert "Builders" in creator["description"] or "makers" in creator["description"]

    def test_page_number_from_marker(self):
        """Page number is extracted from the nearest preceding page marker."""
        extractor = CallingExtractor()
        spec = _make_spec()
        config = _callings_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        # Creator appears after "--- Page 99 ---"
        creator = result.entries["creator"]
        assert "p.99" in creator["source"] or "p.98" in creator["source"]

    def test_empty_text_returns_empty_result(self):
        """Empty text produces zero entries with no exceptions."""
        extractor = CallingExtractor()
        spec = _make_spec()
        config = _callings_config()

        result = extractor.extract("", spec, config)

        assert result.entry_count == 0
        assert result.entries == {}

    def test_no_callings_section_returns_empty(self):
        """Text without a Callings section returns empty result."""
        extractor = CallingExtractor()
        spec = _make_spec()
        config = _callings_config()

        text = "Some unrelated text\nNothing about this topic here\n"
        result = extractor.extract(text, spec, config)

        assert result.entry_count == 0
        assert len(result.log) > 0  # Should log anchor not found

    def test_regex_section_anchor(self):
        """Regex pattern_type anchors work correctly."""
        extractor = CallingExtractor()
        spec = _make_spec()
        config = _callings_config()
        config["section_anchors"] = [
            {"pattern": r"^Callings$", "pattern_type": "regex"},
        ]

        result = extractor.extract(_SAMPLE_TEXT, spec, config)
        assert result.entry_count == 3

    def test_entry_has_all_expected_fields(self):
        """Each entry has id, name, description, mechanicalEffects, and source."""
        extractor = CallingExtractor()
        spec = _make_spec()
        config = _callings_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        expected_keys = {"id", "name", "description", "mechanicalEffects", "source"}
        for entry in result.entries.values():
            assert set(entry.keys()) == expected_keys


class TestCallingExtractorValidateConfig:
    """Tests for the validate_config method."""

    def test_valid_config_no_errors(self):
        """A valid config returns an empty error list."""
        extractor = CallingExtractor()
        config = _callings_config()

        errors = extractor.validate_config(config)
        assert errors == []

    def test_missing_section_anchors(self):
        """Missing section_anchors produces an error."""
        extractor = CallingExtractor()
        config = _callings_config()
        del config["section_anchors"]

        errors = extractor.validate_config(config)
        assert any("section_anchors" in e for e in errors)

    def test_empty_section_anchors(self):
        """Empty section_anchors list produces an error."""
        extractor = CallingExtractor()
        config = _callings_config()
        config["section_anchors"] = []

        errors = extractor.validate_config(config)
        assert any("section_anchors" in e for e in errors)

    def test_missing_heading_pattern(self):
        """Missing heading_pattern produces an error."""
        extractor = CallingExtractor()
        config = _callings_config()
        del config["heading_pattern"]

        errors = extractor.validate_config(config)
        assert any("heading_pattern" in e for e in errors)

    def test_invalid_heading_regex(self):
        """Invalid regex in heading_pattern produces an error."""
        extractor = CallingExtractor()
        config = _callings_config()
        config["heading_pattern"] = {"regex": "[invalid(", "flags": []}

        errors = extractor.validate_config(config)
        assert any("invalid" in e.lower() or "regex" in e.lower() for e in errors)

    def test_missing_expected_fields(self):
        """Missing expected_fields produces an error."""
        extractor = CallingExtractor()
        config = _callings_config()
        del config["expected_fields"]

        errors = extractor.validate_config(config)
        assert any("expected_fields" in e for e in errors)


class TestCallingExtractorEdgeCases:
    """Edge case tests."""

    def test_single_calling(self):
        """Extraction works with just one calling in the text."""
        text = """\
--- Page 10 ---
Callings

Creator

The maker and builder of the world.

Knacks: Creative knacks allow crafting.
"""
        extractor = CallingExtractor()
        spec = _make_spec()
        config = _callings_config()
        # Narrow heading pattern to just Creator
        config["heading_pattern"]["regex"] = r"^(?P<name>Creator)$"

        result = extractor.extract(text, spec, config)
        assert result.entry_count == 1
        assert "creator" in result.entries

    def test_calling_with_no_mechanical_effects(self):
        """A calling with only description and no mechanical text."""
        text = """\
--- Page 5 ---
Callings

Hunter

Trackers and predators—literal or metaphorical.
"""
        extractor = CallingExtractor()
        spec = _make_spec()
        config = _callings_config()
        config["heading_pattern"]["regex"] = r"^(?P<name>Hunter)$"

        result = extractor.extract(text, spec, config)
        assert result.entry_count == 1
        hunter = result.entries["hunter"]
        assert hunter["description"] != ""

    def test_no_page_markers_defaults_to_1(self):
        """When no page markers exist, page defaults to 1."""
        text = """\
Callings

Warrior

Those who meet conflict head-on as a way of life.

Knacks: Warrior Knacks enhance combat ability.
"""
        extractor = CallingExtractor()
        spec = _make_spec()
        config = _callings_config()
        config["heading_pattern"]["regex"] = r"^(?P<name>Warrior)$"

        result = extractor.extract(text, spec, config)
        assert result.entry_count == 1
        assert "p.1" in result.entries["warrior"]["source"]
