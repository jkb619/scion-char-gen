"""Property-based tests for stale file detection correctness.

# Feature: unified-pdf-extractor, Property 14: Stale File Detection Correctness

For any set of JSON files in `src/data/books/` and a set of active slugs derived
from processed specs, the stale file detector SHALL identify exactly those files
whose stem is not in the active slugs set and whose extension is `.json`
(excluding non-JSON files like `_README.txt`).

**Validates: Requirements 10.1**
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

from hypothesis import given, settings
from hypothesis import strategies as st

# Ensure src/scripts is importable
_SCRIPTS = Path(__file__).resolve().parents[2] / "src" / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from stale_cleaner import find_stale_files


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Valid slug characters: lowercase letters, digits, and underscores
slug_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("Ll", "Nd"), whitelist_characters="_"),
    min_size=1,
    max_size=30,
).filter(lambda s: s[0].isalpha())

# Non-JSON filenames (should always be excluded from stale detection)
non_json_filename_strategy = st.one_of(
    st.just("_README.txt"),
    st.just("notes.md"),
    st.just(".gitkeep"),
    st.text(
        alphabet=st.characters(whitelist_categories=("Ll", "Nd"), whitelist_characters="_-."),
        min_size=2,
        max_size=20,
    ).filter(lambda s: not s.endswith(".json") and s[0].isalpha()),
)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestStaleFileDetectionCorrectness:
    """Property 14: Stale File Detection Correctness."""

    @settings(max_examples=100)
    @given(
        all_slugs=st.lists(slug_strategy, min_size=0, max_size=15, unique=True),
        active_ratio=st.floats(min_value=0.0, max_value=1.0),
        non_json_files=st.lists(non_json_filename_strategy, min_size=0, max_size=5, unique=True),
    )
    def test_find_stale_files_identifies_exactly_non_active_json_files(
        self,
        all_slugs: list[str],
        active_ratio: float,
        non_json_files: list[str],
    ) -> None:
        """Stale detector returns exactly the JSON files whose stems are not active."""
        # Split slugs into active and stale based on ratio
        split_point = int(len(all_slugs) * active_ratio)
        active_slugs = set(all_slugs[:split_point])
        stale_slugs = set(all_slugs[split_point:])

        with tempfile.TemporaryDirectory() as tmp:
            books_dir = Path(tmp)

            # Create JSON files for all slugs
            for slug in all_slugs:
                (books_dir / f"{slug}.json").write_text("{}")

            # Create non-JSON files (should never be reported as stale)
            for filename in non_json_files:
                (books_dir / filename).write_text("not json")

            # Run stale file detection
            result = find_stale_files(books_dir, active_slugs)

            # Verify: result contains exactly the stale JSON files
            result_stems = {p.stem for p in result}
            assert result_stems == stale_slugs, (
                f"Expected stale stems {stale_slugs}, got {result_stems}"
            )

            # Verify: all returned paths are .json files
            for path in result:
                assert path.suffix == ".json"

            # Verify: no non-JSON files are included
            non_json_names = set(non_json_files)
            for path in result:
                assert path.name not in non_json_names

    @settings(max_examples=100)
    @given(
        active_slugs=st.lists(slug_strategy, min_size=1, max_size=10, unique=True),
    )
    def test_active_files_are_never_reported_as_stale(
        self,
        active_slugs: list[str],
    ) -> None:
        """Files whose stems are in the active set are never returned."""
        with tempfile.TemporaryDirectory() as tmp:
            books_dir = Path(tmp)

            # Create JSON files only for active slugs
            for slug in active_slugs:
                (books_dir / f"{slug}.json").write_text("{}")

            result = find_stale_files(books_dir, set(active_slugs))

            # No files should be reported as stale
            assert result == [], f"Expected no stale files, got {result}"

    @settings(max_examples=100)
    @given(
        stale_slugs=st.lists(slug_strategy, min_size=1, max_size=10, unique=True),
    )
    def test_all_files_stale_when_active_set_empty(
        self,
        stale_slugs: list[str],
    ) -> None:
        """When active slugs is empty, all JSON files are stale."""
        with tempfile.TemporaryDirectory() as tmp:
            books_dir = Path(tmp)

            for slug in stale_slugs:
                (books_dir / f"{slug}.json").write_text("{}")

            result = find_stale_files(books_dir, set())

            result_stems = {p.stem for p in result}
            assert result_stems == set(stale_slugs)

    @settings(max_examples=100)
    @given(
        non_json_files=st.lists(non_json_filename_strategy, min_size=1, max_size=10, unique=True),
    )
    def test_non_json_files_are_never_reported_as_stale(
        self,
        non_json_files: list[str],
    ) -> None:
        """Non-JSON files are excluded from stale detection regardless of active slugs."""
        with tempfile.TemporaryDirectory() as tmp:
            books_dir = Path(tmp)

            for filename in non_json_files:
                (books_dir / filename).write_text("content")

            # Even with empty active slugs, non-JSON files should not appear
            result = find_stale_files(books_dir, set())

            assert result == [], (
                f"Non-JSON files should never be stale, got {result}"
            )
