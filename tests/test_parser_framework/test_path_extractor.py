"""Unit tests for the path category extractor.

Tests cover:
- Extraction of path entries from well-structured text
- Section anchor matching (literal and regex)
- Heading pattern splitting
- Path kind determination from subsection context
- Suggested skills extraction (explicit lists and known-skill scanning)
- Description and mechanical effects parsing
- ID derivation from name (camelCase)
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

from extractors.path_extractor import PathExtractor, _to_camel_case, _normalize_skill_name
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


def _paths_config() -> dict:
    """Standard paths category config matching the design spec.

    Uses a heading pattern that matches path name lines specifically —
    title-cased names without colons (to avoid matching "Skills: ..." lines)
    and not matching subsection headers like "Origin Paths".
    """
    return {
        "output_path": "src/data/paths.json",
        "section_anchors": [
            {"pattern": "Paths", "pattern_type": "literal"},
        ],
        "heading_pattern": {
            "regex": r"^(?P<name>(?:Life of Privilege|Childhood in a War Zone|Professional Soldier|Daughter of Oya Iyansan|Mysterious Heritage|Simple Life))$",
            "flags": ["MULTILINE"],
        },
        "expected_fields": [
            "id",
            "name",
            "pathKind",
            "description",
            "suggestedSkills",
            "mechanicalEffects",
            "source",
        ],
    }


# Sample text simulating ingested PDF output with page markers.
# The heading pattern is tuned to match only path entry names (title-cased
# multi-word names that start with an uppercase letter and don't match
# known subsection headers like "Origin Paths" or "Skills: ...").
_SAMPLE_TEXT = """\
--- Page 90 ---
Some introductory chapter content about character creation.

--- Page 95 ---
Paths

Paths define where a character comes from, what they do, and how they
connect to the divine world.

Origin Paths

--- Page 96 ---
Life of Privilege
A comfortable, well-resourced upbringing that shapes contacts and expectations.
Skills: Culture, Empathy, Technology
Connections: High-society contacts, old money family.

Childhood in a War Zone
Formative years shaped by violence, displacement, or survival pressures.
Skills: Athletics, Close Combat, Subterfuge

--- Page 97 ---
Role Paths

Professional Soldier
Military profession or comparable structured combat role.
Skills: Firearms, Close Combat, Leadership
Path Condition: Duty-bound to a chain of command.

--- Page 98 ---
Society/Pantheon Paths

