"""Unit tests for the unified_extractor CLI entry point.

Tests cover:
- CLI argument parsing (--book, --books-dir, --dry-run, --verbose)
- Spec discovery and validation error handling
- --book filtering (valid and invalid identifiers)
- Exit code semantics (0 for success, 1 for error)
- Per-book pipeline loop with PDF resolution
- Skip behavior for missing PDFs
- Post-pipeline merge and cleanup stub calls
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure src/scripts is importable
_SCRIPTS_DIR = Path(__file__).resolve().parents[2] / "src" / "scripts"
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from parser_framework.models import BookSpec
from parser_framework.spec_loader import SpecValidationError
from unified_extractor import _build_parser, main


def _make_spec(book_id: str = "test_book", book_slug: str | None = None) -> BookSpec:
    """Create a minimal BookSpec for testing."""
    return BookSpec(
        book_id=book_id,
        filenames=["test.pdf", "test_alt.pdf"],
        output_path=f"src/data/_extracted/{book_id}.txt",
        section_anchors=[],
        heading_patterns=[],
        expected_fields=[],
        pipeline_stages=["ingest", "extract", "validate"],
        book_slug=book_slug,
    )


class TestBuildParser:
    """Tests for argparse construction."""

    def test_all_flags_available(self):
        parser = _build_parser()
        args = parser.parse_args([
            "--book", "pandoras_box",
            "--books-dir", "/tmp/pdfs",
            "--dry-run",
            "--verbose",
        ])
        assert args.book == "pandoras_box"
        assert args.books_dir == Path("/tmp/pdfs")
        assert args.dry_run is True
        assert args.verbose is True

    def test_defaults(self):
        parser = _build_parser()
        args = parser.parse_args([])
        assert args.book is None
        assert args.books_dir is None
        assert args.dry_run is False
        assert args.verbose is False

    def test_book_flag_accepts_value(self):
        parser = _build_parser()
        args = parser.parse_args(["--book", "scion_hero"])
        assert args.book == "scion_hero"

    def test_books_dir_converts_to_path(self):
        parser = _build_parser()
        args = parser.parse_args(["--books-dir", "/home/user/pdfs"])
        assert isinstance(args.books_dir, Path)
        assert args.books_dir == Path("/home/user/pdfs")


class TestMainSpecDiscovery:
    """Tests for spec discovery and validation."""

    @patch("unified_extractor.load_specs")
    def test_spec_validation_error_returns_1(self, mock_load, capsys):
        """SpecValidationError during load returns exit code 1."""
        mock_load.side_effect = SpecValidationError(
            source_file=Path("bad_spec.yaml"),
            field="book_id",
            reason="required field is missing",
        )
        code = main()
        assert code == 1
        captured = capsys.readouterr()
        assert "[ERROR]" in captured.err

    @patch("unified_extractor.load_specs")
    def test_no_specs_found_returns_0(self, mock_load, capsys):
        """Empty specs directory returns exit code 0 with a warning."""
        mock_load.return_value = []
        code = main()
        assert code == 0
        captured = capsys.readouterr()
        assert "[WARN]" in captured.err


class TestMainBookFilter:
    """Tests for --book filtering."""

    @patch("unified_extractor._run_pipeline")
    @patch("unified_extractor.find_pdf_in_books")
    @patch("unified_extractor.load_specs")
    def test_valid_book_filter(self, mock_load, mock_find, mock_pipeline):
        """--book with valid ID processes only that spec."""
        specs = [_make_spec("alpha"), _make_spec("beta")]
        mock_load.return_value = specs
        mock_find.return_value = Path("/books/test.pdf")
        mock_pipeline.return_value = True

        code = main(book="alpha")
        assert code == 0
        # find_pdf_in_books should only be called once (for alpha)
        assert mock_find.call_count == 1

    @patch("unified_extractor.load_specs")
    def test_invalid_book_filter_returns_1(self, mock_load, capsys):
        """--book with non-existent ID returns exit code 1."""
        specs = [_make_spec("alpha"), _make_spec("beta")]
        mock_load.return_value = specs

        code = main(book="nonexistent")
        assert code == 1
        captured = capsys.readouterr()
        assert "[ERROR]" in captured.err
        assert "nonexistent" in captured.err


class TestMainPDFResolution:
    """Tests for PDF resolution and skip behavior."""

    @patch("unified_extractor.find_pdf_in_books")
    @patch("unified_extractor.load_specs")
    def test_missing_pdf_skips_book(self, mock_load, mock_find, capsys):
        """Missing PDF skips book with [SKIP] message, returns 0."""
        specs = [_make_spec("missing_book")]
        mock_load.return_value = specs
        mock_find.return_value = None

        code = main()
        assert code == 0
        captured = capsys.readouterr()
        assert "[SKIP]" in captured.out
        assert "missing_book" in captured.out

    @patch("unified_extractor._run_pipeline")
    @patch("unified_extractor.find_pdf_in_books")
    @patch("unified_extractor.load_specs")
    def test_found_pdf_runs_pipeline(self, mock_load, mock_find, mock_pipeline):
        """Found PDF runs pipeline for that book."""
        specs = [_make_spec("my_book")]
        mock_load.return_value = specs
        mock_find.return_value = Path("/books/test.pdf")
        mock_pipeline.return_value = True

        code = main()
        assert code == 0
        mock_pipeline.assert_called_once()
        call_args = mock_pipeline.call_args
        assert call_args[0][1] == Path("/books/test.pdf")

    @patch("unified_extractor._run_pipeline")
    @patch("unified_extractor.find_pdf_in_books")
    @patch("unified_extractor.load_specs")
    def test_multiple_books_some_missing(self, mock_load, mock_find, mock_pipeline, capsys):
        """Multiple specs where some PDFs are missing — skips missing, runs found."""
        specs = [_make_spec("book_a"), _make_spec("book_b"), _make_spec("book_c")]
        mock_load.return_value = specs
        # book_a found, book_b missing, book_c found
        mock_find.side_effect = [
            Path("/books/a.pdf"),
            None,
            Path("/books/c.pdf"),
        ]
        mock_pipeline.return_value = True

        code = main()
        assert code == 0
        assert mock_pipeline.call_count == 2
        captured = capsys.readouterr()
        assert "[SKIP]" in captured.out
        assert "book_b" in captured.out


class TestMainExitCodes:
    """Tests for exit code semantics."""

    @patch("unified_extractor._run_pipeline")
    @patch("unified_extractor.find_pdf_in_books")
    @patch("unified_extractor.load_specs")
    def test_pipeline_failure_returns_1(self, mock_load, mock_find, mock_pipeline):
        """Pipeline returning False sets exit code to 1."""
        specs = [_make_spec("bad_book")]
        mock_load.return_value = specs
        mock_find.return_value = Path("/books/test.pdf")
        mock_pipeline.return_value = False

        code = main()
        assert code == 1

    @patch("unified_extractor._run_pipeline")
    @patch("unified_extractor.find_pdf_in_books")
    @patch("unified_extractor.load_specs")
    def test_all_success_returns_0(self, mock_load, mock_find, mock_pipeline):
        """All pipelines succeeding returns exit code 0."""
        specs = [_make_spec("book_a"), _make_spec("book_b")]
        mock_load.return_value = specs
        mock_find.return_value = Path("/books/test.pdf")
        mock_pipeline.return_value = True

        code = main()
        assert code == 0

    @patch("unified_extractor._run_pipeline")
    @patch("unified_extractor.find_pdf_in_books")
    @patch("unified_extractor.load_specs")
    def test_one_failure_among_successes_returns_1(
        self, mock_load, mock_find, mock_pipeline
    ):
        """If any pipeline fails, exit code is 1 even if others succeed."""
        specs = [_make_spec("book_a"), _make_spec("book_b")]
        mock_load.return_value = specs
        mock_find.return_value = Path("/books/test.pdf")
        mock_pipeline.side_effect = [True, False]

        code = main()
        assert code == 1


class TestMainPostPipeline:
    """Tests for merge and cleanup being called."""

    @patch("unified_extractor._run_cleanup")
    @patch("unified_extractor._run_merge")
    @patch("unified_extractor._run_pipeline")
    @patch("unified_extractor.find_pdf_in_books")
    @patch("unified_extractor.load_specs")
    def test_merge_and_cleanup_called(
        self, mock_load, mock_find, mock_pipeline, mock_merge, mock_cleanup
    ):
        """After pipeline loop, merge and cleanup are called."""
        specs = [_make_spec("my_book", book_slug="my_book")]
        mock_load.return_value = specs
        mock_find.return_value = Path("/books/test.pdf")
        mock_pipeline.return_value = True

        code = main()
        assert code == 0
        mock_merge.assert_called_once_with(dry_run=False)
        mock_cleanup.assert_called_once()
        # Verify active_slugs passed to cleanup
        call_kwargs = mock_cleanup.call_args
        assert "my_book" in call_kwargs[0][0]

    @patch("unified_extractor._run_cleanup")
    @patch("unified_extractor._run_merge")
    @patch("unified_extractor._run_pipeline")
    @patch("unified_extractor.find_pdf_in_books")
    @patch("unified_extractor.load_specs")
    def test_dry_run_passed_to_merge_and_cleanup(
        self, mock_load, mock_find, mock_pipeline, mock_merge, mock_cleanup
    ):
        """--dry-run flag is passed to merge and cleanup."""
        specs = [_make_spec("my_book", book_slug="my_book")]
        mock_load.return_value = specs
        mock_find.return_value = Path("/books/test.pdf")
        mock_pipeline.return_value = True

        code = main(dry_run=True)
        assert code == 0
        mock_merge.assert_called_once_with(dry_run=True)
        mock_cleanup.assert_called_once()
        call_kwargs = mock_cleanup.call_args[1]
        assert call_kwargs["dry_run"] is True

    @patch("unified_extractor._run_pipeline")
    @patch("unified_extractor._run_cleanup")
    @patch("unified_extractor._run_merge")
    @patch("unified_extractor.find_pdf_in_books")
    @patch("unified_extractor.load_specs")
    def test_active_slugs_from_found_pdfs_only(
        self, mock_load, mock_find, mock_merge, mock_cleanup, mock_pipeline
    ):
        """Active slugs only include books whose PDFs were found."""
        specs = [
            _make_spec("found_book", book_slug="found_slug"),
            _make_spec("missing_book", book_slug="missing_slug"),
        ]
        mock_load.return_value = specs
        mock_find.side_effect = [Path("/books/found.pdf"), None]
        mock_pipeline.return_value = True

        code = main()
        assert code == 0
        # Cleanup should only have found_slug as active
        cleanup_args = mock_cleanup.call_args[0][0]
        assert "found_slug" in cleanup_args
        assert "missing_slug" not in cleanup_args

    @patch("unified_extractor._run_pipeline")
    @patch("unified_extractor._run_cleanup")
    @patch("unified_extractor._run_merge")
    @patch("unified_extractor.find_pdf_in_books")
    @patch("unified_extractor.load_specs")
    def test_slug_fallback_to_book_id(
        self, mock_load, mock_find, mock_merge, mock_cleanup, mock_pipeline
    ):
        """When book_slug is None, book_id is used as the active slug."""
        specs = [_make_spec("my_book_id", book_slug=None)]
        mock_load.return_value = specs
        mock_find.return_value = Path("/books/test.pdf")
        mock_pipeline.return_value = True

        code = main()
        assert code == 0
        cleanup_args = mock_cleanup.call_args[0][0]
        assert "my_book_id" in cleanup_args


class TestMainFlagsPassedToPipeline:
    """Tests verifying flags are passed through to pipeline stubs."""

    @patch("unified_extractor._run_pipeline")
    @patch("unified_extractor.find_pdf_in_books")
    @patch("unified_extractor.load_specs")
    def test_dry_run_passed_to_pipeline(self, mock_load, mock_find, mock_pipeline):
        """--dry-run flag is forwarded to _run_pipeline."""
        specs = [_make_spec("my_book")]
        mock_load.return_value = specs
        mock_find.return_value = Path("/books/test.pdf")
        mock_pipeline.return_value = True

        main(dry_run=True)
        call_kwargs = mock_pipeline.call_args[1]
        assert call_kwargs["dry_run"] is True

    @patch("unified_extractor._run_pipeline")
    @patch("unified_extractor.find_pdf_in_books")
    @patch("unified_extractor.load_specs")
    def test_verbose_passed_to_pipeline(self, mock_load, mock_find, mock_pipeline):
        """--verbose flag is forwarded to _run_pipeline."""
        specs = [_make_spec("my_book")]
        mock_load.return_value = specs
        mock_find.return_value = Path("/books/test.pdf")
        mock_pipeline.return_value = True

        main(verbose=True)
        call_kwargs = mock_pipeline.call_args[1]
        assert call_kwargs["verbose"] is True


import json

from unified_extractor import _run_merge, _run_cleanup


class TestRunMergeIntegration:
    """Tests for _run_merge wiring to generate_boons_catalog.py."""

    def test_run_merge_calls_generate_boons_catalog(self, tmp_path: Path):
        """_run_merge invokes generate_boons_catalog.py."""
        scripts_dir = tmp_path / "src" / "scripts"
        scripts_dir.mkdir(parents=True)
        (scripts_dir / "generate_boons_catalog.py").write_text("# stub\n", encoding="utf-8")

        with patch("unified_extractor._REPO_ROOT", tmp_path):
            with patch("unified_extractor._SCRIPTS", scripts_dir):
                with patch("subprocess.run") as mock_run:
                    _run_merge(dry_run=False)

                    mock_run.assert_called_once()
                    cmd = mock_run.call_args[0][0]
                    assert "generate_boons_catalog.py" in cmd[-1]

    def test_run_merge_dry_run_skips_subprocess(self, tmp_path: Path):
        """_run_merge does not run subprocess in dry-run mode."""
        with patch("subprocess.run") as mock_run:
            _run_merge(dry_run=True)
            mock_run.assert_not_called()


class TestRunCleanupIntegration:
    """Tests for _run_cleanup wiring to the stale cleaner."""

    def test_run_cleanup_deletes_stale_files(self, tmp_path: Path):
        """_run_cleanup deletes files not in active_slugs."""
        books_dir = tmp_path / "src" / "data" / "books"
        books_dir.mkdir(parents=True)
        stale_file = books_dir / "old_book.json"
        stale_file.write_text("{}")
        active_file = books_dir / "active_book.json"
        active_file.write_text("{}")

        with patch("unified_extractor._REPO_ROOT", tmp_path):
            _run_cleanup({"active_book"}, dry_run=False)

        assert not stale_file.exists()
        assert active_file.exists()

    def test_run_cleanup_dry_run_does_not_delete(self, tmp_path: Path):
        """_run_cleanup with dry_run=True does not delete files."""
        books_dir = tmp_path / "src" / "data" / "books"
        books_dir.mkdir(parents=True)
        stale_file = books_dir / "old_book.json"
        stale_file.write_text("{}")

        with patch("unified_extractor._REPO_ROOT", tmp_path):
            _run_cleanup(set(), dry_run=True)

        assert stale_file.exists()

    def test_run_cleanup_no_stale_files(self, tmp_path: Path):
        """_run_cleanup does nothing when all files are active."""
        books_dir = tmp_path / "src" / "data" / "books"
        books_dir.mkdir(parents=True)
        active_file = books_dir / "my_book.json"
        active_file.write_text("{}")

        with patch("unified_extractor._REPO_ROOT", tmp_path):
            _run_cleanup({"my_book"}, dry_run=False)

        assert active_file.exists()

    def test_run_cleanup_nonexistent_dir(self, tmp_path: Path):
        """_run_cleanup handles nonexistent books directory gracefully."""
        with patch("unified_extractor._REPO_ROOT", tmp_path):
            # Should not raise — books dir doesn't exist
            _run_cleanup({"some_slug"}, dry_run=False)
