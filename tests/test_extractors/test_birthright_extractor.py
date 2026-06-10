"""Unit tests for the birthright extractor.

Tests cover:
- Heading pattern matching for all birthright types
- Creature stat block extraction (Primary Pool, Defense, Health)
- Relic detail extraction (purview, tags, evocation, motifs)
- Point cost from dot notation (• count)
- Source field format (filename p.N)
- Config validation
- Graceful handling of missing sections
"""

from __future__ import annotations

import pytest

from extractors.birthright_extractor import (
    BirthrightExtractor,
    _count_dots,
    _extract_evocation,
    _extract_motifs_and_tags,
    _extract_purview_id,
    _extract_tags,
    _find_page_number,
    _to_camel_case,
)
from parser_framework.models import BookSpec


@pytest.fixture
def extractor() -> BirthrightExtractor:
    return BirthrightExtractor()


@pytest.fixture
def basic_spec() -> BookSpec:
    return BookSpec(
        book_id="test_book",
        filenames=["Test_Book.pdf"],
        output_path="src/data/_extracted/test_book.txt",
        section_anchors=[],
        heading_patterns=[],
        expected_fields=[],
        pipeline_stages=["ingest", "extract"],
    )


@pytest.fixture
def birthright_config() -> dict:
    return {
        "section_anchors": [{"pattern": "Birthrights", "pattern_type": "literal"}],
        "heading_pattern": {
            "regex": r"^(?P<name>.+?)\s*\((?P<type>Relic|Creature|Follower|Guide|Cult)\)",
            "flags": ["MULTILINE"],
        },
        "stat_block_pattern": r"Primary Pool:\s*(?P<primaryPool>\d+).*?Defense:\s*(?P<defense>\d+).*?Health:\s*(?P<health>\d+)",
        "expected_fields": [
            "id",
            "name",
            "birthrightType",
            "pointCost",
            "description",
            "mechanicalEffects",
            "source",
        ],
    }


class TestHelperFunctions:
    """Tests for module-level helper functions."""

    def test_to_camel_case_simple(self):
        assert _to_camel_case("Thunder Hammer") == "thunderHammer"

    def test_to_camel_case_single_word(self):
        assert _to_camel_case("Mjolnir") == "mjolnir"

    def test_to_camel_case_with_punctuation(self):
        assert _to_camel_case("Sun's Chariot") == "sunsChariot"

    def test_to_camel_case_empty(self):
        assert _to_camel_case("") == ""

    def test_count_dots_bullet(self):
        assert _count_dots("••") == 2

    def test_count_dots_filled_circle(self):
        assert _count_dots("●●●") == 3

    def test_count_dots_none(self):
        assert _count_dots("no dots here") == 0

    def test_count_dots_mixed_text(self):
        assert _count_dots("Rating •••• (4 dots)") == 4

    def test_find_page_number_with_markers(self):
        text = "--- Page 5 ---\nSome text\n--- Page 6 ---\nMore text\n--- Page 7 ---\nLast"
        # Position in "More text" is after page 6 marker
        pos = text.find("More text")
        assert _find_page_number(text, pos) == 6

    def test_find_page_number_no_markers(self):
        text = "Just plain text without any markers"
        assert _find_page_number(text, 10) == 1

    def test_extract_purview_id_structured(self):
        text = "Purview: Fire\nSome other text"
        assert _extract_purview_id(text) == "fire"

    def test_extract_purview_id_plural(self):
        text = "Purviews: Chaos\nKnack: Do something"
        assert _extract_purview_id(text) == "chaos"

    def test_extract_purview_id_none(self):
        text = "Just a regular description with no purview reference at all."
        assert _extract_purview_id(text) == ""

    def test_extract_tags_basic(self):
        text = "Tags: Ranged (0), Lethal (2)"
        tags = _extract_tags(text)
        assert "ranged" in tags
        assert "lethal" in tags

    def test_extract_tags_none(self):
        text = "No tag info here."
        assert _extract_tags(text) == []

    def test_extract_evocation_found(self):
        text = "Evocation: The hammer crackles with divine lightning.\n\nOther stuff."
        assert "hammer crackles" in _extract_evocation(text)

    def test_extract_evocation_not_found(self):
        text = "Just regular text."
        assert _extract_evocation(text) == ""

    def test_extract_motifs_and_tags_found(self):
        text = "Motif: Storms and thunder follow the wielder.\nKnack: Some ability."
        assert "Storms and thunder" in _extract_motifs_and_tags(text)

    def test_extract_motifs_and_tags_not_found(self):
        text = "No motif here."
        assert _extract_motifs_and_tags(text) == ""


