"""Property-based tests for birthright stat block parsing.

# Feature: unified-pdf-extractor, Property 5: Birthright Stat Block Parsing

For any valid birthright creature text containing a stat block with
"Primary Pool: X, Defense: Y, Health: Z", the birthright extractor SHALL
produce an entry where `creatureDetails.primaryPool`, `creatureDetails.defense`,
and `creatureDetails.health` are non-negative integers matching the source values.

**Validates: Requirements 3.5**
"""

from __future__ import annotations

from hypothesis import given, settings
from hypothesis import strategies as st

from extractors.birthright_extractor import BirthrightExtractor
from parser_framework.models import BookSpec


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_birthright_spec() -> BookSpec:
    """Create a minimal BookSpec for birthright extraction tests."""
    return BookSpec(
        book_id="test_book",
        filenames=["Test_Book.pdf"],
        output_path="src/data/_extracted/test_book.txt",
        section_anchors=[],
        heading_patterns=[],
        expected_fields=[],
        pipeline_stages=["ingest", "extract"],
    )


def _make_birthright_config(stat_block_pattern: str | None = None) -> dict:
    """Create the birthright category config used for extraction."""
    return {
        "section_anchors": [{"pattern": "Birthrights", "pattern_type": "literal"}],
        "heading_pattern": {
            "regex": r"^(?P<name>.+?)\s*\((?P<type>Relic|Creature|Follower|Guide|Cult)\)",
            "flags": ["MULTILINE"],
        },
        "stat_block_pattern": stat_block_pattern
        or r"Primary Pool:\s*(?P<primaryPool>\d+).*?Defense:\s*(?P<defense>\d+).*?Health:\s*(?P<health>\d+)",
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


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Non-negative integers for stat values (keeping them reasonable for game context)
_stat_value = st.integers(min_value=0, max_value=999)

# Creature names: at least one word character, no parentheses (to avoid breaking
# the heading regex), and no newlines
_creature_name = st.from_regex(
    r"[A-Z][A-Za-z ]{1,30}[a-z]", fullmatch=True
).filter(lambda s: "(" not in s and ")" not in s and "\n" not in s)

# Page numbers (positive integers)
_page_number = st.integers(min_value=1, max_value=999)

# Optional whitespace between stat block fields (spaces, newlines, commas)
_stat_separator = st.sampled_from([", ", "\n", "  ", " - ", "; "])

# Optional dot notation for point cost
_dot_count = st.integers(min_value=1, max_value=5)


# ---------------------------------------------------------------------------
# Feature: unified-pdf-extractor, Property 5: Birthright Stat Block Parsing
# ---------------------------------------------------------------------------


class TestBirthrightStatBlockParsing:
    """Property 5: Birthright Stat Block Parsing.

    For any valid birthright creature text containing a stat block with
    "Primary Pool: X, Defense: Y, Health: Z", the birthright extractor SHALL
    produce an entry where `creatureDetails.primaryPool`,
    `creatureDetails.defense`, and `creatureDetails.health` are non-negative
    integers matching the source values.

    **Validates: Requirements 3.5**
    """

    @given(
        creature_name=_creature_name,
        primary_pool=_stat_value,
        defense=_stat_value,
        health=_stat_value,
        page_num=_page_number,
        dot_count=_dot_count,
    )
    @settings(max_examples=100)
    def test_stat_block_values_match_source(
        self,
        creature_name: str,
        primary_pool: int,
        defense: int,
        health: int,
        page_num: int,
        dot_count: int,
    ) -> None:
        """Extracted stat block values match the source integers exactly."""
        # **Validates: Requirements 3.5**
        dots = "•" * dot_count
        text = (
            f"--- Page {page_num} ---\n"
            f"Birthrights\n\n"
            f"{creature_name} (Creature) {dots}\n"
            f"A fierce beast loyal to the Scion.\n"
            f"Primary Pool: {primary_pool}\n"
            f"Defense: {defense}\n"
            f"Health: {health}\n"
        )

        extractor = BirthrightExtractor()
        spec = _make_birthright_spec()
        config = _make_birthright_config()

        result = extractor.extract(text, spec, config)

        assert result.entry_count == 1, (
            f"Expected 1 entry, got {result.entry_count}. "
            f"Creature name: {creature_name!r}"
        )

        entry = list(result.entries.values())[0]
        assert entry["birthrightType"] == "creature"
        assert "creatureDetails" in entry, (
            f"Missing creatureDetails for creature entry: {creature_name!r}"
        )

        details = entry["creatureDetails"]
        assert details["primaryPool"] == primary_pool, (
            f"primaryPool mismatch: expected {primary_pool}, got {details['primaryPool']}"
        )
        assert details["defense"] == defense, (
            f"defense mismatch: expected {defense}, got {details['defense']}"
        )
        assert details["health"] == health, (
            f"health mismatch: expected {health}, got {details['health']}"
        )

    @given(
        creature_name=_creature_name,
        primary_pool=_stat_value,
        defense=_stat_value,
        health=_stat_value,
        page_num=_page_number,
        separator=_stat_separator,
    )
    @settings(max_examples=100)
    def test_stat_block_values_are_non_negative_integers(
        self,
        creature_name: str,
        primary_pool: int,
        defense: int,
        health: int,
        page_num: int,
        separator: str,
    ) -> None:
        """All extracted stat values are non-negative integers."""
        # **Validates: Requirements 3.5**
        text = (
            f"--- Page {page_num} ---\n"
            f"Birthrights\n\n"
            f"{creature_name} (Creature) ••\n"
            f"A loyal companion beast.\n"
            f"Primary Pool: {primary_pool}{separator}"
            f"Defense: {defense}{separator}"
            f"Health: {health}\n"
        )

        extractor = BirthrightExtractor()
        spec = _make_birthright_spec()
        config = _make_birthright_config()

        result = extractor.extract(text, spec, config)

        assert result.entry_count == 1, (
            f"Expected 1 entry, got {result.entry_count}. "
            f"Creature name: {creature_name!r}, separator: {separator!r}"
        )

        entry = list(result.entries.values())[0]
        assert "creatureDetails" in entry

        details = entry["creatureDetails"]
        assert isinstance(details["primaryPool"], int)
        assert isinstance(details["defense"], int)
        assert isinstance(details["health"], int)
        assert details["primaryPool"] >= 0
        assert details["defense"] >= 0
        assert details["health"] >= 0

    @given(
        creature_name=_creature_name,
        primary_pool=_stat_value,
        defense=_stat_value,
        health=_stat_value,
        page_num=_page_number,
    )
    @settings(max_examples=100)
    def test_stat_block_without_configured_pattern_uses_inline_parsing(
        self,
        creature_name: str,
        primary_pool: int,
        defense: int,
        health: int,
        page_num: int,
    ) -> None:
        """When no stat_block_pattern is configured, inline parsing still extracts values."""
        # **Validates: Requirements 3.5**
        text = (
            f"--- Page {page_num} ---\n"
            f"Birthrights\n\n"
            f"{creature_name} (Creature) ••\n"
            f"A beast companion.\n"
            f"Primary Pool: {primary_pool}\n"
            f"Defense: {defense}\n"
            f"Health: {health}\n"
        )

        extractor = BirthrightExtractor()
        spec = _make_birthright_spec()
        # Config with empty stat_block_pattern triggers inline parsing fallback
        config = _make_birthright_config(stat_block_pattern="")

        result = extractor.extract(text, spec, config)

        assert result.entry_count == 1

        entry = list(result.entries.values())[0]
        assert "creatureDetails" in entry

        details = entry["creatureDetails"]
        assert details["primaryPool"] == primary_pool
        assert details["defense"] == defense
        assert details["health"] == health
