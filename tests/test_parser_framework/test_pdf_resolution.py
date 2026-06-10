"""Tests for PDF resolution integration in the unified extractor CLI.

Validates:
- Requirement 2.1: Search precedence (--books-dir > SCION_BOOKS_DIR > <repo>/books > <repo>/../books)
- Requirement 2.2: First matching filename from spec's filenames list is accepted
- Requirement 2.3: Missing PDFs skip with [SKIP] warning; processing continues
- Requirement 2.4: All known PDF filename variants in spec's filenames list are supported
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

# Ensure src/scripts is importable
_SCRIPTS_DIR = Path(__file__).resolve().parents[2] / "src" / "scripts"
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from scion_books_dir import books_search_dirs, find_pdf_in_books


class TestBooksSearchDirsPrecedence:
    """Tests for Requirement 2.1: directory search precedence."""

    def test_explicit_dir_first_in_list(self, tmp_path):
        """--books-dir should appear first in the search order."""
        explicit = tmp_path / "explicit"
        explicit.mkdir()
        dirs = books_search_dirs(explicit)
        assert dirs[0] == explicit.resolve()

    def test_env_var_after_explicit(self, tmp_path, monkeypatch):
        """SCION_BOOKS_DIR comes after explicit dir."""
        explicit = tmp_path / "explicit"
        explicit.mkdir()
        env_dir = tmp_path / "env_books"
        env_dir.mkdir()
        monkeypatch.setenv("SCION_BOOKS_DIR", str(env_dir))

        dirs = books_search_dirs(explicit)
        assert dirs[0] == explicit.resolve()
        assert dirs[1] == env_dir.resolve()

    def test_env_var_first_when_no_explicit(self, tmp_path, monkeypatch):
        """SCION_BOOKS_DIR is first when no explicit dir is given."""
        env_dir = tmp_path / "env_books"
        env_dir.mkdir()
        monkeypatch.setenv("SCION_BOOKS_DIR", str(env_dir))

        dirs = books_search_dirs(None)
        assert dirs[0] == env_dir.resolve()

    def test_nonexistent_explicit_dir_excluded(self, tmp_path):
        """Explicit dir that doesn't exist is not included."""
        nonexistent = tmp_path / "does_not_exist"
        dirs = books_search_dirs(nonexistent)
        resolved = nonexistent.resolve()
        assert resolved not in dirs

    def test_nonexistent_env_dir_excluded(self, tmp_path, monkeypatch):
        """SCION_BOOKS_DIR that doesn't exist is not included."""
        monkeypatch.setenv("SCION_BOOKS_DIR", str(tmp_path / "nope"))
        dirs = books_search_dirs(None)
        # Should not include nonexistent env dir
        assert all("nope" not in str(d) for d in dirs)

    def test_empty_env_var_ignored(self, monkeypatch):
        """Empty SCION_BOOKS_DIR is treated as not set."""
        monkeypatch.setenv("SCION_BOOKS_DIR", "")
        dirs = books_search_dirs(None)
        # Just verify no error; actual dirs depend on repo/books presence
        assert isinstance(dirs, list)

    def test_no_duplicates(self, tmp_path, monkeypatch):
        """Same directory referenced twice doesn't appear twice."""
        shared = tmp_path / "shared"
        shared.mkdir()
        monkeypatch.setenv("SCION_BOOKS_DIR", str(shared))

        dirs = books_search_dirs(shared)
        # shared passed as both explicit and env — should appear only once
        resolved_shared = shared.resolve()
        assert dirs.count(resolved_shared) == 1


