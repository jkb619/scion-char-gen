"""Property-based tests for confirmed removal clearing conflicts.

# Feature: book-source-filter, Property 7: Confirmed Removal Clears Conflicts

Tests that after confirming removal of a book:
  - No selection in any table has _sourceBookId equal to the removed book
  - The removed book is not in allowedBooks

**Validates: Requirements 5.5**
"""

from __future__ import annotations

from hypothesis import given, settings
from hypothesis import strategies as st

# ---------------------------------------------------------------------------
# Python model of the confirm-removal flow
# ---------------------------------------------------------------------------

SELECTION_TABLES = ["boons", "knacks", "birthrights", "equipment"]


def confirm_removal(
    book_slug: str,
    allowed_books: set[str],
    selections: dict[str, list[str]],
    bundle: dict,
) -> tuple[set[str], dict[str, list[str]]]:
    """Model the confirm-removal flow:
    1. Find conflicts (selections whose _sourceBookId matches book_slug)
    2. Remove conflicting selections from character state
    3. Remove book from allowedBooks
    Returns (new_allowed_books, new_selections)
    """
    new_allowed = set(allowed_books)
    new_selections = {t: list(ids) for t, ids in selections.items()}

    # Remove conflicting selections
    for table_name in SELECTION_TABLES:
        remaining = []
        bundle_table = bundle.get(table_name, {})
        for entry_id in new_selections.get(table_name, []):
            entry = bundle_table.get(entry_id, {})
            source_id = entry.get("_sourceBookId")
            matches = False
            if isinstance(source_id, list):
                matches = book_slug in source_id
            elif source_id is not None:
                matches = source_id == book_slug
            if not matches:
                remaining.append(entry_id)
        new_selections[table_name] = remaining

    # Remove book from allowed set
    new_allowed.discard(book_slug)
    return new_allowed, new_selections


# ---------------------------------------------------------------------------
# Strategies (reusing patterns from test_conflict_detection_properties.py)
# ---------------------------------------------------------------------------

# Book slugs: short lowercase identifiers
_book_slug_strategy = st.from_regex(r"[a-z][a-z0-9_]{2,15}", fullmatch=True)

# Entry IDs: alphanumeric identifiers
_entry_id_strategy = st.from_regex(r"[a-z][a-zA-Z0-9_]{2,20}", fullmatch=True)


# A _sourceBookId value: None, a single slug string, or an array of slugs
def _source_book_id_strategy(book_slugs: list[str]) -> st.SearchStrategy:
    """Generate a _sourceBookId value: None, a single slug, or an array of slugs."""
    return st.one_of(
        st.none(),
        st.sampled_from(book_slugs),
        st.lists(st.sampled_from(book_slugs), min_size=1, max_size=3),
    )


# A bundle table: mapping of entry_id -> entry dict (with varying _sourceBookId)
def _bundle_table_strategy(book_slugs: list[str]) -> st.SearchStrategy:
    """Generate a bundle table: {entry_id: {_sourceBookId: ...}}."""
    entry_strategy = _source_book_id_strategy(book_slugs).map(
        lambda src: {"_sourceBookId": src} if src is not None else {}
    )
    return st.dictionaries(
        keys=_entry_id_strategy,
        values=entry_strategy,
        min_size=0,
        max_size=8,
    )


# Full bundle: all four selection tables populated
def _bundle_strategy(book_slugs: list[str]) -> st.SearchStrategy:
    """Generate a full bundle with all selection tables."""
    return st.fixed_dictionaries({
        table: _bundle_table_strategy(book_slugs)
        for table in SELECTION_TABLES
    })


@st.composite
def _confirm_removal_scenario(draw):
    """Draw a bundle, selections, allowedBooks, and a book to remove.

    Ensures the removed book is in the allowed set (since confirmation
    only happens when the user unchecks an allowed book).
    """
    # Draw a pool of book slugs
    book_slugs = draw(
        st.lists(_book_slug_strategy, min_size=2, max_size=6, unique=True)
    )

    # Draw the bundle
    bundle = draw(_bundle_strategy(book_slugs))

    # Draw selections as subsets of each table's entry IDs
    selections = {}
    for table_name in SELECTION_TABLES:
        table_keys = list(bundle[table_name].keys())
        if table_keys:
            selected = draw(
                st.lists(
                    st.sampled_from(table_keys),
                    min_size=0,
                    max_size=min(len(table_keys), 5),
                    unique=True,
                )
            )
            selections[table_name] = selected
        else:
            selections[table_name] = []

    # Pick which book to remove — must be from the pool
    removed_book = draw(st.sampled_from(book_slugs))

    # Allowed books: include the removed book plus a random subset of others
    other_slugs = [s for s in book_slugs if s != removed_book]
    other_allowed = draw(
        st.lists(st.sampled_from(other_slugs), unique=True)
        if other_slugs
        else st.just([])
    )
    allowed_books = set(other_allowed) | {removed_book}

    return bundle, selections, allowed_books, removed_book