class TestBirthrightExtractorValidateConfig:
    """Tests for validate_config method."""

    def test_valid_config(self, extractor, birthright_config):
        errors = extractor.validate_config(birthright_config)
        assert errors == []

    def test_missing_section_anchors(self, extractor):
        config = {
            "heading_pattern": {
                "regex": r"^(?P<name>.+?)\s*\((?P<type>Relic|Creature)\)",
                "flags": ["MULTILINE"],
            },
        }
        errors = extractor.validate_config(config)
        assert any("section_anchors" in e for e in errors)

    def test_missing_heading_pattern(self, extractor):
        config = {
            "section_anchors": [{"pattern": "Birthrights", "pattern_type": "literal"}],
        }
        errors = extractor.validate_config(config)
        assert any("heading_pattern" in e for e in errors)

    def test_heading_pattern_missing_name_group(self, extractor):
        config = {
            "section_anchors": [{"pattern": "Birthrights", "pattern_type": "literal"}],
            "heading_pattern": {
                "regex": r"^(.+?)\s*\((?P<type>Relic|Creature)\)",
                "flags": ["MULTILINE"],
            },
        }
        errors = extractor.validate_config(config)
        assert any("name" in e for e in errors)

    def test_heading_pattern_missing_type_group(self, extractor):
        config = {
            "section_anchors": [{"pattern": "Birthrights", "pattern_type": "literal"}],
            "heading_pattern": {
                "regex": r"^(?P<name>.+?)\s*\((Relic|Creature)\)",
                "flags": ["MULTILINE"],
            },
        }
        errors = extractor.validate_config(config)
        assert any("type" in e for e in errors)

    def test_invalid_regex(self, extractor):
        config = {
            "section_anchors": [{"pattern": "Birthrights", "pattern_type": "literal"}],
            "heading_pattern": {
                "regex": r"^(?P<name>.+?\((?P<type>Relic)",  # Unbalanced parens
                "flags": ["MULTILINE"],
            },
        }
        errors = extractor.validate_config(config)
        assert any("invalid" in e.lower() for e in errors)

    def test_invalid_stat_block_pattern(self, extractor):
        config = {
            "section_anchors": [{"pattern": "Birthrights", "pattern_type": "literal"}],
            "heading_pattern": {
                "regex": r"^(?P<name>.+?)\s*\((?P<type>Relic|Creature)\)",
                "flags": ["MULTILINE"],
            },
            "stat_block_pattern": r"[invalid regex(",
        }
        errors = extractor.validate_config(config)
        assert any("stat_block_pattern" in e for e in errors)


