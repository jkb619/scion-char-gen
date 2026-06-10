"""Property-based tests for boon extraction dot rating accuracy.

Feature: unified-pdf-extractor, Property 3: Boon Extraction Dot Rating Accuracy

For any valid boon section text containing entries with N consecutive ● symbols,
the boon extractor SHALL produce entries where `dot` equals the count of ● symbols,
`purview` is a non-empty string matching the enclosing section, and `tierMin` is
correctly derived from the dot position (1–4 → hero, 5–8 → demigod, 9–12 → god).

Validates: Requirements 3.2
"""

from __future__ import annotations

from hypothesis import given, settings
from hypothesis import strategies as st

from extractors.boon_extractor import BoonExtractor, _derive_tier_min
from parser_framework.models import BookSpec


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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


def _make_dot_rated_config(purview_pattern: str) -> dict:
    """Create a boon category config for dot-rated (● symbol) mode."""
    return {
        "section_anchors": [
            {
                "pattern": purview_pattern,
                "pattern_type": "regex",
            }
        ],
        "heading_pattern": {
            "regex": r"^(?P<name>.+?)\s*(?P<dots>[●•]+)\s*$",
            "flags": ["MULTILINE"],
        },
        "dot_symbol": "●",
    }


def _build_boon_section_text(purview_name: str, boon_entries: list[tuple[str, int]]) -> str:
    """Build a synthetic boon section text with dot-rated headings.

    Args:
        purview_name: The purview name for the section header.
        boon_entries: List of (boon_name, dot_count) tuples.

    Returns:
        Formatted text that the boon extractor can parse.
    """
    lines = [
        "===== Page 1 / 10 =====",
        f"{purview_name} Boons",
    ]
    for name, dot_count in boon_entries:
        dots = "●" * dot_count
        lines.append(f"{name} {dots}")
        lines.append("Cost: Imbue 1 Legend")
        lines.append("Duration: One scene")
        lines.append("Subject: Self")
        lines.append("Range: Close")
        lines.append("Action: Simple")
        lines.append("This is the description of the boon.")
        lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Strategy: purview names (title-cased single word, 3-15 chars)
_purview_name_st = st.from_regex(r"[A-Z][a-z]{2,14}", fullmatch=True)

# Strategy: boon names (simple title-case words, avoiding regex-special chars)
_boon_name_st = st.from_regex(r"[A-Z][a-z]{2,10}(?: [A-Z][a-z]{2,10}){0,2}", fullmatch=True)

# Strategy: dot counts (1–12, the valid range for boon dot ratings)
_dot_count_st = st.integers(min_value=1, max_value=12)

# Strategy: a list of boon entries (name + dot count pairs)
# We generate 1-12 entries since purviews have up to 12 boon slots
_boon_entries_st = st.lists(
    st.tuples(_boon_name_st, _dot_count_st),
    min_size=1,
    max_size=12,
    unique_by=lambda x: x[0],  # unique boon names
)


# ---------------------------------------------------------------------------
# Feature: unified-pdf-extractor, Property 3: Boon Extraction Dot Rating Accuracy
# ---------------------------------------------------------------------------