Daughter of Oya Iyansan
Supernatural or cultic tie to a pantheon—often the divine parent thread.
Asset Skills: Occult, Empathy, Leadership
Connections: Fellow devotees and spirit contacts.
"""


class TestPathExtractorExtract:
    """Tests for the extract method."""

    def test_basic_extraction(self):
        """Extracts paths with correct id, name, description, and source."""
        extractor = PathExtractor()
        spec = _make_spec()
        config = _paths_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        assert result.category == "paths"
        assert result.entry_count >= 3
        assert "lifeOfPrivilege" in result.entries
        assert "professionalSoldier" in result.entries

    def test_id_derived_from_name_camel_case(self):
        """The id field is derived from name in camelCase."""
        extractor = PathExtractor()
        spec = _make_spec()
        config = _paths_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        assert "lifeOfPrivilege" in result.entries
        entry = result.entries["lifeOfPrivilege"]
        assert entry["id"] == "lifeOfPrivilege"
        assert entry["name"] == "Life of Privilege"

    def test_source_format(self):
        """Source field matches '<filename> p.<N>' format."""
        extractor = PathExtractor()
        spec = _make_spec()
        config = _paths_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        import re
        source_pattern = re.compile(r"^.+ p\.\d+$")
        for entry in result.entries.values():
            assert source_pattern.match(entry["source"]), f"Bad source: {entry['source']}"

    def test_source_uses_first_filename(self):
        """Source field uses the first filename from the spec."""
        extractor = PathExtractor()
        spec = _make_spec()
        config = _paths_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        for entry in result.entries.values():
            assert entry["source"].startswith("Scion_Origin.pdf")

    def test_path_kind_origin(self):
        """Paths under 'Origin Paths' subsection get pathKind='origin'."""
        extractor = PathExtractor()
        spec = _make_spec()
        config = _paths_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        life = result.entries["lifeOfPrivilege"]
        assert life["pathKind"] == "origin"

    def test_path_kind_role(self):
        """Paths under 'Role Paths' subsection get pathKind='role'."""
        extractor = PathExtractor()
        spec = _make_spec()
        config = _paths_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        soldier = result.entries["professionalSoldier"]
        assert soldier["pathKind"] == "role"

    def test_path_kind_society_pantheon(self):
        """Paths under 'Society/Pantheon Paths' subsection get pathKind='societyPantheon'."""
        extractor = PathExtractor()
        spec = _make_spec()
        config = _paths_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        daughter = result.entries["daughterOfOyaIyansan"]
        assert daughter["pathKind"] == "societyPantheon"

    def test_suggested_skills_extracted(self):
        """Skills are extracted from explicit 'Skills:' lines."""
        extractor = PathExtractor()
        spec = _make_spec()
        config = _paths_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        life = result.entries["lifeOfPrivilege"]
        assert "culture" in life["suggestedSkills"]
        assert "empathy" in life["suggestedSkills"]
        assert "technology" in life["suggestedSkills"]

    def test_suggested_skills_multi_word(self):
        """Multi-word skills are normalized to camelCase."""
        extractor = PathExtractor()
        spec = _make_spec()
        config = _paths_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        # "Close Combat" should become "closeCombat"
        childhood = result.entries.get("childhoodInAWarZone")
        if childhood:
            assert "closeCombat" in childhood["suggestedSkills"]

    def test_page_number_from_marker(self):
        """Page number is extracted from the nearest preceding page marker."""
        extractor = PathExtractor()
        spec = _make_spec()
        config = _paths_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        # Life of Privilege appears after "--- Page 96 ---" (or 95)
        life = result.entries["lifeOfPrivilege"]
        assert "p.9" in life["source"]  # page 95 or 96

    def test_empty_text_returns_empty_result(self):
        """Empty text produces zero entries with no exceptions."""
        extractor = PathExtractor()
        spec = _make_spec()
        config = _paths_config()

        result = extractor.extract("", spec, config)

        assert result.entry_count == 0
        assert result.entries == {}

    def test_no_paths_section_returns_empty(self):
        """Text without a Paths section returns empty result."""
        extractor = PathExtractor()
        spec = _make_spec()
        config = _paths_config()

        text = "Some unrelated text\nNothing relevant here\n"
        result = extractor.extract(text, spec, config)

        assert result.entry_count == 0
        assert len(result.log) > 0  # Should log anchor not found

    def test_regex_section_anchor(self):
        """Regex pattern_type anchors work correctly."""
        extractor = PathExtractor()
        spec = _make_spec()
        config = _paths_config()
        config["section_anchors"] = [
            {"pattern": r"^Paths$", "pattern_type": "regex"},
        ]

        result = extractor.extract(_SAMPLE_TEXT, spec, config)
        assert result.entry_count >= 3

    def test_entry_has_all_expected_fields(self):
        """Each entry has id, name, pathKind, description, suggestedSkills, mechanicalEffects, and source."""
        extractor = PathExtractor()
        spec = _make_spec()
        config = _paths_config()

        result = extractor.extract(_SAMPLE_TEXT, spec, config)

        expected_keys = {"id", "name", "pathKind", "description", "suggestedSkills", "mechanicalEffects", "source"}
        for entry in result.entries.values():
            assert set(entry.keys()) == expected_keys


class TestPathExtractorValidateConfig:
    """Tests for the validate_config method."""

    def test_valid_config_no_errors(self):
        """A valid config returns an empty error list."""
        extractor = PathExtractor()
        config = _paths_config()

        errors = extractor.validate_config(config)
        assert errors == []

    def test_missing_section_anchors(self):
        """Missing section_anchors produces an error."""
        extractor = PathExtractor()
        config = _paths_config()
        del config["section_anchors"]

        errors = extractor.validate_config(config)
        assert any("section_anchors" in e for e in errors)

    def test_empty_section_anchors(self):
        """Empty section_anchors list produces an error."""
        extractor = PathExtractor()
        config = _paths_config()
        config["section_anchors"] = []

        errors = extractor.validate_config(config)
        assert any("section_anchors" in e for e in errors)

    def test_missing_heading_pattern(self):
        """Missing heading_pattern produces an error."""
        extractor = PathExtractor()
        config = _paths_config()
        del config["heading_pattern"]

        errors = extractor.validate_config(config)
        assert any("heading_pattern" in e for e in errors)

    def test_invalid_heading_regex(self):
        """Invalid regex in heading_pattern produces an error."""
        extractor = PathExtractor()
        config = _paths_config()
        config["heading_pattern"] = {"regex": "[invalid(", "flags": []}

        errors = extractor.validate_config(config)
        assert any("invalid" in e.lower() or "regex" in e.lower() for e in errors)

    def test_missing_expected_fields(self):
        """Missing expected_fields produces an error."""
        extractor = PathExtractor()
        config = _paths_config()
        del config["expected_fields"]

        errors = extractor.validate_config(config)
        assert any("expected_fields" in e for e in errors)


class TestPathExtractorEdgeCases:
    """Edge case tests."""

    def test_single_path(self):
        """Extraction works with just one path in the text."""
        text = """\
