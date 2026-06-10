"""Unit tests for the equipment extractor.

Tests cover:
- Tag notation parsing (e.g., "Tags: Ranged (0), Lethal (0)")
- Tag names to camelCase conversion
- Equipment type determination from context (section headings, keywords, tags)
- Heading pattern matching for equipment items
- Source field format (filename p.N)
- Config validation
- Graceful handling of missing sections
"""

from __future__ import annotations

import pytest

from extractors.equipment_extractor import (
    EquipmentExtractor,
    _determine_equipment_type_from_context,
    _determine_equipment_type_from_tags,
    _find_page_number,
    _parse_tags,
    _to_camel_case,
)
from parser_framework.models import BookSpec


@pytest.fixture
def extractor() -> EquipmentExtractor:
    return EquipmentExtractor()


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
def equipment_config() -> dict:
    return {
        "section_anchors": [{"pattern": "Equipment", "pattern_type": "literal"}],
        "heading_pattern": {
            "regex": r"^(?P<name>[A-Z].+)$",
            "flags": ["MULTILINE"],
        },
        "tag_pattern": r"Tags:\s*(?P<tags>.+)",
        "expected_fields": [
            "id",
            "name",
            "equipmentType",
            "tagIds",
            "description",
            "mechanicalEffects",
            "source",
        ],
    }


class TestHelperFunctions:
    """Tests for module-level helper functions."""

    def test_to_camel_case_simple(self):
        assert _to_camel_case("Soft Armor") == "softArmor"

    def test_to_camel_case_single_word(self):
        assert _to_camel_case("Ranged") == "ranged"

    def test_to_camel_case_hyphenated(self):
        assert _to_camel_case("Two-Handed") == "twoHanded"

    def test_to_camel_case_with_punctuation(self):
        assert _to_camel_case("Long Range") == "longRange"

    def test_to_camel_case_empty(self):
        assert _to_camel_case("") == ""

    def test_to_camel_case_multi_word(self):
        assert _to_camel_case("Concealable Weapon") == "concealableWeapon"

    def test_parse_tags_basic(self):
        result = _parse_tags("Ranged (0), Lethal (0)")
        assert result == ["ranged", "lethal"]

    def test_parse_tags_no_costs(self):
        result = _parse_tags("Melee, Sharp, Two-Handed")
        assert result == ["melee", "sharp", "twoHanded"]

    def test_parse_tags_mixed(self):
        result = _parse_tags("Soft Armor (1), Concealed")
        assert result == ["softArmor", "concealed"]

    def test_parse_tags_empty(self):
        result = _parse_tags("")
        assert result == []

    def test_parse_tags_whitespace_only(self):
        result = _parse_tags("   ")
        assert result == []

    def test_parse_tags_semicolons(self):
        result = _parse_tags("Lethal; Ranged (2); Heavy")
        assert result == ["lethal", "ranged", "heavy"]

    def test_find_page_number_with_markers(self):
        text = "--- Page 10 ---\nSome content\n--- Page 11 ---\nMore content"
        assert _find_page_number(text, 20) == 10
        assert _find_page_number(text, 40) == 11

    def test_find_page_number_no_markers(self):
        text = "Some text without page markers"
        assert _find_page_number(text, 5) == 1

    def test_determine_type_from_weapon_tags(self):
        assert _determine_equipment_type_from_tags(["lethal", "melee"]) == "weapon"

    def test_determine_type_from_armor_tags(self):
        assert _determine_equipment_type_from_tags(["softArmor", "concealed"]) == "armor"

    def test_determine_type_from_no_tags(self):
        assert _determine_equipment_type_from_tags([]) == ""

    def test_determine_type_from_unrelated_tags(self):
        assert _determine_equipment_type_from_tags(["versatile", "durable"]) == ""

    def test_determine_type_from_context_weapon_section(self):
        section_text = "Weapons\nSword\nA fine blade.\nTags: Lethal, Melee"
        result = _determine_equipment_type_from_context(
            "Sword\nA fine blade.", section_text, len("Weapons\n")
        )
        assert result == "weapon"

    def test_determine_type_from_context_armor_section(self):
        section_text = "Armor\nPlate Mail\nHeavy protection.\nTags: Hard Armor (1)"
        result = _determine_equipment_type_from_context(
            "Plate Mail\nHeavy protection.", section_text, len("Armor\n")
        )
        assert result == "armor"

    def test_determine_type_from_context_keyword_fallback(self):
        section_text = "Stuff\nA rifle for long-range firearm combat."
        result = _determine_equipment_type_from_context(
            "A rifle for long-range firearm combat.", section_text, len("Stuff\n")
        )
        assert result == "weapon"

    def test_determine_type_from_context_general_fallback(self):
        section_text = "Miscellaneous\nA rock."
        result = _determine_equipment_type_from_context(
            "A rock.", section_text, len("Miscellaneous\n")
        )
        assert result == "general"


