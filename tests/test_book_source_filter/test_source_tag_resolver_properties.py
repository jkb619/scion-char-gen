"""Property-based tests for the SourceTagResolver deterministic resolution.

# Feature: book-source-filter, Property 8: Deterministic Source Tag Resolution

Tests that the SourceTagResolver produces the same result regardless of call order,
respects priority (exact slug match wins over substring), uses case-insensitive
comparison, and selects the longest title match when multiple substrings match.

**Validates: Requirements 6.1, 6.2, 6.3**
"""

from __future__ import annotations

from pathlib import Path

from hypothesis import assume, given, settings
from hypothesis import strategies as st

from app.services.source_registry import BookEntry, SourceRegistry
from app.services.source_tag_resolver import SourceTagResolver

# ---------------------------------------------------------------------------
# Fixtures / Setup
# ---------------------------------------------------------------------------

# Use a controlled set of BookEntry objects for deterministic testing.
# This avoids filesystem dependencies and keeps properties self-contained.
_CONTROLLED_ENTRIES: list[BookEntry] = [
    BookEntry(slug="scion_dragon", title="Scion: Dragon", pdf_patterns=["Scion_Dragon_(Final_Download).pdf"]),
    BookEntry(slug="dragon_companion", title="Scion: Dragon Companion", pdf_patterns=["Scion_Dragon_Companion_(Final_Download).pdf"]),
    BookEntry(slug="scion_hero", title="Scion: Hero", pdf_patterns=["Scion_Hero_(Final_Download).pdf"]),
    BookEntry(slug="divine_arenas", title="Divine Arenas", pdf_patterns=["7711-Divine_Arenas.pdf"]),
    BookEntry(slug="divine_armory", title="Divine Armory", pdf_patterns=["7711-Divine_Armory.pdf"]),
    BookEntry(slug="saints_monsters", title="Saints & Monsters", pdf_patterns=["Scion_Players_Guide__Saints__Monsters_(Final_Download).pdf"]),
    BookEntry(slug="pandoras_box", title="Pandora's Box (Revised)", pdf_patterns=["SCION_Pandoras_Box_(Revised_Download).pdf"]),
    BookEntry(slug="once_and_future", title="Once and Future", pdf_patterns=[]),
    BookEntry(slug="reconditioned", title="Reconditioned", pdf_patterns=["255389-RECONDITIONED_2.pdf"]),
    BookEntry(slug="scion_origin", title="Scion: Origin", pdf_patterns=["Scion_Origin_(Revised_Download).pdf"]),
]

# An empty directory path (no auto-discovery), just the controlled core books.
_EMPTY_DIR = Path("/nonexistent_dir_for_testing")


def _make_registry() -> SourceRegistry:
    """Create a registry with the controlled entry set (no filesystem scan)."""
    return SourceRegistry(books_dir=_EMPTY_DIR, core_books=_CONTROLLED_ENTRIES)


def _make_resolver() -> SourceTagResolver:
    """Create a resolver backed by the controlled registry."""
    return SourceTagResolver(_make_registry())


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_registry = _make_registry()
_known_slugs = list(_registry.entries.keys())

# Strategy: pick a known slug from the controlled registry
_slug_strategy = st.sampled_from(_known_slugs)

# Strategy: arbitrary source strings
_arbitrary_source = st.text(min_size=1, max_size=100)


# ---------------------------------------------------------------------------
# Property 8: Deterministic Source Tag Resolution
# ---------------------------------------------------------------------------


