"""Property-based tests for the SourceRegistry auto-discovery.

# Feature: book-source-filter, Property 1: Registry Auto-Discovery

Tests that for any valid book JSON file placed in the books directory (containing
a _meta object with slug and title fields), the SourceRegistry includes an entry
for that file's slug without code changes.

**Validates: Requirements 1.2**
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

from hypothesis import given, settings
from hypothesis import strategies as st

from app.services.source_registry import BookEntry, SourceRegistry

# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Valid slug: non-empty string of lowercase letters and underscores
_slug_strategy = st.from_regex(r"[a-z][a-z_]{0,29}", fullmatch=True)

# Valid title: non-empty printable text (at least 1 character, up to 80)
_title_strategy = st.text(
    alphabet=st.characters(categories=("L", "N", "P", "Z", "S"), exclude_characters="\x00"),
    min_size=1,
    max_size=80,
).filter(lambda s: s.strip() != "")


# ---------------------------------------------------------------------------
# Property 1: Registry Auto-Discovery
# ---------------------------------------------------------------------------


@given(slug=_slug_strategy, title=_title_strategy)
@settings(max_examples=200)
def test_registry_auto_discovers_valid_book_json(slug: str, title: str) -> None:
    """For any valid _meta with slug and title, the registry includes that slug."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        books_dir = Path(tmp_dir)

        # Write a temporary JSON file with the required _meta block
        book_data = {"_meta": {"slug": slug, "title": title}}
        book_file = books_dir / f"{slug}.json"
        book_file.write_text(json.dumps(book_data), encoding="utf-8")

        # Construct registry with no core books, pointing at the temp directory
        registry = SourceRegistry(books_dir=books_dir, core_books=[])

        # Assert the slug was discovered
        assert slug in registry.entries, (
            f"Expected slug '{slug}' to be in registry.entries after writing "
            f"a valid book JSON, but got: {list(registry.entries.keys())}"
        )

        # Verify the entry has the correct title
        entry = registry.entries[slug]
        assert entry.title == title.strip()
        assert entry.slug == slug
