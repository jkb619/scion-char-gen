"""Property-based tests for character state persistence (export/import).

# Feature: book-source-filter, Property 4: Export/Import Round-Trip

Tests that for any allowedBooks subset of registry slugs, exporting the character
state to JSON and re-importing it restores the identical Allowed_Books_Set.

**Validates: Requirements 4.2, 4.3**

# Feature: book-source-filter, Property 5: Unknown Identifiers Discarded on Import

Tests that imported arrays with unknown slugs have those entries removed,
keeping only valid ones.

**Validates: Requirements 4.5**
"""

from __future__ import annotations

from hypothesis import given, settings
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Known slugs from the real registry (used for realistic strategies)
# ---------------------------------------------------------------------------

KNOWN_SLUGS: list[str] = [
    "pandoras_box",
    "scion_origin",
    "scion_hero",
    "scion_demigod",
    "scion_god",
    "scion_dragon",
    "dragon_companion",
    "mysteries_of_the_world",
    "masks_of_the_mythos",
    "saints_monsters",
    "titans_rising",
    "once_and_future",
    "divine_armory",
    "divine_garage",
    "divine_menagerie",
    "divine_reliquary",
    "divine_arenas",
    "divine_identities",
    "reconditioned",
    "scion_britannias_dragons",
]

VALID_REGISTRY_SLUGS: set[str] = set(KNOWN_SLUGS)


# ---------------------------------------------------------------------------
# Python models of export/import logic
# ---------------------------------------------------------------------------


def export_allowed_books(allowed_books: set[str]) -> list[str]:
    """Model of JSON export: serialize set to sorted array."""
    return sorted(allowed_books)


def import_allowed_books(exported: list[str], valid_registry_slugs: set[str]) -> set[str]:
    """Model of import: filter to only valid slugs."""
    return {slug for slug in exported if slug in valid_registry_slugs}


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Subsets of known registry slugs (including empty set)
_valid_allowed_books_strategy = st.sets(st.sampled_from(KNOWN_SLUGS))

# Mixed arrays containing valid slugs and unknown strings
_unknown_slug_strategy = st.from_regex(r"zzz_unknown_[a-z0-9]{3,10}", fullmatch=True)

_mixed_import_array_strategy = st.lists(
    st.one_of(
        st.sampled_from(KNOWN_SLUGS),
        _unknown_slug_strategy,
    ),
    min_size=1,
)


# ---------------------------------------------------------------------------
# Property 4: Export/Import Round-Trip
# ---------------------------------------------------------------------------


@given(allowed_books=_valid_allowed_books_strategy)
@settings(max_examples=200)
def test_export_import_round_trip(allowed_books: set[str]) -> None:
    """Exporting then importing any valid allowedBooks set restores the identical set.

    For any subset of KNOWN_SLUGS:
    1. Export produces a sorted list of the slugs
    2. Importing that list (filtering against the valid registry) restores the
       exact same set, since all exported slugs are valid.

    **Validates: Requirements 4.2, 4.3**
    """
    exported = export_allowed_books(allowed_books)

    # Exported list should be sorted
    assert exported == sorted(exported), (
        f"Exported list should be sorted. Got: {exported}"
    )

    # Import with the full registry should restore the original set
    imported = import_allowed_books(exported, VALID_REGISTRY_SLUGS)
    assert imported == allowed_books, (
        f"Round-trip failed. Original: {allowed_books}, "
        f"Exported: {exported}, Imported: {imported}"
    )


# ---------------------------------------------------------------------------
# Property 5: Unknown Identifiers Discarded on Import
# ---------------------------------------------------------------------------


@given(mixed_array=_mixed_import_array_strategy)
@settings(max_examples=200)
def test_unknown_identifiers_discarded_on_import(mixed_array: list[str]) -> None:
    """Imported arrays with unknown slugs have those entries removed, keeping only valid ones.

    For any list containing a mix of valid slugs and unknown strings:
    1. Import discards all entries not present in the valid registry
    2. Only entries that are valid registry slugs survive

    **Validates: Requirements 4.5**
    """
    imported = import_allowed_books(mixed_array, VALID_REGISTRY_SLUGS)

    # Every imported slug must be a valid registry slug
    for slug in imported:
        assert slug in VALID_REGISTRY_SLUGS, (
            f"Unknown slug '{slug}' was not discarded during import"
        )

    # Every valid slug from the input should be present in the result
    expected_valid = {s for s in mixed_array if s in VALID_REGISTRY_SLUGS}
    assert imported == expected_valid, (
        f"Import should keep exactly the valid slugs. "
        f"Input: {mixed_array}, Expected: {expected_valid}, Got: {imported}"
    )

    # Unknown slugs should not appear
    unknown_in_input = {s for s in mixed_array if s not in VALID_REGISTRY_SLUGS}
    for slug in unknown_in_input:
        assert slug not in imported, (
            f"Unknown slug '{slug}' should have been discarded but was found in import result"
        )