class TestFindPdfInBooks:
    """Tests for Requirements 2.2, 2.4: filename matching behavior."""

    def test_first_filename_variant_preferred(self, tmp_path):
        """When multiple filenames exist, the first in the list wins (Req 2.2)."""
        # Create both variants in the same directory
        (tmp_path / "variant_a.pdf").touch()
        (tmp_path / "variant_b.pdf").touch()

        filenames = ("variant_a.pdf", "variant_b.pdf")
        result = find_pdf_in_books(filenames, tmp_path)
        assert result is not None
        assert result.name == "variant_a.pdf"

    def test_second_variant_used_when_first_missing(self, tmp_path):
        """Falls back to second variant when first doesn't exist (Req 2.4)."""
        # Only second variant exists
        (tmp_path / "variant_b.pdf").touch()

        filenames = ("variant_a.pdf", "variant_b.pdf")
        result = find_pdf_in_books(filenames, tmp_path)
        assert result is not None
        assert result.name == "variant_b.pdf"

    def test_all_variants_tried(self, tmp_path):
        """All filename variants in the list are tried (Req 2.4)."""
        # Only the last variant exists
        (tmp_path / "third.pdf").touch()

        filenames = ("first.pdf", "second.pdf", "third.pdf")
        result = find_pdf_in_books(filenames, tmp_path)
        assert result is not None
        assert result.name == "third.pdf"

    def test_none_when_no_variant_found(self, tmp_path):
        """Returns None when no filename variant matches (Req 2.3)."""
        filenames = ("nonexistent.pdf", "also_missing.pdf")
        result = find_pdf_in_books(filenames, tmp_path)
        assert result is None

    def test_higher_precedence_dir_wins(self, tmp_path, monkeypatch):
        """File in higher-precedence dir is returned over lower-precedence (Req 2.1)."""
        high_dir = tmp_path / "high"
        high_dir.mkdir()
        low_dir = tmp_path / "low"
        low_dir.mkdir()

        # Same filename in both dirs
        (high_dir / "book.pdf").touch()
        (low_dir / "book.pdf").touch()

        monkeypatch.setenv("SCION_BOOKS_DIR", str(low_dir))

        filenames = ("book.pdf",)
        # explicit_dir (high) should win over env var (low)
        result = find_pdf_in_books(filenames, high_dir)
        assert result is not None
        assert result.parent.resolve() == high_dir.resolve()

    def test_first_filename_in_high_dir_over_any_in_low(self, tmp_path, monkeypatch):
        """First filename match in the higher dir beats any match in lower dir."""
        high_dir = tmp_path / "high"
        high_dir.mkdir()
        low_dir = tmp_path / "low"
        low_dir.mkdir()

        # high has second variant, low has first variant
        (high_dir / "variant_b.pdf").touch()
        (low_dir / "variant_a.pdf").touch()

        monkeypatch.setenv("SCION_BOOKS_DIR", str(low_dir))

        filenames = ("variant_a.pdf", "variant_b.pdf")
        # explicit high_dir searched first: it has variant_b
        # Since find_pdf searches dirs in order, then filenames in order per dir:
        # high_dir: variant_a? no. variant_b? yes. → returns high_dir/variant_b.pdf
        result = find_pdf_in_books(filenames, high_dir)
        assert result is not None
        assert result.parent.resolve() == high_dir.resolve()
        assert result.name == "variant_b.pdf"


