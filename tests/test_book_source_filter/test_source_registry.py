"""Unit tests for SourceRegistry.

Validates:
- Requirement 1.1: All core books present in the registry
- Requirement 1.4: Malformed files skipped with warning
"""

from __future__ import annotations

import json
import warnings
from pathlib import Path

import pytest

from app.services.source_registry import CORE_BOOKS, BookEntry, SourceRegistry

# The real books directory in the project.
REAL_BOOKS_DIR = Path(__file__).resolve().parents[2] / "src" / "data" / "books"


class TestCoreBooks:
    """Requirement 1.1: All core books are present in the registry."""

    def test_core_books_present(self) -> None:
        """All 20 core book slugs from CORE_BOOKS are in registry.entries."""
        registry = SourceRegistry(books_dir=REAL_BOOKS_DIR)
        entries = registry.entries

        assert len(CORE_BOOKS) == 20, "Expected exactly 20 core books in CORE_BOOKS list"
        for book in CORE_BOOKS:
            assert book.slug in entries, f"Core book '{book.slug}' missing from registry"
            assert entries[book.slug].title == book.title

    def test_core_books_without_books_dir(self, tmp_path: Path) -> None:
        """Core books are present even with an empty books directory."""
        registry = SourceRegistry(books_dir=tmp_path)
        entries = registry.entries

        for book in CORE_BOOKS:
            assert book.slug in entries


class TestRealBooksDiscovery:
    """Requirement 1.2: Real book files from src/data/books/ are discovered."""

    EXPECTED_DISCOVERED_SLUGS = [
        "divine_arenas",
        "divine_garage",
        "divine_identities",
        "divine_menagerie",
        "reconditioned",
        "scion_britannias_dragons",
    ]

    def test_real_books_discovered(self) -> None:
        """All real book files in src/data/books/ are discovered in registry.entries."""
        registry = SourceRegistry(books_dir=REAL_BOOKS_DIR)
        entries = registry.entries

        for slug in self.EXPECTED_DISCOVERED_SLUGS:
            assert slug in entries, f"Book '{slug}' should be discovered from real books dir"

    def test_discovered_books_have_titles(self) -> None:
        """Discovered books have non-empty titles."""
        registry = SourceRegistry(books_dir=REAL_BOOKS_DIR)
        entries = registry.entries

        for slug in self.EXPECTED_DISCOVERED_SLUGS:
            assert entries[slug].title, f"Book '{slug}' should have a non-empty title"


class TestMalformedFiles:
    """Requirement 1.4: Malformed files are skipped with a warning."""

    def test_malformed_file_skipped_with_warning(self, tmp_path: Path) -> None:
        """Invalid JSON is skipped and a warning is emitted."""
        bad_file = tmp_path / "broken.json"
        bad_file.write_text("this is not valid json {{{", encoding="utf-8")

        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            registry = SourceRegistry(books_dir=tmp_path, core_books=[])

        assert len(registry.entries) == 0, "Malformed file should not produce an entry"
        assert len(caught) == 1
        assert "broken.json" in str(caught[0].message)

    def test_missing_meta_skipped(self, tmp_path: Path) -> None:
        """JSON without _meta block is skipped with a warning."""
        no_meta_file = tmp_path / "no_meta.json"
        no_meta_file.write_text(json.dumps({"equipment": {}}), encoding="utf-8")

        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            registry = SourceRegistry(books_dir=tmp_path, core_books=[])

        assert len(registry.entries) == 0
        assert len(caught) == 1
        assert "no_meta.json" in str(caught[0].message)
        assert "_meta" in str(caught[0].message)

    def test_non_dict_top_level_skipped(self, tmp_path: Path) -> None:
        """JSON with a non-dict top level is skipped with a warning."""
        array_file = tmp_path / "array.json"
        array_file.write_text(json.dumps([1, 2, 3]), encoding="utf-8")

        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            registry = SourceRegistry(books_dir=tmp_path, core_books=[])

        assert len(registry.entries) == 0
        assert len(caught) == 1
        assert "array.json" in str(caught[0].message)


class TestSlugForPdf:
    """Test slug_for_pdf lookup."""

    def test_slug_for_pdf(self) -> None:
        """slug_for_pdf returns the correct slug for a known PDF filename."""
        registry = SourceRegistry(books_dir=REAL_BOOKS_DIR)

        assert registry.slug_for_pdf("7711-Divine_Arenas.pdf") == "divine_arenas"

    def test_slug_for_pdf_case_insensitive(self) -> None:
        """slug_for_pdf matching is case-insensitive."""
        registry = SourceRegistry(books_dir=REAL_BOOKS_DIR)

        assert registry.slug_for_pdf("7711-divine_arenas.PDF") == "divine_arenas"

    def test_slug_for_pdf_unknown(self) -> None:
        """slug_for_pdf returns None for unknown PDF filename."""
        registry = SourceRegistry(books_dir=REAL_BOOKS_DIR)

        assert registry.slug_for_pdf("unknown_book.pdf") is None


class TestSlugForTitleSubstring:
    """Test slug_for_title_substring lookup — longest match wins."""

    def test_slug_for_title_substring(self) -> None:
        """Longest match wins: 'Scion: Dragon Companion' matches dragon_companion."""
        registry = SourceRegistry(books_dir=REAL_BOOKS_DIR)

        # "Scion: Dragon Companion" (len 23) is longer than "Scion: Dragon" (len 13)
        result = registry.slug_for_title_substring("Scion: Dragon Companion stuff")
        assert result == "dragon_companion"

    def test_slug_for_title_substring_shorter_match(self) -> None:
        """When only the shorter title matches, it is returned."""
        registry = SourceRegistry(books_dir=REAL_BOOKS_DIR)

        # "Scion: Dragon" matches but "Scion: Dragon Companion" does not
        result = registry.slug_for_title_substring("Scion: Dragon unleashed")
        assert result == "scion_dragon"

    def test_slug_for_title_substring_no_match(self) -> None:
        """Returns None when no title matches."""
        registry = SourceRegistry(books_dir=REAL_BOOKS_DIR)

        assert registry.slug_for_title_substring("Totally Unknown Book XYZ") is None


class TestTitlesSorted:
    """Test titles_sorted returns alphabetical order."""

    def test_titles_sorted(self) -> None:
        """titles_sorted returns entries alphabetically by title (case-insensitive)."""
        registry = SourceRegistry(books_dir=REAL_BOOKS_DIR)
        sorted_titles = registry.titles_sorted()

        # Verify it's a list of (slug, title) tuples
        assert len(sorted_titles) > 0
        assert all(isinstance(pair, tuple) and len(pair) == 2 for pair in sorted_titles)

        # Verify alphabetical sort
        titles = [title for _, title in sorted_titles]
        assert titles == sorted(titles, key=str.lower)