class TestBirthrightExtractorExtract:
    """Tests for the extract method."""

    def test_extracts_relic_entry(self, extractor, basic_spec, birthright_config):
        text = (
            "--- Page 10 ---\n"
            "Birthrights\n"
            "The following are sample birthrights.\n\n"
            "Mjolnir (Relic) ••••\n"
            "The legendary hammer of Thor, crackling with divine lightning.\n"
            "Purview: Sky\n"
            "Motif: Thunder and storm.\n"
            "Evocation: Summon a bolt of lightning.\n"
        )
        result = extractor.extract(text, basic_spec, birthright_config)
        assert result.category == "birthrights"
        assert result.entry_count == 1

        entry = list(result.entries.values())[0]
        assert entry["name"] == "Mjolnir"
        assert entry["birthrightType"] == "relic"
        assert entry["pointCost"] == 4
        assert "relicDetails" in entry
        assert entry["relicDetails"]["purviewId"] == "sky"
        assert "source" in entry
        assert "p.10" in entry["source"]

    def test_extracts_creature_entry(self, extractor, basic_spec, birthright_config):
        text = (
            "--- Page 20 ---\n"
            "Birthrights\n\n"
            "Fenrir's Pup (Creature) ••\n"
            "A young wolf descended from the great beast.\n"
            "Primary Pool: 7\n"
            "Defense: 3\n"
            "Health: 5\n"
            "Tags: Fierce, Loyal\n"
        )
        result = extractor.extract(text, basic_spec, birthright_config)
        assert result.entry_count == 1

        entry = list(result.entries.values())[0]
        assert entry["birthrightType"] == "creature"
        assert entry["pointCost"] == 2
        assert "creatureDetails" in entry
        assert entry["creatureDetails"]["primaryPool"] == 7
        assert entry["creatureDetails"]["defense"] == 3
        assert entry["creatureDetails"]["health"] == 5

    def test_extracts_follower_entry(self, extractor, basic_spec, birthright_config):
        text = (
            "--- Page 15 ---\n"
            "Birthrights\n\n"
            "Band of Warriors (Follower) •••\n"
            "A loyal retinue of mortal warriors who serve the Scion.\n"
        )
        result = extractor.extract(text, basic_spec, birthright_config)
        assert result.entry_count == 1

        entry = list(result.entries.values())[0]
        assert entry["name"] == "Band of Warriors"
        assert entry["birthrightType"] == "follower"
        assert entry["pointCost"] == 3

    def test_extracts_guide_entry(self, extractor, basic_spec, birthright_config):
        text = (
            "--- Page 25 ---\n"
            "Birthrights\n\n"
            "Ancestor Spirit (Guide) ••\n"
            "A wise ancestor who appears in dreams to offer counsel.\n"
        )
        result = extractor.extract(text, basic_spec, birthright_config)
        assert result.entry_count == 1

        entry = list(result.entries.values())[0]
        assert entry["name"] == "Ancestor Spirit"
        assert entry["birthrightType"] == "guide"
        assert entry["pointCost"] == 2

    def test_extracts_cult_entry(self, extractor, basic_spec, birthright_config):
        text = (
            "--- Page 30 ---\n"
            "Birthrights\n\n"
            "Street Shrine Network (Cult) ••\n"
            "A network of hidden shrines tended by urban devotees.\n"
        )
        result = extractor.extract(text, basic_spec, birthright_config)
        assert result.entry_count == 1

        entry = list(result.entries.values())[0]
        assert entry["name"] == "Street Shrine Network"
        assert entry["birthrightType"] == "cult"
        assert entry["pointCost"] == 2

    def test_extracts_multiple_entries(self, extractor, basic_spec, birthright_config):
        text = (
            "--- Page 10 ---\n"
            "Birthrights\n\n"
            "Excalibur (Relic) •••••\n"
            "The sword of kings.\n"
            "Purview: War\n\n"
            "Shadow Wolf (Creature) •••\n"
            "A dark wolf companion.\n"
            "Primary Pool: 8\n"
            "Defense: 4\n"
            "Health: 6\n\n"
            "Old Sage (Guide) •\n"
            "A wizened mentor.\n"
        )
        result = extractor.extract(text, basic_spec, birthright_config)
        assert result.entry_count == 3

        types = {e["birthrightType"] for e in result.entries.values()}
        assert "relic" in types
        assert "creature" in types
        assert "guide" in types

    def test_empty_section_returns_empty_result(self, extractor, basic_spec, birthright_config):
        text = "--- Page 1 ---\nSome irrelevant text without any birthrights section."
        result = extractor.extract(text, basic_spec, birthright_config)
        assert result.entry_count == 0
        assert result.entries == {}
        # Should log the missing section
        assert any(log.reason == "anchor_not_found" for log in result.log)

    def test_no_headings_in_section_returns_empty(self, extractor, basic_spec, birthright_config):
        text = (
            "--- Page 1 ---\n"
            "Birthrights\n"
            "Just some text with no valid heading patterns at all.\n"
            "Nothing matches here.\n"
        )
        result = extractor.extract(text, basic_spec, birthright_config)
        assert result.entry_count == 0
        assert any(log.reason == "heading_unmatched" for log in result.log)

    def test_source_field_format(self, extractor, basic_spec, birthright_config):
        text = (
            "--- Page 42 ---\n"
            "Birthrights\n\n"
            "Holy Grail (Relic) •••\n"
            "A sacred cup of legend.\n"
        )
        result = extractor.extract(text, basic_spec, birthright_config)
        entry = list(result.entries.values())[0]
        assert entry["source"] == "Test_Book.pdf p.42"

    def test_point_cost_defaults_to_one(self, extractor, basic_spec, birthright_config):
        text = (
            "--- Page 5 ---\n"
            "Birthrights\n\n"
            "Simple Token (Relic)\n"
            "A minor trinket with no dot rating listed.\n"
        )
        result = extractor.extract(text, basic_spec, birthright_config)
        entry = list(result.entries.values())[0]
        assert entry["pointCost"] == 1

    def test_creature_without_stat_block_logs_warning(self, extractor, basic_spec, birthright_config):
        text = (
            "--- Page 5 ---\n"
            "Birthrights\n\n"
            "Mystery Beast (Creature) ••\n"
            "A creature with no stat block written.\n"
        )
        result = extractor.extract(text, basic_spec, birthright_config)
        entry = list(result.entries.values())[0]
        assert entry["creatureDetails"]["primaryPool"] == 0
        assert entry["creatureDetails"]["defense"] == 0
        assert entry["creatureDetails"]["health"] == 0
        # Should log that stat block wasn't found
        assert any(
            log.reason == "not_found" and "stat block" in (log.detail or "").lower()
            for log in result.log
        )

    def test_relic_details_structure(self, extractor, basic_spec, birthright_config):
        text = (
            "--- Page 10 ---\n"
            "Birthrights\n\n"
            "Sun Amulet (Relic) •••\n"
            "A golden amulet glowing with solar power.\n"
            "Purview: Sun\n"
            "Motif: Light conquers darkness.\n"
            "Evocation: Blind your foes with radiance.\n"
            "Tags: Shining, Warm\n"
        )
        result = extractor.extract(text, basic_spec, birthright_config)
        entry = list(result.entries.values())[0]
        relic = entry["relicDetails"]
        assert relic["rating"] == 3
        assert relic["purviewId"] == "sun"
        assert relic["purviewRating"] == 1
        assert "Light conquers darkness" in relic["motifsAndTags"]
        assert "Blind your foes" in relic["evocation"]
        assert len(relic["tagIds"]) == 2


class TestBirthrightExtractorRegistry:
    """Tests for registry integration."""

    def test_registered_in_registry(self):
        from extractors import EXTRACTOR_REGISTRY

        assert "birthrights" in EXTRACTOR_REGISTRY
        assert EXTRACTOR_REGISTRY["birthrights"] is BirthrightExtractor

    def test_is_category_extractor_subclass(self):
        from extractors import CategoryExtractor

        assert issubclass(BirthrightExtractor, CategoryExtractor)