class TestEquipmentExtractorValidateConfig:
    """Tests for config validation."""

    def test_valid_config(self, extractor, equipment_config):
        errors = extractor.validate_config(equipment_config)
        assert errors == []

    def test_missing_section_anchors(self, extractor):
        config = {
            "heading_pattern": {"regex": r"^(?P<name>[A-Z].+)$", "flags": ["MULTILINE"]},
        }
        errors = extractor.validate_config(config)
        assert any("section_anchors" in e for e in errors)

    def test_missing_heading_pattern(self, extractor):
        config = {
            "section_anchors": [{"pattern": "Equipment", "pattern_type": "literal"}],
        }
        errors = extractor.validate_config(config)
        assert any("heading_pattern" in e for e in errors)

    def test_heading_pattern_missing_name_group(self, extractor):
        config = {
            "section_anchors": [{"pattern": "Equipment", "pattern_type": "literal"}],
            "heading_pattern": {"regex": r"^([A-Z].+)$", "flags": ["MULTILINE"]},
        }
        errors = extractor.validate_config(config)
        assert any("name" in e for e in errors)

    def test_invalid_regex(self, extractor):
        config = {
            "section_anchors": [{"pattern": "Equipment", "pattern_type": "literal"}],
            "heading_pattern": {"regex": r"^(?P<name>[A-Z", "flags": ["MULTILINE"]},
        }
        errors = extractor.validate_config(config)
        assert any("invalid" in e for e in errors)

    def test_invalid_tag_pattern(self, extractor):
        config = {
            "section_anchors": [{"pattern": "Equipment", "pattern_type": "literal"}],
            "heading_pattern": {"regex": r"^(?P<name>[A-Z].+)$", "flags": ["MULTILINE"]},
            "tag_pattern": r"Tags:\s*(?P<wrong>[",
        }
        errors = extractor.validate_config(config)
        assert any("tag_pattern" in e for e in errors)

    def test_tag_pattern_missing_tags_group(self, extractor):
        config = {
            "section_anchors": [{"pattern": "Equipment", "pattern_type": "literal"}],
            "heading_pattern": {"regex": r"^(?P<name>[A-Z].+)$", "flags": ["MULTILINE"]},
            "tag_pattern": r"Tags:\s*(.+)",
        }
        errors = extractor.validate_config(config)
        assert any("tags" in e for e in errors)


