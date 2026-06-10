"""Unit tests for _run_pipeline — the per-book extraction pipeline.

Tests cover:
- Successful ingestion + extraction + output writing (pypdf mode)
- Corrupt/unreadable PDF handling (returns False, prints [ERROR])
- Missing PyMuPDF dependency handling (returns True, prints [WARN])
- Missing category in text produces empty result without exception
- Category dispatcher integration with EXTRACTOR_REGISTRY
- Output JSON written with _meta block
- Dry-run mode passes through to output writer
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure src/scripts is importable
_SCRIPTS_DIR = Path(__file__).resolve().parents[2] / "src" / "scripts"
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from parser_framework.models import BookSpec, CategoryConfig, SectionAnchor, HeadingPattern
from unified_extractor import _run_pipeline, _ingest_text, _category_config_to_dict


def _make_spec(
    book_id: str = "test_book",
    extraction_mode: str = "pypdf",
    categories: dict | None = None,
    book_slug: str | None = None,
    book_title: str | None = None,
) -> BookSpec:
    """Create a BookSpec for pipeline testing."""
    return BookSpec(
        book_id=book_id,
        filenames=["test.pdf"],
        output_path=f"src/data/_extracted/{book_id}.txt",
        section_anchors=[],
        heading_patterns=[],
        expected_fields=[],
        pipeline_stages=["ingest", "extract", "validate"],
        extraction_mode=extraction_mode,
        categories=categories,
        book_slug=book_slug,
        book_title=book_title,
    )


class TestCorruptPDF:
    """Tests for corrupt/unreadable PDF handling (Req 9.1)."""

    @patch("unified_extractor._ingest_text")
    def test_corrupt_pdf_returns_false(self, mock_ingest):
        """Corrupt PDF sets had_error (exit code 1)."""
        mock_ingest.side_effect = Exception("Cannot decrypt PDF")
        spec = _make_spec()
        pdf_path = Path("/fake/test.pdf")

        result = _run_pipeline(spec, pdf_path, dry_run=False, verbose=False)

        assert result is False

    @patch("unified_extractor._ingest_text")
    def test_corrupt_pdf_prints_error(self, mock_ingest, capsys):
        """Corrupt PDF prints [ERROR] with filename."""
        mock_ingest.side_effect = Exception("Cannot decrypt PDF")
        spec = _make_spec(book_id="my_book")
        pdf_path = Path("/fake/my_file.pdf")

        _run_pipeline(spec, pdf_path, dry_run=False, verbose=False)

        captured = capsys.readouterr()
        assert "[ERROR]" in captured.err
        assert "my_book" in captured.err
        assert "my_file.pdf" in captured.err

    @patch("unified_extractor._ingest_text")
    def test_ingest_returns_none(self, mock_ingest, capsys):
        """If _ingest_text returns None, treat as corrupt."""
        mock_ingest.return_value = None
        spec = _make_spec(book_id="bad_book")
        pdf_path = Path("/fake/bad.pdf")

        result = _run_pipeline(spec, pdf_path, dry_run=False, verbose=False)

        assert result is False
        captured = capsys.readouterr()
        assert "[ERROR]" in captured.err


class TestMissingPyMuPDF:
    """Tests for missing PyMuPDF dependency handling (Req 9.5)."""

    @patch("unified_extractor._ingest_text")
    def test_missing_pymupdf_returns_true(self, mock_ingest):
        """Missing PyMuPDF does NOT set exit code 1 — it's a skip."""
        mock_ingest.side_effect = ImportError("No module named 'fitz'")
        spec = _make_spec(extraction_mode="pymupdf")
        pdf_path = Path("/fake/test.pdf")

        result = _run_pipeline(spec, pdf_path, dry_run=False, verbose=False)

        assert result is True

    @patch("unified_extractor._ingest_text")
    def test_missing_pymupdf_prints_warning(self, mock_ingest, capsys):
        """Missing PyMuPDF prints [SKIP] with book_id and dependency name."""
        mock_ingest.side_effect = ImportError("No module named 'fitz'")
        spec = _make_spec(book_id="pymupdf_book", extraction_mode="pymupdf")
        pdf_path = Path("/fake/test.pdf")

        _run_pipeline(spec, pdf_path, dry_run=False, verbose=False)

        captured = capsys.readouterr()
        assert "[SKIP]" in captured.out
        assert "pymupdf_book" in captured.out
        assert "pymupdf" in captured.out


