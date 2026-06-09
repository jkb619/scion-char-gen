"""Property-based tests for the filter visibility logic.

# Feature: book-source-filter, Property 3: Filter Visibility

Tests that an entry is visible if and only if:
(a) it has no `_sourceBookId` field, OR
(b) its `_sourceBookId` (string) is a member of the Allowed_Books_Set, OR
(c) its `_sourceBookId` (array) has at least one element in the Allowed_Books_Set.

**Validates: Requirements 3.1, 3.4, 3.5**
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


# ---------------------------------------------------------------------------
# Python model of the JS isEntryVisibleForBooks function
# ---------------------------------------------------------------------------


def is_entry_visible_for_books(entry: dict, allowed_books: set[str]) -> bool:
    """Python model of src/static/js/bookFilter.js::isEntryVisibleForBooks."""
    source_id = entry.get("_sourceBookId")
    if source_id is None:
        return True
    if isinstance(source_id, list):
        return any(slug in allowed_books for slug in source_id)
    return source_id in allowed_books


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Sets of allowed book slugs drawn from the real registry
_allowed_books_strategy = st.sets(st.sampled_from(KNOWN_SLUGS))

# A single slug (string sourceBookId)
_single_slug_strategy = st.sampled_from(KNOWN_SLUGS)

# An array of slugs (multi-book sourceBookId), at least one element
_array_slug_strategy = st.lists(st.sampled_from(KNOWN_SLUGS), min_size=1, max_size=5)

# Extra entry fields that don't affect visibility (just add realism)
_extra_fields_strategy = st.fixed_dictionaries(
    {},
    optional={
        "name": st.text(min_size=1, max_size=30),
        "source": st.text(min_size=0, max_size=50),
        "id": st.text(min_size=1, max_size=20),
    },
)


# ---------------------------------------------------------------------------
# Property tests
# ---------------------------------------------------------------------------


@given(
    allowed_books=_allowed_books_strategy,
    extra_fields=_extra_fields_strategy,
)
@settings(max_examples=200)
def test_no_source_book_id_always_visible(
    allowed_books: set[str],
    extra_fields: dict,
) -> None:
    """Entries without _sourceBookId are always visible regardless of allowed books."""
    # Build entry without _sourceBookId key at all
    entry: dict = {**extra_fields}
    # Ensure _sourceBookId is NOT present
    entry.pop("_sourceBookId", None)

    assert is_entry_visible_for_books(entry, allowed_books) is True


@given(
    source_book_id=_single_slug_strategy,
    allowed_books=_allowed_books_strategy,
    extra_fields=_extra_fields_strategy,
)
@settings(max_examples=200)
def test_string_source_book_id_member_check(
    source_book_id: str,
    allowed_books: set[str],
    extra_fields: dict,
) -> None:
    """For string _sourceBookId, visibility equals membership in allowed_books."""
    entry: dict = {**extra_fields, "_sourceBookId": source_book_id}

    expected = source_book_id in allowed_books
    assert is_entry_visible_for_books(entry, allowed_books) == expected


@given(
    source_book_ids=_array_slug_strategy,
    allowed_books=_allowed_books_strategy,
    extra_fields=_extra_fields_strategy,
)
@settings(max_examples=200)
def test_array_source_book_id_any_member_check(
    source_book_ids: list[str],
    allowed_books: set[str],
    extra_fields: dict,
) -> None:
    """For array _sourceBookId, visibility equals any element being in allowed_books."""
    entry: dict = {**extra_fields, "_sourceBookId": source_book_ids}

    expected = any(slug in allowed_books for slug in source_book_ids)
    assert is_entry_visible_for_books(entry, allowed_books) == expected


@given(
    source_book_id=st.one_of(_single_slug_strategy, _array_slug_strategy),
    extra_fields=_extra_fields_strategy,
)
@settings(max_examples=200)
def test_empty_allowed_books_hides_tagged_entries(
    source_book_id: str | list[str],
    extra_fields: dict,
) -> None:
    """With empty allowed_books, any entry with a non-None _sourceBookId is hidden."""
    entry: dict = {**extra_fields, "_sourceBookId": source_book_id}
    empty_allowed: set[str] = set()

    assert is_entry_visible_for_books(entry, empty_allowed) is False