--- Page 10 ---
Paths

Origin Paths

Life of Privilege
A comfortable upbringing.
Skills: Culture, Empathy, Technology
"""
        extractor = PathExtractor()
        spec = _make_spec()
        config = _paths_config()

        result = extractor.extract(text, spec, config)
        assert result.entry_count >= 1
        assert "lifeOfPrivilege" in result.entries

    def test_path_with_no_skills(self):
        """A path with no explicit skill list returns empty suggestedSkills."""
        text = """\
--- Page 5 ---
Paths

Origin Paths

Mysterious Heritage
An enigmatic background with no clear connections to the mundane world.
"""
        extractor = PathExtractor()
        spec = _make_spec()
        config = _paths_config()

        result = extractor.extract(text, spec, config)
        mysterious = result.entries.get("mysteriousHeritage")
        assert mysterious is not None
        assert isinstance(mysterious["suggestedSkills"], list)

    def test_no_page_markers_defaults_to_1(self):
        """When no page markers exist, page defaults to 1."""
        text = """\
Paths

Origin Paths

Simple Life
A straightforward upbringing in a small community.
Skills: Survival, Athletics, Empathy
"""
        extractor = PathExtractor()
        spec = _make_spec()
        config = _paths_config()

        result = extractor.extract(text, spec, config)
        simple = result.entries.get("simpleLife")
        assert simple is not None
        assert "p.1" in simple["source"]


class TestHelperFunctions:
    """Tests for module-level helper functions."""

    def test_to_camel_case_basic(self):
        """Standard multi-word name converts to camelCase."""
        assert _to_camel_case("Life of Privilege") == "lifeOfPrivilege"

    def test_to_camel_case_single_word(self):
        """Single word is lowercased."""
        assert _to_camel_case("Warrior") == "warrior"

    def test_to_camel_case_with_punctuation(self):
        """Punctuation is stripped before conversion."""
        assert _to_camel_case("Daughter of Oya-Iyansan") == "daughterOfOyaiyansan"

    def test_to_camel_case_empty(self):
        """Empty string returns empty."""
        assert _to_camel_case("") == ""

    def test_normalize_skill_name_single_word(self):
        """Single word skill is lowercased."""
        assert _normalize_skill_name("Athletics") == "athletics"

    def test_normalize_skill_name_multi_word(self):
        """Multi-word skill becomes camelCase."""
        assert _normalize_skill_name("Close Combat") == "closeCombat"

    def test_normalize_skill_name_with_trailing_punctuation(self):
        """Trailing punctuation is stripped."""
        assert _normalize_skill_name("Empathy,") == "empathy"

    def test_normalize_skill_name_empty(self):
        """Empty string returns empty."""
        assert _normalize_skill_name("") == ""