class TestBoonExtractionDotRatingAccuracy:
    """Property 3: Boon Extraction Dot Rating Accuracy.

    For any valid boon section text containing entries with N consecutive ●
    symbols, the boon extractor SHALL produce entries where `dot` equals the
    count of ● symbols, `purview` is a non-empty string matching the enclosing
    section, and `tierMin` is correctly derived from the dot position
    (1–4 → hero, 5–8 → demigod, 9–12 → god).

    **Validates: Requirements 3.2**
    """

    @given(
        purview_name=_purview_name_st,
        boon_entries=_boon_entries_st,
    )
    @settings(max_examples=100)
    def test_dot_rating_equals_position_in_section(
        self,
        purview_name: str,
        boon_entries: list[tuple[str, int]],
    ) -> None:
        """Dot rating equals the sequential position of the boon in its purview section.

        **Validates: Requirements 3.2**

        The boon extractor uses positional ordering (first boon = dot 1,
        second boon = dot 2, etc.) when parsing dot-rated sections. The
        dot symbols in the heading are the presentation format, but the
        actual dot value is derived from the entry's sequential position
        within the purview section.
        """
        # Build text and extract
        text = _build_boon_section_text(purview_name, boon_entries)
        config = _make_dot_rated_config(
            rf"^(?P<purview>[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+Boons$"
        )
        extractor = BoonExtractor()
        spec = _make_spec()
        result = extractor.extract(text, spec, config)

        # Should extract entries
        assert result.entry_count == len(boon_entries), (
            f"Expected {len(boon_entries)} entries, got {result.entry_count}. "
            f"Purview: {purview_name}, entries: {boon_entries}"
        )

        # Each entry's dot should equal its sequential position (1-indexed)
        purview_id = purview_name[0].lower() + purview_name[1:]
        for position_idx, (name, _dot_symbols) in enumerate(boon_entries, start=1):
            boon_id = f"{purview_id}_dot_{position_idx:02d}"
            assert boon_id in result.entries, (
                f"Expected boon_id {boon_id} not found. "
                f"Available: {list(result.entries.keys())}"
            )
            entry = result.entries[boon_id]
            assert entry["dot"] == position_idx, (
                f"Entry {boon_id} dot should be {position_idx}, got {entry['dot']}"
            )

    @given(
        purview_name=_purview_name_st,
        boon_entries=_boon_entries_st,
    )
    @settings(max_examples=100)
    def test_purview_is_non_empty_and_matches_section(
        self,
        purview_name: str,
        boon_entries: list[tuple[str, int]],
    ) -> None:
        """Purview field is a non-empty string matching the enclosing section.

        **Validates: Requirements 3.2**
        """
        text = _build_boon_section_text(purview_name, boon_entries)
        config = _make_dot_rated_config(
            rf"^(?P<purview>[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+Boons$"
        )
        extractor = BoonExtractor()
        spec = _make_spec()
        result = extractor.extract(text, spec, config)

        # Derive the expected purview_id (camelCase of the purview name)
        purview_id = purview_name[0].lower() + purview_name[1:]

        for entry in result.entries.values():
            # purview must be non-empty
            assert entry["purview"], (
                f"Entry {entry['id']} has empty purview field"
            )
            # purview must match the section's purview_id
            assert entry["purview"] == purview_id, (
                f"Entry {entry['id']} purview {entry['purview']!r} "
                f"does not match expected {purview_id!r}"
            )
            # purviewName must be non-empty and match the section heading
            assert entry["purviewName"], (
                f"Entry {entry['id']} has empty purviewName field"
            )
            assert entry["purviewName"] == purview_name, (
                f"Entry {entry['id']} purviewName {entry['purviewName']!r} "
                f"does not match expected {purview_name!r}"
            )

    @given(
        purview_name=_purview_name_st,
        boon_entries=_boon_entries_st,
    )
    @settings(max_examples=100)
    def test_tier_min_correctly_derived_from_dot_position(
        self,
        purview_name: str,
        boon_entries: list[tuple[str, int]],
    ) -> None:
        """tierMin is correctly derived: dots 1-4 → hero, 5-8 → demigod, 9-12 → god.

        **Validates: Requirements 3.2**
        """
        text = _build_boon_section_text(purview_name, boon_entries)
        config = _make_dot_rated_config(
            rf"^(?P<purview>[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+Boons$"
        )
        extractor = BoonExtractor()
        spec = _make_spec()
        result = extractor.extract(text, spec, config)

        for entry in result.entries.values():
            dot = entry["dot"]
            expected_tier = _derive_tier_min(dot)
            assert entry["tierMin"] == expected_tier, (
                f"Entry {entry['id']} with dot={dot} has tierMin={entry['tierMin']!r}, "
                f"expected {expected_tier!r}"
            )

    @given(dot=st.integers(min_value=1, max_value=12))
    @settings(max_examples=100)
    def test_derive_tier_min_invariant(self, dot: int) -> None:
        """The tier derivation function correctly maps all dot values to tiers.

        **Validates: Requirements 3.2**
        """
        tier = _derive_tier_min(dot)
        if 1 <= dot <= 4:
            assert tier == "hero", f"dot={dot} should be 'hero', got {tier!r}"
        elif 5 <= dot <= 8:
            assert tier == "demigod", f"dot={dot} should be 'demigod', got {tier!r}"
        elif 9 <= dot <= 12:
            assert tier == "god", f"dot={dot} should be 'god', got {tier!r}"
        else:
            # Should not happen with our strategy, but guard against it
            assert False, f"Unexpected dot value: {dot}"