class TestMissingCategory:
    """Tests for missing category graceful handling (Req 7.3)."""

    @patch("unified_extractor._ingest_text")
    def test_empty_categories_succeeds(self, mock_ingest):
        """Spec with no categories still returns True."""
        mock_ingest.return_value = "Some text content"
        spec = _make_spec(categories={})
        pdf_path = Path("/fake/test.pdf")

        result = _run_pipeline(spec, pdf_path, dry_run=False, verbose=False)

        assert result is True

    @patch("unified_extractor._ingest_text")
    def test_no_categories_attribute_succeeds(self, mock_ingest):
        """Spec with categories=None still returns True."""
        mock_ingest.return_value = "Some text content"
        spec = _make_spec(categories=None)
        pdf_path = Path("/fake/test.pdf")

        result = _run_pipeline(spec, pdf_path, dry_run=False, verbose=False)

        assert result is True

    @patch("unified_extractor._ingest_text")
    def test_unregistered_category_skipped(self, mock_ingest):
        """Category not in EXTRACTOR_REGISTRY is silently skipped."""
        mock_ingest.return_value = "Some text content"
        # Use a category name that doesn't exist in the registry
        cat_config = CategoryConfig(output_path="src/data/fake.json")
        spec = _make_spec(categories={"nonexistent_category": cat_config})
        pdf_path = Path("/fake/test.pdf")

        result = _run_pipeline(spec, pdf_path, dry_run=False, verbose=False)

        assert result is True

    @patch("unified_extractor._ingest_text")
    @patch("extractors.EXTRACTOR_REGISTRY", {"knacks": MagicMock})
    def test_extractor_returns_empty_result(self, mock_ingest):
        """When extractor finds no matching content, returns empty result — no error."""
        from extractors.base import CategoryResult

        mock_ingest.return_value = "No knack sections here"

        # Create a mock extractor that returns an empty result
        mock_extractor_instance = MagicMock()
        mock_extractor_instance.extract.return_value = CategoryResult(
            category="knacks", entries={}, entry_count=0, log=[]
        )
        mock_extractor_cls = MagicMock(return_value=mock_extractor_instance)

        cat_config = CategoryConfig(
            output_path="src/data/knacks_test.json",
            section_anchors=[SectionAnchor(pattern="Knack Section")],
        )
        spec = _make_spec(categories={"knacks": cat_config})
        pdf_path = Path("/fake/test.pdf")

        with patch("extractors.EXTRACTOR_REGISTRY", {"knacks": mock_extractor_cls}):
            result = _run_pipeline(spec, pdf_path, dry_run=False, verbose=False)

        assert result is True