class TestDeterministicSourceTagResolution:
    """Property 8: Deterministic Source Tag Resolution.

    For any Source_Tag string, the SourceTagResolver SHALL produce the same
    result regardless of call order, and SHALL respect priority: if an exact
    slug match exists it is chosen even when substring matching would yield a
    different entry. All comparisons SHALL be case-insensitive. When multiple
    substrings match, the longest title wins.

    **Validates: Requirements 6.1, 6.2, 6.3**
    """

    @given(source=_arbitrary_source)
    @settings(max_examples=200)
    def test_resolve_single_is_deterministic(self, source: str) -> None:
        """For any source string, calling resolve_single twice yields the same result.

        **Validates: Requirements 6.1, 6.2, 6.3**
        """
        resolver = _make_resolver()
        result1 = resolver.resolve_single(source)
        result2 = resolver.resolve_single(source)
        assert result1 == result2, (
            f"Non-deterministic resolution for {source!r}:\n"
            f"  first call:  {result1!r}\n"
            f"  second call: {result2!r}"
        )

    @given(slug=_slug_strategy)
    @settings(max_examples=200)
    def test_exact_slug_takes_priority(self, slug: str) -> None:
        """If a generated string exactly matches a slug (case-insensitive),
        that slug is returned even if it's also a substring of a title.

        **Validates: Requirements 6.1, 6.2, 6.3**
        """
        resolver = _make_resolver()
        # The slug itself should resolve to exactly that slug
        result = resolver.resolve_single(slug)
        assert result == slug, (
            f"Exact slug match should return the slug itself.\n"
            f"  Input: {slug!r}\n"
            f"  Expected: {slug!r}\n"
            f"  Got: {result!r}"
        )

        # Mixed case of the slug should also resolve to the same slug
        mixed = slug.upper()
        result_upper = resolver.resolve_single(mixed)
        assert result_upper == slug, (
            f"Case-insensitive exact slug match should return the slug.\n"
            f"  Input: {mixed!r}\n"
            f"  Expected: {slug!r}\n"
            f"  Got: {result_upper!r}"
        )

    @given(slug=_slug_strategy)
    @settings(max_examples=200)
    def test_case_insensitive_resolution(self, slug: str) -> None:
        """For any slug in the registry, resolve_single(slug.upper()) == resolve_single(slug.lower()).

        **Validates: Requirements 6.1, 6.2, 6.3**
        """
        resolver = _make_resolver()
        result_upper = resolver.resolve_single(slug.upper())
        result_lower = resolver.resolve_single(slug.lower())
        assert result_upper == result_lower, (
            f"Case-insensitive resolution failed for slug {slug!r}:\n"
            f"  upper({slug.upper()!r}) -> {result_upper!r}\n"
            f"  lower({slug.lower()!r}) -> {result_lower!r}"
        )

    @settings(max_examples=200)
    @given(data=st.data())
    def test_longest_title_match_wins(self, data: st.DataObject) -> None:
        """When text contains multiple title substrings, the longest one wins.

        **Validates: Requirements 6.1, 6.2, 6.3**
        """
        # Use a pair of entries where one title is a substring of the other.
        # "Scion: Dragon" is a substring of "Scion: Dragon Companion"
        short_entry = _registry.entries["scion_dragon"]
        long_entry = _registry.entries["dragon_companion"]

        # Verify the prerequisite: short title is a substring of long title
        assume(short_entry.title.lower() in long_entry.title.lower())

        resolver = _make_resolver()

        # When the input contains the longer title, it should resolve to
        # the longer (more specific) entry
        text_with_long = data.draw(
            st.sampled_from([
                long_entry.title,
                f"From {long_entry.title} p.12",
                f"{long_entry.title} supplement",
            ])
        )
        result = resolver.resolve_single(text_with_long)
        assert result == long_entry.slug, (
            f"Longest title match should win.\n"
            f"  Input: {text_with_long!r}\n"
            f"  Expected: {long_entry.slug!r} (title={long_entry.title!r})\n"
            f"  Got: {result!r}"
        )

        # When the input contains only the shorter title (not the longer),
        # it should resolve to the shorter entry
        text_with_short_only = data.draw(
            st.sampled_from([
                short_entry.title,
                f"From {short_entry.title} p.5",
                f"{short_entry.title} rules",
            ])
        )
        # Verify the short-only text does NOT contain the longer title
        if long_entry.title.lower() not in text_with_short_only.lower():
            result_short = resolver.resolve_single(text_with_short_only)
            assert result_short == short_entry.slug, (
                f"Short title should match when long title is not present.\n"
                f"  Input: {text_with_short_only!r}\n"
                f"  Expected: {short_entry.slug!r}\n"
                f"  Got: {result_short!r}"
            )


# ---------------------------------------------------------------------------
# Feature: book-source-filter, Property 9: Semicolon Segment Independence
# ---------------------------------------------------------------------------