class TestEquipmentExtractorExtract:
    """Tests for the extract method."""

    def test_extracts_weapon_entry(self, extractor, basic_spec, equipment_config):
        text = (
            "--- Page 5 ---\n"
            "Equipment\n\n"
            "Longsword\n"
            "A well-balanced blade suitable for combat.\n"
            "Tags: Lethal (0), Melee\n"
        )
        # Use a heading pattern that only matches single-line item names
        # (not sentences with lowercase words or "Tags:" lines)
        config = {**equipment_config, "heading_pattern": {
            "regex": r"^(?P<name>[A-Z][A-Za-z ]+)$",
            "flags": ["MULTILINE"],
        }}
        result = extractor.extract(text, basic_spec, config)
        # "Equipment" and "Longsword" match — and the section starts at "Equipment"
        # so "Equipment" itself becomes a heading entry; description for "Longsword"
        # should be the text between headings
        assert "longsword" in result.entries
        entry = result.entries["longsword"]
        assert entry["name"] == "Longsword"
        assert entry["equipmentType"] == "weapon"
        assert "lethal" in entry["tagIds"]
        assert "melee" in entry["tagIds"]
        assert entry["source"] == "Test_Book.pdf p.5"

    def test_extracts_armor_entry(self, extractor, basic_spec, equipment_config):
        text = (
            "--- Page 8 ---\n"
            "Equipment\n\n"
            "Tactical Vest\n"
            "A modern protective vest.\n"
            "Tags: Soft Armor (1), Concealed\n"
        )
        config = {**equipment_config, "heading_pattern": {
            "regex": r"^(?P<name>[A-Z][A-Za-z ]+)$",
            "flags": ["MULTILINE"],
        }}
        result = extractor.extract(text, basic_spec, config)
        assert "tacticalVest" in result.entries
        entry = result.entries["tacticalVest"]
        assert entry["equipmentType"] == "armor"
        assert "softArmor" in entry["tagIds"]
        assert "concealed" in entry["tagIds"]

    def test_extracts_multiple_entries(self, extractor, basic_spec, equipment_config):
        text = (
            "--- Page 10 ---\n"
            "Equipment\n\n"
            "Knife\n"
            "A small blade.\n"
            "Tags: Lethal, Melee, Thrown\n\n"
            "Battle Axe\n"
            "A heavy chopping weapon.\n"
            "Tags: Lethal (0), Melee, Heavy\n"
        )
        config = {**equipment_config, "heading_pattern": {
            "regex": r"^(?P<name>[A-Z][A-Za-z ]+)$",
            "flags": ["MULTILINE"],
        }}
        result = extractor.extract(text, basic_spec, config)
        assert "knife" in result.entries
        assert "battleAxe" in result.entries
        # Both should be weapon type
        assert result.entries["knife"]["equipmentType"] == "weapon"
        assert result.entries["battleAxe"]["equipmentType"] == "weapon"

    def test_empty_section_returns_empty_result(self, extractor, basic_spec, equipment_config):
        text = "--- Page 1 ---\nSome unrelated content without any Equipment section marker"
        # Use a section anchor that won't match any text
        config = {**equipment_config, "section_anchors": [
            {"pattern": "ZZZZ_NO_MATCH", "pattern_type": "literal"}
        ]}
        result = extractor.extract(text, basic_spec, config)
        assert result.entry_count == 0
        assert result.entries == {}

    def test_no_headings_in_section_returns_empty(self, extractor, basic_spec, equipment_config):
        # Heading pattern requires uppercase start but section has none after anchor
        text = "--- Page 1 ---\nEquipment\n\n123 not a heading\n456 also not"
        config = {**equipment_config, "heading_pattern": {
            "regex": r"^(?P<name>[A-Z][A-Za-z]+ [A-Z][A-Za-z]+)$",
            "flags": ["MULTILINE"],
        }}
        result = extractor.extract(text, basic_spec, config)
        assert result.entry_count == 0

    def test_source_field_format(self, extractor, basic_spec, equipment_config):
        text = (
            "--- Page 42 ---\n"
            "Equipment\n\n"
            "Crossbow\n"
            "A ranged weapon.\n"
            "Tags: Ranged (0), Lethal\n"
        )
        config = {**equipment_config, "heading_pattern": {
            "regex": r"^(?P<name>[A-Z][A-Za-z ]+)$",
            "flags": ["MULTILINE"],
        }}
        result = extractor.extract(text, basic_spec, config)
        entry = result.entries["crossbow"]
        assert entry["source"] == "Test_Book.pdf p.42"
        # Verify format matches the pattern <filename> p.<N>
        import re
        assert re.match(r"^.+ p\.\d+$", entry["source"])

    def test_entry_without_tags(self, extractor, basic_spec, equipment_config):
        text = (
            "--- Page 3 ---\n"
            "Equipment\n\n"
            "Fancy Hat\n"
            "A stylish headpiece for social occasions.\n"
        )
        config = {**equipment_config, "heading_pattern": {
            "regex": r"^(?P<name>[A-Z][A-Za-z ]+)$",
            "flags": ["MULTILINE"],
        }}
        result = extractor.extract(text, basic_spec, config)
        assert "fancyHat" in result.entries
        entry = result.entries["fancyHat"]
        assert entry["tagIds"] == []
        # Without weapon/armor/tool keywords, should be general
        assert entry["equipmentType"] == "general"

    def test_equipment_type_from_weapon_context(self, extractor, basic_spec, equipment_config):
        text = (
            "--- Page 5 ---\n"
            "Equipment\n\n"
            "Weapons\n\n"
            "Short Sword\n"
            "A compact blade.\n"
            "Tags: Lethal, Melee\n"
        )
        config = {**equipment_config, "heading_pattern": {
            "regex": r"^(?P<name>[A-Z][A-Za-z ]+)$",
            "flags": ["MULTILINE"],
        }}
        result = extractor.extract(text, basic_spec, config)
        assert "shortSword" in result.entries
        assert result.entries["shortSword"]["equipmentType"] == "weapon"

    def test_description_extraction(self, extractor, basic_spec, equipment_config):
        text = (
            "--- Page 5 ---\n"
            "Equipment\n\n"
            "Hunting Bow\n"
            "A recurve bow used for hunting game at medium range.\n"
            "Tags: Ranged (0), Lethal\n"
        )
        config = {**equipment_config, "heading_pattern": {
            "regex": r"^(?P<name>[A-Z][A-Za-z ]+)$",
            "flags": ["MULTILINE"],
        }}
        result = extractor.extract(text, basic_spec, config)
        entry = result.entries["huntingBow"]
        assert "recurve bow" in entry["description"]

    def test_mechanical_effects_extraction(self, extractor, basic_spec, equipment_config):
        text = (
            "--- Page 7 ---\n"
            "Equipment\n\n"
            "Assault Rifle\n"
            "Military-grade automatic rifle.\n"
            "Tags: Ranged (0), Lethal, Automatic\n"
            "Range: Long\n"
            "Enhancement: +2\n"
        )
        config = {**equipment_config, "heading_pattern": {
            "regex": r"^(?P<name>[A-Z][A-Za-z ]+)$",
            "flags": ["MULTILINE"],
        }}
        result = extractor.extract(text, basic_spec, config)
        entry = result.entries["assaultRifle"]
        assert "Range: Long" in entry["mechanicalEffects"]
        assert "Enhancement: +2" in entry["mechanicalEffects"]

    def test_all_required_fields_present(self, extractor, basic_spec, equipment_config):
        text = (
            "--- Page 12 ---\n"
            "Equipment\n\n"
            "Dagger\n"
            "A small stabbing weapon.\n"
            "Tags: Lethal, Melee, Thrown\n"
        )
        config = {**equipment_config, "heading_pattern": {
            "regex": r"^(?P<name>[A-Z][A-Za-z ]+)$",
            "flags": ["MULTILINE"],
        }}
        result = extractor.extract(text, basic_spec, config)
        entry = result.entries["dagger"]
        required_fields = ["id", "name", "equipmentType", "tagIds", "description",
                          "mechanicalEffects", "source"]
        for field in required_fields:
            assert field in entry, f"Missing required field: {field}"


class TestEquipmentExtractorRegistry:
    """Tests for the extractor registry integration."""

    def test_registered_in_registry(self):
        from extractors import EXTRACTOR_REGISTRY
        assert "equipment" in EXTRACTOR_REGISTRY
        assert EXTRACTOR_REGISTRY["equipment"] is EquipmentExtractor

    def test_is_category_extractor_subclass(self):
        from extractors.base import CategoryExtractor
        assert issubclass(EquipmentExtractor, CategoryExtractor)
