"""Unit and property tests for the stale file cleaner module."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Ensure the scripts directory is importable
_SCRIPTS = Path(__file__).resolve().parents[2] / "src" / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from stale_cleaner import clean_stale_files, find_stale_files


# ---------------------------------------------------------------------------
# Unit Tests
# ---------------------------------------------------------------------------


class TestFindStaleFiles:
    """Tests for find_stale_files."""

    def test_empty_directory(self, tmp_path: Path) -> None:
        """Returns empty list for an empty directory."""
        books_dir = tmp_path / "books"
        books_dir.mkdir()
        result = find_stale_files(books_dir, {"some_slug"})
        assert result == []

    def test_nonexistent_directory(self, tmp_path: Path) -> None:
        """Returns empty list when directory does not exist."""
        result = find_stale_files(tmp_path / "nonexistent", {"some_slug"})
        assert result == []

    def test_all_files_active(self, tmp_path: Path) -> None:
        """Returns empty list when all JSON files match active slugs."""
        books_dir = tmp_path / "books"
        books_dir.mkdir()
        (books_dir / "book_a.json").write_text("{}")
        (books_dir / "book_b.json").write_text("{}")

        result = find_stale_files(books_dir, {"book_a", "book_b"})
        assert result == []

    def test_identifies_stale_files(self, tmp_path: Path) -> None:
        """Identifies JSON files whose stem is not in active slugs."""
        books_dir = tmp_path / "books"
        books_dir.mkdir()
        (books_dir / "active_book.json").write_text("{}")
        stale_file = books_dir / "removed_book.json"
        stale_file.write_text("{}")

        result = find_stale_files(books_dir, {"active_book"})
        assert result == [stale_file]

    def test_skips_non_json_files(self, tmp_path: Path) -> None:
        """Non-JSON files like _README.txt are never flagged as stale."""
        books_dir = tmp_path / "books"
        books_dir.mkdir()
        (books_dir / "_README.txt").write_text("info")
        (books_dir / "notes.md").write_text("# notes")
        (books_dir / "stale_book.json").write_text("{}")

        result = find_stale_files(books_dir, set())
        # Only the .json file is stale, not the .txt or .md
        assert result == [books_dir / "stale_book.json"]

    def test_returns_sorted_paths(self, tmp_path: Path) -> None:
        """Returned stale files are sorted by path."""
        books_dir = tmp_path / "books"
        books_dir.mkdir()
        (books_dir / "z_book.json").write_text("{}")
        (books_dir / "a_book.json").write_text("{}")
        (books_dir / "m_book.json").write_text("{}")

        result = find_stale_files(books_dir, set())
        assert result == [
            books_dir / "a_book.json",
            books_dir / "m_book.json",
            books_dir / "z_book.json",
        ]

    def test_empty_active_slugs_all_json_stale(self, tmp_path: Path) -> None:
        """When no slugs are active, all JSON files are stale."""
        books_dir = tmp_path / "books"
        books_dir.mkdir()
        (books_dir / "book1.json").write_text("{}")
        (books_dir / "book2.json").write_text("{}")

        result = find_stale_files(books_dir, set())
        assert len(result) == 2

    def test_skips_subdirectories(self, tmp_path: Path) -> None:
        """Directories inside books/ are not treated as stale files."""
        books_dir = tmp_path / "books"
        books_dir.mkdir()
        sub_dir = books_dir / "subdir.json"
        sub_dir.mkdir()  # directory with .json name

        result = find_stale_files(books_dir, set())
        assert result == []


class TestCleanStaleFiles:
    """Tests for clean_stale_files."""

    def test_deletes_files_in_normal_mode(self, tmp_path: Path) -> None:
        """Deletes stale files and returns their paths."""
        f1 = tmp_path / "stale1.json"
        f2 = tmp_path / "stale2.json"
        f1.write_text("{}")
        f2.write_text("{}")

        result = clean_stale_files([f1, f2], dry_run=False)
        assert result == [f1, f2]
        assert not f1.exists()
        assert not f2.exists()

    def test_dry_run_does_not_delete(self, tmp_path: Path, capsys) -> None:
        """In dry-run mode, files are reported but not deleted."""
        f1 = tmp_path / "stale.json"
        f1.write_text("{}")

        result = clean_stale_files([f1], dry_run=True)
        assert result == []
        assert f1.exists()

        captured = capsys.readouterr()
        assert "[DRY-RUN]" in captured.out
        assert "stale.json" in captured.out

    def test_empty_list_no_op(self) -> None:
        """Empty stale list produces no deletions."""
        result = clean_stale_files([], dry_run=False)
        assert result == []

    def test_returns_empty_in_dry_run(self, tmp_path: Path) -> None:
        """Returns empty list in dry-run mode (nothing was actually deleted)."""
        f1 = tmp_path / "file.json"
        f1.write_text("{}")

        result = clean_stale_files([f1], dry_run=True)
        assert result == []
