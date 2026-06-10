"""Property-based tests for regression detection accuracy.

# Feature: unified-pdf-extractor, Property 13: Regression Detection Accuracy

For any extraction result R and baseline B where R contains fewer entries than B,
the validation reporter SHALL produce a warning listing exactly the set of entry IDs
present in B but absent from R.

**Validates: Requirements 9.2**
"""

from __future__ import annotations

from hypothesis import given, settings
from hypothesis import strategies as st

from extractors.base import CategoryResult
from extraction_logger import check_regression


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Entry IDs: non-empty alphanumeric strings that could be valid identifiers
entry_id_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N"), whitelist_characters="_"),
    min_size=1,
    max_size=30,
)


@st.composite
def regression_scenario(draw):
    """Generate a baseline ID set and a current result with some entries missing.

    Ensures the current result has strictly fewer entries than the baseline,
    so there is always at least one missing ID.
    """
    # Generate a baseline set of unique entry IDs (at least 2 entries)
    baseline_ids = draw(
        st.frozensets(entry_id_strategy, min_size=2, max_size=50)
    )
    baseline_set = set(baseline_ids)

    # Select a non-empty proper subset to keep in current results
    # (i.e., remove at least one entry from baseline)
    keep_count = draw(st.integers(min_value=0, max_value=len(baseline_set) - 1))
    kept_ids = draw(
        st.sampled_from(sorted(baseline_set)).flatmap(
            lambda _: st.frozensets(
                st.sampled_from(sorted(baseline_set)),
                min_size=keep_count,
                max_size=keep_count,
            )
        )
    )

    # Build CategoryResult entries dict from kept IDs
    entries = {entry_id: {"name": entry_id} for entry_id in kept_ids}

    return baseline_set, entries


@st.composite
def regression_scenario_simple(draw):
    """Simpler strategy: generate baseline IDs, then pick a subset to keep.

    Always ensures at least one ID is missing from the current result.
    """
    # Generate baseline IDs
    baseline_list = draw(
        st.lists(entry_id_strategy, min_size=2, max_size=50, unique=True)
    )
    baseline_set = set(baseline_list)

    # Decide how many to keep (at least 0, at most len-1 so at least 1 is missing)
    max_keep = len(baseline_list) - 1
    keep_count = draw(st.integers(min_value=0, max_value=max_keep))

    # Pick which IDs to keep
    kept_ids = set(draw(
        st.sampled_from(sorted(baseline_set))
        if keep_count == 1
        else st.lists(
            st.sampled_from(sorted(baseline_set)),
            min_size=keep_count,
            max_size=keep_count,
            unique=True,
        )
    )) if keep_count > 0 else set()

    # Build CategoryResult entries dict from kept IDs
    entries = {entry_id: {"name": entry_id} for entry_id in kept_ids}

    return baseline_set, entries


@st.composite
def no_regression_scenario(draw):
    """Generate a scenario where current result contains all baseline entries (no regression)."""
    baseline_list = draw(
        st.lists(entry_id_strategy, min_size=0, max_size=30, unique=True)
    )
    baseline_set = set(baseline_list)

    # Current entries contain at least all baseline IDs (may have extras)
    extra_ids = draw(
        st.lists(entry_id_strategy, min_size=0, max_size=10, unique=True)
    )
    current_ids = baseline_set | set(extra_ids)
    entries = {entry_id: {"name": entry_id} for entry_id in current_ids}

    return baseline_set, entries


# ---------------------------------------------------------------------------
# Properties
# ---------------------------------------------------------------------------


