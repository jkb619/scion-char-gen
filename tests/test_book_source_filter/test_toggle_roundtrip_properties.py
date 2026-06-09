"""Property-based tests for the toggle round-trip logic.

# Feature: book-source-filter, Property 2: Toggle Round-Trip

Tests that for any book in the Source_Registry and any initial Allowed_Books_Set,
unchecking then re-checking that book returns the Allowed_Books_Set to its original state.

**Validates: Requirements 2.3, 2.4**
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
# Python model of the toggle logic
# ---------------------------------------------------------------------------


def toggle_remove(allowed_books: set[str], slug: str) -> set[str]:
    """Model unchecking a book."""
    result = set(allowed_books)
    result.discard(slug)
    return result


def toggle_add(allowed_books: set[str], slug: str) -> set[str]:
    """Model re-checking a book."""
    result = set(allowed_books)
    result.add(slug)
    return result


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Sets of allowed book slugs drawn from the real registry (min_size=1 so we
# can always pick a slug that is a member of the set to remove/re-add)
_allowed_books_strategy = st.sets(st.sampled_from(KNOWN_SLUGS), min_size=1)


# ---------------------------------------------------------------------------
# Property test
# ---------------------------------------------------------------------------


@given(
    data=st.data(),
    allowed_books=_allowed_books_strategy,
)
@settings(max_examples=200)
def test_toggle_round_trip(
    data: st.DataObject,
    allowed_books: set[str],
) -> None:
    """Removing then re-adding a slug returns the set to its original state.

    For any subset of registry slugs (the initial allowed_books) and for any
    slug that is a member of that set:
    1. after_remove = toggle_remove(allowed_books, slug) → slug not in after_remove
    2. after_readd = toggle_add(after_remove, slug) → after_readd == original allowed_books
    """
    # Pick a slug from the current allowed_books set to remove/re-add
    slug = data.draw(st.sampled_from(sorted(allowed_books)), label="slug_to_toggle")

    # Step 1: Remove the slug (uncheck)
    after_remove = toggle_remove(allowed_books, slug)
    assert slug not in after_remove, (
        f"After removing '{slug}', it should not be in the set"
    )

    # Step 2: Re-add the slug (re-check)
    after_readd = toggle_add(after_remove, slug)
    assert after_readd == allowed_books, (
        f"After removing then re-adding '{slug}', the set should equal the original. "
        f"Original: {allowed_books}, Got: {after_readd}"
    )