# ---------------------------------------------------------------------------
# Property 7: Confirmed Removal Clears Conflicts
# ---------------------------------------------------------------------------


class TestConfirmedRemovalClearsConflicts:
    """Property 7: Confirmed Removal Clears Conflicts.

    For any character state containing selections from book B, after the user
    confirms removal of B, the character state SHALL contain no selection whose
    _sourceBookId equals B, and B SHALL not be a member of the Allowed_Books_Set.

    **Validates: Requirements 5.5**
    """

    # Feature: book-source-filter, Property 7: Confirmed Removal Clears Conflicts
    @given(data=_confirm_removal_scenario())
    @settings(max_examples=200)
    def test_confirmed_removal_clears_all_conflicts(
        self, data: tuple
    ) -> None:
        """After confirming removal of book B:
        1. No selection in any table has _sourceBookId == B
        2. B is not in allowedBooks

        **Validates: Requirements 5.5**
        """
        bundle, selections, allowed_books, removed_book = data

        # Execute the confirm-removal flow
        new_allowed, new_selections = confirm_removal(
            removed_book, allowed_books, selections, bundle
        )

        # Assertion 1: removed book is NOT in the new allowed set
        assert removed_book not in new_allowed, (
            f"Book {removed_book!r} should have been removed from allowedBooks "
            f"after confirmation, but is still present.\n"
            f"  Original allowed: {sorted(allowed_books)}\n"
            f"  New allowed:      {sorted(new_allowed)}"
        )

        # Assertion 2: no remaining selection has _sourceBookId matching removed book
        for table_name in SELECTION_TABLES:
            bundle_table = bundle.get(table_name, {})
            for entry_id in new_selections.get(table_name, []):
                entry = bundle_table.get(entry_id, {})
                source_id = entry.get("_sourceBookId")
                if source_id is None:
                    continue
                if isinstance(source_id, list):
                    assert removed_book not in source_id, (
                        f"After confirming removal of {removed_book!r}, "
                        f"entry {entry_id!r} in table {table_name!r} still has "
                        f"_sourceBookId array containing it: {source_id}"
                    )
                else:
                    assert source_id != removed_book, (
                        f"After confirming removal of {removed_book!r}, "
                        f"entry {entry_id!r} in table {table_name!r} still has "
                        f"_sourceBookId == {source_id!r}"
                    )

    # Feature: book-source-filter, Property 7: Confirmed Removal Clears Conflicts
    @given(data=_confirm_removal_scenario())
    @settings(max_examples=200)
    def test_non_conflicting_selections_preserved(
        self, data: tuple
    ) -> None:
        """Selections that do NOT conflict with the removed book are preserved
        after confirmation — removal only targets conflicts.

        **Validates: Requirements 5.5**
        """
        bundle, selections, allowed_books, removed_book = data

        # Execute the confirm-removal flow
        _new_allowed, new_selections = confirm_removal(
            removed_book, allowed_books, selections, bundle
        )

        # Every non-conflicting selection should still be present
        for table_name in SELECTION_TABLES:
            bundle_table = bundle.get(table_name, {})
            for entry_id in selections.get(table_name, []):
                entry = bundle_table.get(entry_id, {})
                source_id = entry.get("_sourceBookId")

                # Determine if this entry conflicts with the removed book
                matches = False
                if isinstance(source_id, list):
                    matches = removed_book in source_id
                elif source_id is not None:
                    matches = source_id == removed_book

                if not matches:
                    assert entry_id in new_selections[table_name], (
                        f"Non-conflicting entry {entry_id!r} in table "
                        f"{table_name!r} (source={source_id!r}) was incorrectly "
                        f"removed during confirmation of {removed_book!r}."
                    )
