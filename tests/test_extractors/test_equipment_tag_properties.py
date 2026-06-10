"""Property-based tests for equipment tag notation parsing.

# Feature: unified-pdf-extractor, Property 6: Equipment Tag Notation Parsing

For any valid equipment text containing a "Tags:" line with comma-separated
tag entries in the format "TagName (N)", the equipment extractor SHALL produce
an entry where `tagIds` contains one camelCase identifier for each parsed tag
name, preserving the count from the source.

**Validates: Requirements 3.6**
"""

from __future__ import annotations

import re

from hypothesis import given, settings
from hypothesis import strategies as st

from extractors.equipment_extractor import EquipmentExtractor, _parse_tags, _to_camel_case
from parser_framework.models import BookSpec


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_equipment_spec() -> BookSpec:
    """Create a minimal BookSpec for equipment extraction tests."""
    return BookSpec(
        book_id="test_book",
        filenames=["Test_Book.pdf"],
        output_path="src/data/_extracted/test_book.txt",
        section_anchors=[],
        heading_patterns=[],
        expected_fields=[],
        pipeline_stages=["ingest", "extract"],
    )


def _make_equipment_config() -> dict:
    """Create the equipment category config used for extraction.

    Uses a heading pattern that matches equipment item names (capitalized words
    without colons or periods) but excludes section titles like "Equipment" and
    structured lines like "Tags:".
    """
    return {
        "section_anchors": [{"pattern": "Equipment", "pattern_type": "literal"}],
        "heading_pattern": {
            # Match lines that are capitalized words/phrases but NOT lines containing
            # colons (Tags:, Damage:, etc.) or ending in periods (description sentences).
            # Also exclude the word "Equipment" alone to avoid matching the section title.
            "regex": r"^(?P<name>(?!Equipment$)[A-Z][A-Za-z' -]+[a-z])$",
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


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Tag names: one or two words starting with uppercase letters (like real Scion tags)
_tag_word = st.from_regex(r"[A-Z][a-z]{2,10}", fullmatch=True)
_tag_name = st.one_of(
    _tag_word,
    st.tuples(_tag_word, _tag_word).map(lambda t: f"{t[0]} {t[1]}"),
    st.tuples(_tag_word, _tag_word).map(lambda t: f"{t[0]}-{t[1]}"),
)

# Parenthetical value (0-9) — optional cost notation in Scion equipment tags
_tag_value = st.integers(min_value=0, max_value=9)

# A single tag entry: "TagName (N)" or just "TagName"
_tag_entry_with_value = st.tuples(_tag_name, _tag_value).map(
    lambda t: f"{t[0]} ({t[1]})"
)
_tag_entry_without_value = _tag_name

_tag_entry = st.one_of(_tag_entry_with_value, _tag_entry_without_value)

# A list of tag entries (1 to 6 tags)
_tag_list = st.lists(_tag_entry, min_size=1, max_size=6)

# Equipment item names: starts with uppercase, ends with lowercase, no newlines.
# Filtered to exclude "Equipment" (section anchor) to avoid heading pattern conflicts.
_equipment_name = st.from_regex(r"[A-Z][A-Za-z ]{2,25}[a-z]", fullmatch=True).filter(
    lambda s: "\n" not in s and s.strip() != "Equipment"
)

# Page numbers
_page_number = st.integers(min_value=1, max_value=999)


# ---------------------------------------------------------------------------
# Feature: unified-pdf-extractor, Property 6: Equipment Tag Notation Parsing
# ---------------------------------------------------------------------------


class TestEquipmentTagNotationParsing:
    """Property 6: Equipment Tag Notation Parsing.

    For any valid equipment text containing a "Tags:" line with comma-separated
    tag entries in the format "TagName (N)", the equipment extractor SHALL
    produce an entry where `tagIds` contains one camelCase identifier for each
    parsed tag name, preserving the count from the source.

    **Validates: Requirements 3.6**
    """

    @given(
        equipment_name=_equipment_name,
        tag_entries=_tag_list,
        page_num=_page_number,
    )
    @settings(max_examples=100)
    def test_tag_count_matches_source_entries(
        self,
        equipment_name: str,
        tag_entries: list[str],
        page_num: int,
    ) -> None:
        """tagIds count matches the number of comma-separated tag entries in source."""
        # **Validates: Requirements 3.6**
        tags_line = ", ".join(tag_entries)
        text = (
            f"--- Page {page_num} ---\n"
            f"Equipment\n\n"
            f"{equipment_name}\n"
            f"a standard piece of equipment for any adventurer.\n"
            f"Tags: {tags_line}\n"
        )

        extractor = EquipmentExtractor()
        spec = _make_equipment_spec()
        config = _make_equipment_config()

        result = extractor.extract(text, spec, config)

        assert result.entry_count == 1, (
            f"Expected 1 entry, got {result.entry_count}. "
            f"Equipment name: {equipment_name!r}"
        )

        entry = list(result.entries.values())[0]
        assert len(entry["tagIds"]) == len(tag_entries), (
            f"tagIds count mismatch: expected {len(tag_entries)} from "
            f"'{tags_line}', got {len(entry['tagIds'])}: {entry['tagIds']}"
        )

    @given(
        equipment_name=_equipment_name,
        tag_entries=_tag_list,
        page_num=_page_number,
    )
    @settings(max_examples=100)
    def test_tag_ids_are_camel_case(
        self,
        equipment_name: str,
        tag_entries: list[str],
        page_num: int,
    ) -> None:
        """Every extracted tagId is a valid camelCase identifier."""
        # **Validates: Requirements 3.6**
        tags_line = ", ".join(tag_entries)
        text = (
            f"--- Page {page_num} ---\n"
            f"Equipment\n\n"
            f"{equipment_name}\n"
            f"a standard piece of equipment for any adventurer.\n"
            f"Tags: {tags_line}\n"
        )

        extractor = EquipmentExtractor()
        spec = _make_equipment_spec()
        config = _make_equipment_config()

        result = extractor.extract(text, spec, config)

        assert result.entry_count == 1
        entry = list(result.entries.values())[0]

        # Each tagId should be a non-empty string starting with lowercase letter
        # and containing only alphanumeric characters (camelCase)
        camel_case_re = re.compile(r"^[a-z][a-zA-Z0-9]*$")
        for tag_id in entry["tagIds"]:
            assert isinstance(tag_id, str)
            assert tag_id, "tagId should not be empty"
            assert camel_case_re.match(tag_id), (
                f"tagId '{tag_id}' is not valid camelCase"
            )

    @given(
        equipment_name=_equipment_name,
        tag_entries=_tag_list,
        page_num=_page_number,
    )
    @settings(max_examples=100)
    def test_tag_ids_correspond_to_source_tag_names(
        self,
        equipment_name: str,
        tag_entries: list[str],
        page_num: int,
    ) -> None:
        """Each tagId corresponds to the camelCase conversion of its source tag name."""
        # **Validates: Requirements 3.6**
        tags_line = ", ".join(tag_entries)
        text = (
            f"--- Page {page_num} ---\n"
            f"Equipment\n\n"
            f"{equipment_name}\n"
            f"a standard piece of equipment for any adventurer.\n"
            f"Tags: {tags_line}\n"
        )

        extractor = EquipmentExtractor()
        spec = _make_equipment_spec()
        config = _make_equipment_config()

        result = extractor.extract(text, spec, config)

        assert result.entry_count == 1
        entry = list(result.entries.values())[0]

        # Compute expected tag IDs from the source tag names
        expected_ids = []
        for tag_entry in tag_entries:
            # Strip parenthetical value if present: "TagName (N)" -> "TagName"
            tag_name = re.sub(r"\s*\([^)]*\)", "", tag_entry).strip()
            expected_ids.append(_to_camel_case(tag_name))

        assert entry["tagIds"] == expected_ids, (
            f"tagIds mismatch:\n"
            f"  expected: {expected_ids}\n"
            f"  got:      {entry['tagIds']}\n"
            f"  source tags: '{tags_line}'"
        )