class TestCLIPDFResolutionIntegration:
    """End-to-end tests for PDF resolution in the unified extractor CLI.

    These tests use real temp directories to verify the full flow from
    CLI → books_search_dirs → find_pdf_in_books → skip/proceed.
    """

    def _make_spec_dict(
        self, book_id: str = "test_book", filenames: list[str] | None = None
    ) -> dict:
        """Create a minimal spec dict for writing to YAML."""
        return {
            "book_id": book_id,
            "filenames": filenames or ["test.pdf"],
            "output_path": f"src/data/_extracted/{book_id}.txt",
            "pipeline_stages": ["ingest", "extract", "validate"],
            "section_anchors": [{"pattern": "Test", "pattern_type": "literal"}],
            "heading_patterns": [{"regex": "^Test$", "flags": ["MULTILINE"]}],
            "expected_fields": ["id", "name"],
        }

    @patch("unified_extractor._run_pipeline", return_value=True)
    def test_explicit_books_dir_used_for_resolution(
        self, mock_pipeline, tmp_path, monkeypatch
    ):
        """--books-dir argument is used to find PDFs."""
        import yaml

        from unified_extractor import main

        # Set up a spec directory with one spec
        specs_dir = tmp_path / "specs"
        specs_dir.mkdir()
        spec = self._make_spec_dict("mybook", ["mybook.pdf"])
        (specs_dir / "mybook.yaml").write_text(yaml.dump(spec))

        # Set up books directory with the PDF
        books_dir = tmp_path / "books"
        books_dir.mkdir()
        (books_dir / "mybook.pdf").touch()

        # Patch the specs directory
        monkeypatch.setattr("unified_extractor._SPECS_DIR", specs_dir)
        # Clear env to avoid interference
        monkeypatch.delenv("SCION_BOOKS_DIR", raising=False)

        code = main(books_dir=books_dir)
        assert code == 0
        mock_pipeline.assert_called_once()
        # Verify the PDF path passed to the pipeline is from our books_dir
        call_args = mock_pipeline.call_args[0]
        assert call_args[1] == books_dir / "mybook.pdf"

    @patch("unified_extractor._run_pipeline", return_value=True)
    def test_env_var_used_when_no_explicit_dir(
        self, mock_pipeline, tmp_path, monkeypatch
    ):
        """SCION_BOOKS_DIR env var is used when no --books-dir."""
        import yaml

        from unified_extractor import main

        specs_dir = tmp_path / "specs"
        specs_dir.mkdir()
        spec = self._make_spec_dict("envbook", ["envbook.pdf"])
        (specs_dir / "envbook.yaml").write_text(yaml.dump(spec))

        env_books = tmp_path / "env_books"
        env_books.mkdir()
        (env_books / "envbook.pdf").touch()

        monkeypatch.setattr("unified_extractor._SPECS_DIR", specs_dir)
        monkeypatch.setenv("SCION_BOOKS_DIR", str(env_books))

        code = main(books_dir=None)
        assert code == 0
        mock_pipeline.assert_called_once()
        call_args = mock_pipeline.call_args[0]
        assert call_args[1] == env_books / "envbook.pdf"

    def test_skip_message_includes_searched_dirs(self, tmp_path, monkeypatch, capsys):
        """[SKIP] message includes the directories that were searched."""
        import yaml

        from unified_extractor import main

        specs_dir = tmp_path / "specs"
        specs_dir.mkdir()
        spec = self._make_spec_dict("missing", ["missing.pdf"])
        (specs_dir / "missing.yaml").write_text(yaml.dump(spec))

        books_dir = tmp_path / "empty_books"
        books_dir.mkdir()

        monkeypatch.setattr("unified_extractor._SPECS_DIR", specs_dir)
        monkeypatch.delenv("SCION_BOOKS_DIR", raising=False)

        code = main(books_dir=books_dir)
        assert code == 0
        captured = capsys.readouterr()
        assert "[SKIP]" in captured.out
        assert "missing" in captured.out
        assert str(books_dir.resolve()) in captured.out

    @patch("unified_extractor._run_pipeline", return_value=True)
    def test_continues_after_skip(self, mock_pipeline, tmp_path, monkeypatch, capsys):
        """Processing continues after skipping a book with missing PDF (Req 2.3)."""
        import yaml

        from unified_extractor import main

        specs_dir = tmp_path / "specs"
        specs_dir.mkdir()

        # Two specs: first PDF is missing, second PDF exists
        spec_missing = self._make_spec_dict("book_missing", ["missing.pdf"])
        spec_found = self._make_spec_dict("book_found", ["found.pdf"])
        (specs_dir / "a_missing.yaml").write_text(yaml.dump(spec_missing))
        (specs_dir / "b_found.yaml").write_text(yaml.dump(spec_found))

        books_dir = tmp_path / "books"
        books_dir.mkdir()
        (books_dir / "found.pdf").touch()

        monkeypatch.setattr("unified_extractor._SPECS_DIR", specs_dir)
        monkeypatch.delenv("SCION_BOOKS_DIR", raising=False)

        code = main(books_dir=books_dir)
        assert code == 0
        # Pipeline was called for the found book
        mock_pipeline.assert_called_once()
        # Skip message was printed for missing book
        captured = capsys.readouterr()
        assert "[SKIP]" in captured.out
        assert "book_missing" in captured.out

    @patch("unified_extractor._run_pipeline", return_value=True)
    def test_first_matching_filename_variant_used(
        self, mock_pipeline, tmp_path, monkeypatch
    ):
        """First matching filename from spec's filenames list is used (Req 2.2)."""
        import yaml

        from unified_extractor import main

        specs_dir = tmp_path / "specs"
        specs_dir.mkdir()
        # Spec declares three filename variants
        spec = self._make_spec_dict(
            "multiname", ["primary.pdf", "alternate.pdf", "fallback.pdf"]
        )
        (specs_dir / "multiname.yaml").write_text(yaml.dump(spec))

        books_dir = tmp_path / "books"
        books_dir.mkdir()
        # Only second and third variants exist
        (books_dir / "alternate.pdf").touch()
        (books_dir / "fallback.pdf").touch()

        monkeypatch.setattr("unified_extractor._SPECS_DIR", specs_dir)
        monkeypatch.delenv("SCION_BOOKS_DIR", raising=False)

        code = main(books_dir=books_dir)
        assert code == 0
        mock_pipeline.assert_called_once()
        # Should use "alternate.pdf" (first existing match)
        call_args = mock_pipeline.call_args[0]
        assert call_args[1].name == "alternate.pdf"

    @patch("unified_extractor._run_pipeline", return_value=True)
    def test_all_filename_variants_supported(
        self, mock_pipeline, tmp_path, monkeypatch
    ):
        """All variants in the filenames list are checked (Req 2.4)."""
        import yaml

        from unified_extractor import main

        specs_dir = tmp_path / "specs"
        specs_dir.mkdir()
        spec = self._make_spec_dict(
            "lastonly", ["first.pdf", "second.pdf", "last_resort.pdf"]
        )
        (specs_dir / "lastonly.yaml").write_text(yaml.dump(spec))

        books_dir = tmp_path / "books"
        books_dir.mkdir()
        # Only the last variant exists
        (books_dir / "last_resort.pdf").touch()

        monkeypatch.setattr("unified_extractor._SPECS_DIR", specs_dir)
        monkeypatch.delenv("SCION_BOOKS_DIR", raising=False)

        code = main(books_dir=books_dir)
        assert code == 0
        mock_pipeline.assert_called_once()
        call_args = mock_pipeline.call_args[0]
        assert call_args[1].name == "last_resort.pdf"