class TestSuccessfulPipeline:
    """Tests for the successful extraction + output writing flow."""

    @patch("unified_extractor.write_output")
    @patch("unified_extractor._ingest_text")
    def test_output_written_with_meta_block(self, mock_ingest, mock_write_output, tmp_path):
        """Extracted entries are written with _meta block containing sourcePdf and slug."""
        from extractors.base import CategoryResult

        mock_ingest.return_value = "Some text content with knacks"

        mock_extractor_instance = MagicMock()
        mock_extractor_instance.extract.return_value = CategoryResult(
            category="knacks",
            entries={"entry_1": {"id": "entry_1", "name": "Test Entry"}},
            entry_count=1,
            log=[],
        )
        mock_extractor_cls = MagicMock(return_value=mock_extractor_instance)

        cat_config = CategoryConfig(
            output_path="src/data/knacks_test.json",
        )
        spec = _make_spec(
            book_id="test_book",
            book_slug="test_slug",
            book_title="Test Book Title",
            categories={"knacks": cat_config},
        )
        pdf_path = Path("/fake/source.pdf")

        with patch("extractors.EXTRACTOR_REGISTRY", {"knacks": mock_extractor_cls}):
            result = _run_pipeline(spec, pdf_path, dry_run=False, verbose=False)

        assert result is True
        # Check that write_output was called
        assert mock_write_output.called
        call_args = mock_write_output.call_args
        output_data = call_args[0][0]
        # Verify _meta block
        assert "_meta" in output_data
        assert output_data["_meta"]["sourcePdf"] == "source.pdf"
        assert output_data["_meta"]["slug"] == "test_slug"
        assert output_data["_meta"]["book_title"] == "Test Book Title"
        # Verify entries are present
        assert "entry_1" in output_data

    @patch("unified_extractor.write_output")
    @patch("unified_extractor._ingest_text")
    def test_dry_run_passed_to_write_output(self, mock_ingest, mock_write_output):
        """dry_run flag is forwarded to write_output."""
        from extractors.base import CategoryResult

        mock_ingest.return_value = "Some text"
        mock_extractor_instance = MagicMock()
        mock_extractor_instance.extract.return_value = CategoryResult(
            category="knacks", entries={"e1": {}}, entry_count=1, log=[]
        )
        mock_extractor_cls = MagicMock(return_value=mock_extractor_instance)

        cat_config = CategoryConfig(output_path="src/data/knacks_test.json")
        spec = _make_spec(categories={"knacks": cat_config})
        pdf_path = Path("/fake/test.pdf")

        with patch("extractors.EXTRACTOR_REGISTRY", {"knacks": mock_extractor_cls}):
            _run_pipeline(spec, pdf_path, dry_run=True, verbose=False)

        # Verify dry_run=True was passed
        call_kwargs = mock_write_output.call_args[1] if mock_write_output.call_args[1] else {}
        call_args = mock_write_output.call_args[0]
        # write_output(entries, output_path, dry_run=...)
        assert mock_write_output.call_args == mock_write_output.call_args
        # Check that dry_run was passed (positional or keyword)
        if len(call_args) >= 3:
            assert call_args[2] is True
        else:
            assert call_kwargs.get("dry_run") is True

    @patch("unified_extractor.write_output")
    @patch("unified_extractor._ingest_text")
    def test_slug_template_in_output_path(self, mock_ingest, mock_write_output):
        """Output path with {slug} template is resolved correctly."""
        from extractors.base import CategoryResult

        mock_ingest.return_value = "Some text"
        mock_extractor_instance = MagicMock()
        mock_extractor_instance.extract.return_value = CategoryResult(
            category="book_slices", entries={"e1": {}}, entry_count=1, log=[]
        )
        mock_extractor_cls = MagicMock(return_value=mock_extractor_instance)

        cat_config = CategoryConfig(output_path="src/data/books/{slug}.json")
        spec = _make_spec(book_slug="my_custom_slug", categories={"book_slices": cat_config})
        pdf_path = Path("/fake/test.pdf")

        with patch("extractors.EXTRACTOR_REGISTRY", {"book_slices": mock_extractor_cls}):
            _run_pipeline(spec, pdf_path, dry_run=False, verbose=False)

        # Output path should have {slug} replaced
        call_args = mock_write_output.call_args[0]
        output_path = call_args[1]
        assert "my_custom_slug" in str(output_path)
        assert "{slug}" not in str(output_path)

    @patch("unified_extractor._ingest_text")
    def test_ok_message_printed_on_success(self, mock_ingest, capsys):
        """[OK] summary message printed after successful extraction."""
        from extractors.base import CategoryResult

        mock_ingest.return_value = "Some text"
        mock_extractor_instance = MagicMock()
        mock_extractor_instance.extract.return_value = CategoryResult(
            category="knacks", entries={"e1": {}}, entry_count=1, log=[]
        )
        mock_extractor_cls = MagicMock(return_value=mock_extractor_instance)

        cat_config = CategoryConfig(output_path="src/data/knacks_test.json")
        spec = _make_spec(book_id="good_book", categories={"knacks": cat_config})
        pdf_path = Path("/fake/test.pdf")

        with patch("extractors.EXTRACTOR_REGISTRY", {"knacks": mock_extractor_cls}):
            with patch("unified_extractor.write_output"):
                result = _run_pipeline(spec, pdf_path, dry_run=False, verbose=False)

        assert result is True
        captured = capsys.readouterr()
        assert "[OK]" in captured.out
        assert "good_book" in captured.out


class TestCategoryConfigToDict:
    """Tests for _category_config_to_dict helper."""

    def test_converts_dataclass_to_dict(self):
        """CategoryConfig dataclass is converted to a plain dict."""
        config = CategoryConfig(
            output_path="src/data/test.json",
            expected_fields=["id", "name"],
        )
        result = _category_config_to_dict(config)
        assert isinstance(result, dict)
        assert result["output_path"] == "src/data/test.json"
        assert result["expected_fields"] == ["id", "name"]

    def test_passes_dict_through(self):
        """A plain dict passes through unchanged."""
        config = {"output_path": "src/data/test.json", "foo": "bar"}
        result = _category_config_to_dict(config)
        assert result == config

    def test_handles_none(self):
        """None config returns empty dict."""
        result = _category_config_to_dict(None)
        assert result == {}