# Use the real books directory for segment independence testing, as
# we want to verify the property holds with the full production registry.
_REAL_BOOKS_DIR = Path(__file__).resolve().parents[2] / "src" / "data" / "books"
_real_registry = SourceRegistry(books_dir=_REAL_BOOKS_DIR)
_real_resolver = SourceTagResolver(registry=_real_registry)

# Strategy: non-empty strings that don't contain semicolons
_segment_strategy = st.text(
    min_size=1,
    max_size=50,
    alphabet=st.characters(blacklist_characters=";"),
)


@given(a=_segment_strategy, b=_segment_strategy)
@settings(max_examples=200)
def test_semicolon_segment_independence(a: str, b: str) -> None:
    """resolve("A;B") equals the concatenation of resolve_single(A) and resolve_single(B).

    # Feature: book-source-filter, Property 9: Semicolon Segment Independence

    **Validates: Requirements 6.4**
    """
    # Resolve the combined tag
    combined_result = _real_resolver.resolve(f"{a};{b}")

    # Resolve each segment independently and concatenate non-None results
    result_a = _real_resolver.resolve_single(a.strip())
    result_b = _real_resolver.resolve_single(b.strip())

    expected = [x for x in [result_a] if x is not None] + [
        x for x in [result_b] if x is not None
    ]

    assert combined_result == expected, (
        f"Segment independence violated:\n"
        f"  A = {a!r}, B = {b!r}\n"
        f"  resolve('{a};{b}') = {combined_result}\n"
        f"  resolve_single(A.strip()) = {result_a}\n"
        f"  resolve_single(B.strip()) = {result_b}\n"
        f"  expected concatenation = {expected}"
    )


# ---------------------------------------------------------------------------
# Property 10: Resolution Bounds
# ---------------------------------------------------------------------------

# Use the real registry for resolution bounds tests to validate against actual data
_REAL_BOOKS_DIR = Path(__file__).resolve().parents[2] / "src" / "data" / "books"
_real_registry = SourceRegistry(books_dir=_REAL_BOOKS_DIR)
_real_resolver = SourceTagResolver(registry=_real_registry)

# Strategy: unresolvable strings that cannot match any slug, pdf_pattern, or title.
# Use only digits and underscores — no letters that could form a title substring.
# The prefix "99999_" ensures no slug match, and the digit-only content ensures
# no title substring can be found within the generated text.
_unresolvable_text = st.from_regex(r"99999_[0-9]{1,40}", fullmatch=True)


class TestResolutionBounds:
    """Property 10: Resolution Bounds.

    For any single Source_Tag segment (no semicolons), the resolver SHALL return
    at most one identifier. When no strategy matches, it SHALL return None
    (unresolved entries are always visible).

    **Validates: Requirements 6.5, 6.6**
    """

    # Feature: book-source-filter, Property 10: Resolution Bounds
    @given(segment=st.text(min_size=0, max_size=200))
    @settings(max_examples=200)
    def test_resolve_single_returns_at_most_one(self, segment: str) -> None:
        """For any arbitrary string input, resolve_single returns either None
        or a single string (never a list, never multiple values).

        **Validates: Requirements 6.5, 6.6**
        """
        result = _real_resolver.resolve_single(segment)

        # Must be None or a single string
        assert result is None or isinstance(result, str), (
            f"resolve_single({segment!r}) returned {result!r} which is "
            f"neither None nor a string"
        )

        # If it returned a string, it must be a valid registry slug
        if result is not None:
            assert result in _real_registry.entries, (
                f"resolve_single({segment!r}) returned {result!r} which is "
                f"not a valid registry slug. "
                f"Valid slugs: {list(_real_registry.entries.keys())}"
            )

    # Feature: book-source-filter, Property 10: Resolution Bounds
    @given(segment=_unresolvable_text)
    @settings(max_examples=200)
    def test_unresolvable_segments_return_none(self, segment: str) -> None:
        """For strings that are random gibberish (no match to any slug,
        pdf_pattern, or title), resolve_single returns None.

        **Validates: Requirements 6.5, 6.6**
        """
        result = _real_resolver.resolve_single(segment)

        assert result is None, (
            f"resolve_single({segment!r}) returned {result!r} but expected "
            f"None for an unresolvable segment"
        )