class TestRegressionDetectionAccuracy:
    """Property 13: Regression Detection Accuracy."""

    @settings(max_examples=100)
    @given(
        baseline_ids=st.frozensets(entry_id_strategy, min_size=2, max_size=50),
        book_id=st.text(min_size=1, max_size=20, alphabet="abcdefghijklmnopqrstuvwxyz_"),
        category=st.text(min_size=1, max_size=20, alphabet="abcdefghijklmnopqrstuvwxyz_"),
    )
    def test_missing_ids_are_exactly_baseline_minus_current(
        self, baseline_ids, book_id, category
    ):
        """When current result has fewer entries than baseline, check_regression
        returns exactly the set of IDs present in baseline but absent from current."""
        baseline_set = set(baseline_ids)

        # Keep a strict subset: remove at least one entry
        # Use deterministic subset: keep all but the first (sorted) entry
        sorted_baseline = sorted(baseline_set)
        # Remove the first entry to guarantee at least one missing
        kept_ids = set(sorted_baseline[1:])

        result = CategoryResult(
            category=category,
            entries={eid: {"name": eid} for eid in kept_ids},
            entry_count=len(kept_ids),
        )

        missing = check_regression(book_id, category, result, baseline_set)

        expected_missing = sorted(baseline_set - kept_ids)
        assert missing == expected_missing

    @settings(max_examples=100)
    @given(
        baseline_ids=st.frozensets(entry_id_strategy, min_size=2, max_size=50),
        remove_count=st.data(),
        book_id=st.just("test_book"),
        category=st.just("knacks"),
    )
    def test_variable_removal_returns_exact_missing_set(
        self, baseline_ids, remove_count, book_id, category
    ):
        """For any number of removed entries from the baseline, check_regression
        returns exactly the removed IDs."""
        baseline_set = set(baseline_ids)
        sorted_baseline = sorted(baseline_set)

        # Remove a random number of entries (1 to all)
        n_remove = remove_count.draw(
            st.integers(min_value=1, max_value=len(sorted_baseline))
        )
        removed_ids = set(sorted_baseline[:n_remove])
        kept_ids = baseline_set - removed_ids

        result = CategoryResult(
            category=category,
            entries={eid: {"name": eid} for eid in kept_ids},
            entry_count=len(kept_ids),
        )

        missing = check_regression(book_id, category, result, baseline_set)

        expected_missing = sorted(removed_ids)
        assert missing == expected_missing

    @settings(max_examples=100)
    @given(
        baseline_ids=st.frozensets(entry_id_strategy, min_size=0, max_size=30),
        extra_ids=st.frozensets(entry_id_strategy, min_size=0, max_size=10),
        book_id=st.just("test_book"),
        category=st.just("boons"),
    )
    def test_no_regression_when_all_baseline_ids_present(
        self, baseline_ids, extra_ids, book_id, category
    ):
        """When current result contains all baseline IDs (possibly more),
        check_regression returns an empty list."""
        baseline_set = set(baseline_ids)
        # Current result contains all baseline + possibly extra entries
        current_ids = baseline_set | set(extra_ids)

        result = CategoryResult(
            category=category,
            entries={eid: {"name": eid} for eid in current_ids},
            entry_count=len(current_ids),
        )

        missing = check_regression(book_id, category, result, baseline_set)

        assert missing == []

    @settings(max_examples=100)
    @given(
        book_id=st.text(min_size=1, max_size=20, alphabet="abcdefghijklmnopqrstuvwxyz_"),
        category=st.text(min_size=1, max_size=20, alphabet="abcdefghijklmnopqrstuvwxyz_"),
        current_ids=st.frozensets(entry_id_strategy, min_size=0, max_size=20),
    )
    def test_none_baseline_always_returns_empty(
        self, book_id, category, current_ids
    ):
        """When baseline is None (no baseline exists), check_regression always
        returns an empty list regardless of current result content."""
        result = CategoryResult(
            category=category,
            entries={eid: {"name": eid} for eid in current_ids},
            entry_count=len(current_ids),
        )

        missing = check_regression(book_id, category, result, None)

        assert missing == []

    @settings(max_examples=100)
    @given(
        baseline_ids=st.frozensets(entry_id_strategy, min_size=1, max_size=50),
        book_id=st.just("test_book"),
        category=st.just("purviews"),
    )
    def test_empty_result_returns_all_baseline_ids(
        self, baseline_ids, book_id, category
    ):
        """When current result is completely empty, check_regression returns
        all baseline IDs as missing."""
        baseline_set = set(baseline_ids)

        result = CategoryResult(
            category=category,
            entries={},
            entry_count=0,
        )

        missing = check_regression(book_id, category, result, baseline_set)

        expected_missing = sorted(baseline_set)
        assert missing == expected_missing
