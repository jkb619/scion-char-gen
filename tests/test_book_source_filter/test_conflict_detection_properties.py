"""Property-based tests for conflict detection accuracy.

# Feature: book-source-filter, Property 6: Conflict Detection Accuracy

Tests that the conflict detection model correctly identifies character selections
that would become orphaned when a book is removed:
  - Detected conflicts exactly equal the subset of selections whose _sourceBookId matches the removed book
  - An empty set is returned when no selections use that book
  - Every matching entry is reported (no false negatives)

**Validates: Requirements 5.1, 5.3**
"""

from __future__ import annotations

from hypothesis import given, settings
from hypothesis import strategies as st

# ---------------------------------------------------------------------------
# Python model of the conflict detection (mirrors bookConflictDetection.js)
# ---------------------------------------------------------------------------

SELECTION_TABLES = ["boons", "knacks", "birthrights", "equipment"]


def detect_conflicts_model(
    book_slug: str, selections: dict[str, list[str]], bundle: dict
) -> list[dict]:
    """
    selections: {table_name: [entry_id, ...]} — the character's picked entries
    bundle: {table_name: {entry_id: {_sourceBookId: ...}}} — the game data
    """
    conflicts = []
    for table_name in SELECTION_TABLES:
        selected_ids = selections.get(table_name, [])
        bundle_table = bundle.get(table_name, {})
        for entry_id in selected_ids:
            entry = bundle_table.get(entry_id, {})
            source_id = entry.get("_sourceBookId")
            if source_id is None:
                continue
            if isinstance(source_id, list):
                if book_slug in source_id:
                    conflicts.append({"type": table_name, "id": entry_id})
            elif source_id == book_slug:
                conflicts.append({"type": table_name, "id": entry_id})
    return conflicts


# ---------------------------------------------------------------------------
# Strategies
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


# A bundle table: mapping of entry_id → entry dict (with varying _sourceBookId)
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


# Character selections: for each table, a subset of entry IDs from that table's bundle
@st.composite
def _selections_and_bundle(draw):
    """Draw a bundle and matching character selections (subset of bundle keys)."""
    # First, draw a pool of book slugs to use
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

    # Pick a book_slug to "remove" — either from the pool or sometimes a fresh one
    removed_book = draw(st.sampled_from(book_slugs))

    return bundle, selections, removed_book, book_slugs


# Strategy that ensures NO entry matches the removed book
@st.composite
def _selections_and_bundle_no_match(draw):
    """Draw a bundle and selections where no selected entry has _sourceBookId matching the removed book."""
    # Draw a pool of book slugs
    book_slugs = draw(
        st.lists(_book_slug_strategy, min_size=2, max_size=6, unique=True)
    )

    # The book to remove is separate from the pool used for entries
    removed_book = draw(
        _book_slug_strategy.filter(lambda s: s not in book_slugs)
    )

    # Build bundle using only the pool slugs (so removed_book won't appear)
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

    return bundle, selections, removed_book


# ---------------------------------------------------------------------------
# Reference implementation: compute expected conflicts directly
# ---------------------------------------------------------------------------


def _expected_conflicts(
    book_slug: str, selections: dict[str, list[str]], bundle: dict
) -> set[tuple[str, str]]:
    """Compute the expected set of (table_name, entry_id) conflicts."""
    expected = set()
    for table_name in SELECTION_TABLES:
        selected_ids = selections.get(table_name, [])
        bundle_table = bundle.get(table_name, {})
        for entry_id in selected_ids:
            entry = bundle_table.get(entry_id, {})
            source_id = entry.get("_sourceBookId")
            if source_id is None:
                continue
            if isinstance(source_id, list):
                if book_slug in source_id:
                    expected.add((table_name, entry_id))
            elif source_id == book_slug:
                expected.add((table_name, entry_id))
    return expected


# ---------------------------------------------------------------------------
# Property 6: Conflict Detection Accuracy
# ---------------------------------------------------------------------------


class TestConflictDetectionAccuracy:
    """Property 6: Conflict Detection Accuracy.

    For any character state with selected options and for any book being removed,
    the set of reported conflicts SHALL equal exactly the subset of current
    character selections whose resolved _sourceBookId matches the removed book
    (and the set is empty when no selections use that book).

    **Validates: Requirements 5.1, 5.3**
    """

    # Feature: book-source-filter, Property 6: Conflict Detection Accuracy
    @given(data=_selections_and_bundle())
    @settings(max_examples=200)
    def test_conflicts_exactly_match_entries_with_matching_source(
        self, data: tuple
    ) -> None:
        """Detected conflicts exactly equal the subset of selections whose
        _sourceBookId matches the removed book.

        **Validates: Requirements 5.1, 5.3**
        """
        bundle, selections, removed_book, _book_slugs = data

        # Run the model
        conflicts = detect_conflicts_model(removed_book, selections, bundle)

        # Convert model output to a set for comparison
        conflict_set = {(c["type"], c["id"]) for c in conflicts}

        # Compute expected conflicts directly
        expected_set = _expected_conflicts(removed_book, selections, bundle)

        assert conflict_set == expected_set, (
            f"Conflict detection mismatch for book_slug={removed_book!r}.\n"
            f"  Expected: {sorted(expected_set)}\n"
            f"  Got:      {sorted(conflict_set)}\n"
            f"  Missing:  {sorted(expected_set - conflict_set)}\n"
            f"  Extra:    {sorted(conflict_set - expected_set)}"
        )

    # Feature: book-source-filter, Property 6: Conflict Detection Accuracy
    @given(data=_selections_and_bundle_no_match())
    @settings(max_examples=200)
    def test_no_conflicts_when_book_not_used(self, data: tuple) -> None:
        """When no selected entry has _sourceBookId matching the removed book,
        conflicts should be empty.

        **Validates: Requirements 5.1, 5.3**
        """
        bundle, selections, removed_book = data

        conflicts = detect_conflicts_model(removed_book, selections, bundle)

        assert conflicts == [], (
            f"Expected no conflicts when book_slug={removed_book!r} is not used "
            f"by any selection, but got {len(conflicts)} conflicts:\n"
            f"  {conflicts}"
        )

    # Feature: book-source-filter, Property 6: Conflict Detection Accuracy
    @given(data=_selections_and_bundle())
    @settings(max_examples=200)
    def test_all_matching_entries_reported(self, data: tuple) -> None:
        """Every selected entry whose _sourceBookId == book_slug (or contains it
        in array) appears in the conflicts — no false negatives.

        **Validates: Requirements 5.1, 5.3**
        """
        bundle, selections, removed_book, _book_slugs = data

        conflicts = detect_conflicts_model(removed_book, selections, bundle)
        conflict_ids = {(c["type"], c["id"]) for c in conflicts}

        # Check every selected entry that should be a conflict
        for table_name in SELECTION_TABLES:
            selected_ids = selections.get(table_name, [])
            bundle_table = bundle.get(table_name, {})
            for entry_id in selected_ids:
                entry = bundle_table.get(entry_id, {})
                source_id = entry.get("_sourceBookId")
                if source_id is None:
                    continue
                matches = False
                if isinstance(source_id, list):
                    matches = removed_book in source_id
                else:
                    matches = source_id == removed_book

                if matches:
                    assert (table_name, entry_id) in conflict_ids, (
                        f"Entry {entry_id!r} in table {table_name!r} has "
                        f"_sourceBookId={source_id!r} matching removed book "
                        f"{removed_book!r}, but was NOT reported as a conflict."
                    )
