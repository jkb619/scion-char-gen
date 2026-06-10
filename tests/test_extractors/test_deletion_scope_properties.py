"""Property-based tests for deletion scope safety.

# Feature: unified-pdf-extractor, Property 15: Deletion Scope Safety

For any cleanup operation, the stale cleaner SHALL only delete files within the
`src/data/books/` directory. No file in `src/data/tables/`, `src/data/_extracted/`,
or `src/data/` root SHALL be deleted during cleanup.

**Validates: Requirements 10.4**
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

from stale_cleaner import clean_stale_files, find_stale_files


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Valid slug characters: lowercase letters, digits, and underscores
slug_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("Ll", "Nd"), whitelist_characters="_"),
    min_size=1,
    max_size=20,
).filter(lambda s: s[0].isalpha())

# Filenames for files placed in protected directories (tables, _extracted, root)
protected_filename_strategy = st.one_of(
    # JSON files (the kind that could be confused with book slice files)
    slug_strategy.map(lambda s: f"{s}.json"),
    # Non-JSON files
    st.just("_README.txt"),
    st.just("notes.md"),
    st.just("config.yaml"),
)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestDeletionScopeSafety:
    """Property 15: Deletion Scope Safety.

    The stale cleaner SHALL only delete files within the `src/data/books/`
    directory. No file in `src/data/tables/`, `src/data/_extracted/`, or
    `src/data/` root SHALL be deleted during cleanup.
    """

    @settings(max_examples=100)
    @given(
        books_slugs=st.lists(slug_strategy, min_size=0, max_size=10, unique=True),
        active_slugs_subset=st.lists(st.booleans(), min_size=0, max_size=10),
        tables_files=st.lists(protected_filename_strategy, min_size=1, max_size=5, unique=True),
        extracted_files=st.lists(protected_filename_strategy, min_size=1, max_size=5, unique=True),
        root_files=st.lists(protected_filename_strategy, min_size=1, max_size=5, unique=True),
    )
    def test_find_stale_files_only_returns_paths_within_books_dir(
        self,
        books_slugs: list[str],
        active_slugs_subset: list[bool],
        tables_files: list[str],
        extracted_files: list[str],
        root_files: list[str],
    ) -> None:
        """find_stale_files only ever returns paths within the books directory."""
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp) / "src" / "data"
            books_dir = data_dir / "books"
            tables_dir = data_dir / "tables"
            extracted_dir = data_dir / "_extracted"

            # Create directory structure
            books_dir.mkdir(parents=True)
            tables_dir.mkdir(parents=True)
            extracted_dir.mkdir(parents=True)

            # Create files in books/ directory
            for slug in books_slugs:
                (books_dir / f"{slug}.json").write_text("{}")

            # Create files in protected directories
            for fname in tables_files:
                (tables_dir / fname).write_text("{}")
            for fname in extracted_files:
                (extracted_dir / fname).write_text("{}")
            for fname in root_files:
                (data_dir / fname).write_text("{}")

            # Determine which books slugs are "active"
            active = set()
            for i, slug in enumerate(books_slugs):
                if i < len(active_slugs_subset) and active_slugs_subset[i]:
                    active.add(slug)

            # find_stale_files should ONLY return paths within books_dir
            result = find_stale_files(books_dir, active)

            for path in result:
                assert path.parent == books_dir, (
                    f"find_stale_files returned a path outside books/: {path}"
                )

            # Verify no paths from protected directories appear
            tables_paths = set(tables_dir / f for f in tables_files)
            extracted_paths = set(extracted_dir / f for f in extracted_files)
            root_paths = set(data_dir / f for f in root_files)

            result_set = set(result)
            assert result_set.isdisjoint(tables_paths), (
                f"Stale detection included tables/ files: {result_set & tables_paths}"
            )
            assert result_set.isdisjoint(extracted_paths), (
                f"Stale detection included _extracted/ files: {result_set & extracted_paths}"
            )
            assert result_set.isdisjoint(root_paths), (
                f"Stale detection included data/ root files: {result_set & root_paths}"
            )

    @settings(max_examples=100)
    @given(
        stale_slugs=st.lists(slug_strategy, min_size=1, max_size=8, unique=True),
        tables_files=st.lists(protected_filename_strategy, min_size=1, max_size=5, unique=True),
        extracted_files=st.lists(protected_filename_strategy, min_size=1, max_size=5, unique=True),
        root_files=st.lists(protected_filename_strategy, min_size=1, max_size=5, unique=True),
    )
    def test_clean_stale_files_only_deletes_within_books_dir(
        self,
        stale_slugs: list[str],
        tables_files: list[str],
        extracted_files: list[str],
        root_files: list[str],
    ) -> None:
        """clean_stale_files only deletes files within the books directory.

        Even when given stale files identified by find_stale_files, the
        cleanup must not affect files in tables/, _extracted/, or data/ root.
        """
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp) / "src" / "data"
            books_dir = data_dir / "books"
            tables_dir = data_dir / "tables"
            extracted_dir = data_dir / "_extracted"

            # Create directory structure
            books_dir.mkdir(parents=True)
            tables_dir.mkdir(parents=True)
            extracted_dir.mkdir(parents=True)

            # Create stale files in books/ directory
            stale_files = []
            for slug in stale_slugs:
                path = books_dir / f"{slug}.json"
                path.write_text("{}")
                stale_files.append(path)

            # Create files in protected directories
            for fname in tables_files:
                (tables_dir / fname).write_text("{}")
            for fname in extracted_files:
                (extracted_dir / fname).write_text("{}")
            for fname in root_files:
                (data_dir / fname).write_text("{}")

            # Run cleanup on the stale files (as returned by find_stale_files)
            deleted = clean_stale_files(stale_files, dry_run=False)

            # All deleted files must be within books_dir
            for path in deleted:
                assert path.parent == books_dir, (
                    f"clean_stale_files deleted a file outside books/: {path}"
                )

            # Files in protected directories must still exist
            for fname in tables_files:
                assert (tables_dir / fname).exists(), (
                    f"File in tables/ was deleted: {tables_dir / fname}"
                )
            for fname in extracted_files:
                assert (extracted_dir / fname).exists(), (
                    f"File in _extracted/ was deleted: {extracted_dir / fname}"
                )
            for fname in root_files:
                assert (data_dir / fname).exists(), (
                    f"File in data/ root was deleted: {data_dir / fname}"
                )

    @settings(max_examples=100)
    @given(
        books_slugs=st.lists(slug_strategy, min_size=1, max_size=8, unique=True),
        tables_files=st.lists(protected_filename_strategy, min_size=1, max_size=5, unique=True),
        extracted_files=st.lists(protected_filename_strategy, min_size=1, max_size=5, unique=True),
        root_files=st.lists(protected_filename_strategy, min_size=1, max_size=5, unique=True),
    )
    def test_full_cleanup_workflow_preserves_protected_directories(
        self,
        books_slugs: list[str],
        tables_files: list[str],
        extracted_files: list[str],
        root_files: list[str],
    ) -> None:
        """End-to-end: find_stale_files -> clean_stale_files never touches
        protected directories even when active_slugs is empty (worst case).
        """
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp) / "src" / "data"
            books_dir = data_dir / "books"
            tables_dir = data_dir / "tables"
            extracted_dir = data_dir / "_extracted"

            # Create directory structure
            books_dir.mkdir(parents=True)
            tables_dir.mkdir(parents=True)
            extracted_dir.mkdir(parents=True)

            # Create JSON files in books/ (all will be stale since active_slugs is empty)
            for slug in books_slugs:
                (books_dir / f"{slug}.json").write_text("{}")

            # Create files in protected directories
            for fname in tables_files:
                (tables_dir / fname).write_text("tables content")
            for fname in extracted_files:
                (extracted_dir / fname).write_text("extracted content")
            for fname in root_files:
                (data_dir / fname).write_text("root content")

            # Run full workflow with empty active slugs (maximum deletion)
            stale = find_stale_files(books_dir, set())
            deleted = clean_stale_files(stale, dry_run=False)

            # All books/ JSON files should be deleted
            for slug in books_slugs:
                assert not (books_dir / f"{slug}.json").exists(), (
                    f"Stale book file was not deleted: {slug}.json"
                )

            # All protected directory files must still exist with correct content
            for fname in tables_files:
                path = tables_dir / fname
                assert path.exists(), f"tables/ file deleted: {path}"
                assert path.read_text() == "tables content"
            for fname in extracted_files:
                path = extracted_dir / fname
                assert path.exists(), f"_extracted/ file deleted: {path}"
                assert path.read_text() == "extracted content"
            for fname in root_files:
                path = data_dir / fname
                assert path.exists(), f"data/ root file deleted: {path}"
                assert path.read_text() == "root content"

            # Deleted list should only contain books/ paths
            for path in deleted:
                assert books_dir in path.parents or path.parent == books_dir, (
                    f"Deleted path outside books/: {path}"
                )
