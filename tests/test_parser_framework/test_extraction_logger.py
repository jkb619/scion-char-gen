"""Unit tests for extraction_logger.py — verbose logging and error reporting.

Tests cover:
- Console output formatting: [SKIP], [ERROR], [WARN], [OK] prefixes
- Verbose log file writing with correct JSON structure
- Regression detection when entries < baseline
- Edge cases: empty categories, no baseline, missing IDs formatting
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

# Ensure src/scripts is importable
_SCRIPTS_DIR = Path(__file__).resolve().parents[2] / "src" / "scripts"
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from extraction_logger import (
    BookLog,
    CategoryLogSummary,
    check_regression,
    report_error,
    report_ok,
    report_skip,
    report_warn,
    report_dependency_skip,
    write_verbose_log,
)
from extractors.base import CategoryResult, LogEntry


# ---------------------------------------------------------------------------
# Console reporting tests
# ---------------------------------------------------------------------------


class TestReportSkip:
    """Tests for [SKIP] console output."""

    def test_prints_skip_with_searched_dirs(self, capsys):
        report_skip("pandoras_box", [Path("./books"), Path("../books")])
        captured = capsys.readouterr()
        assert captured.out == "[SKIP] pandoras_box: PDF not found (searched: books, ../books)\n"

    def test_prints_skip_with_no_dirs(self, capsys):
        report_skip("test_book", None)
        captured = capsys.readouterr()
        assert "[SKIP] test_book: PDF not found (searched: (none))" in captured.out

    def test_prints_skip_with_empty_dirs(self, capsys):
        report_skip("test_book", [])
        captured = capsys.readouterr()
        assert "(searched: (none))" in captured.out


class TestReportError:
    """Tests for [ERROR] console output."""

    def test_prints_error_with_filename(self, capsys):
        report_error("scion_hero", "PDF corrupt — cannot extract text", "Scion_Hero.pdf")
        captured = capsys.readouterr()
        assert "[ERROR] scion_hero: PDF corrupt — cannot extract text (Scion_Hero.pdf)" in captured.err

    def test_prints_error_without_filename(self, capsys):
        report_error("scion_hero", "some error")
        captured = capsys.readouterr()
        assert "[ERROR] scion_hero: some error\n" == captured.err

    def test_error_goes_to_stderr(self, capsys):
        report_error("test_book", "broken")
        captured = capsys.readouterr()
        assert captured.out == ""
        assert "[ERROR]" in captured.err


class TestReportWarn:
    """Tests for [WARN] console output with regression info."""

    def test_prints_warn_with_missing_ids(self, capsys):
        report_warn("pandoras_box", "knacks", 3, ["id1", "id2", "id3"])
        captured = capsys.readouterr()
        assert captured.out == (
            "[WARN] pandoras_box/knacks: 3 entries below baseline (missing: id1, id2, id3)\n"
        )

    def test_prints_warn_with_single_id(self, capsys):
        report_warn("test_book", "boons", 1, ["missingBoon"])
        captured = capsys.readouterr()
        assert "1 entries below baseline (missing: missingBoon)" in captured.out

    def test_warn_format_matches_design(self, capsys):
        """Verify the output matches the design doc example exactly."""
        report_warn("pandoras_box", "knacks", 3, ["id1", "id2", "id3"])
        captured = capsys.readouterr()
        expected = "[WARN] pandoras_box/knacks: 3 entries below baseline (missing: id1, id2, id3)\n"
        assert captured.out == expected


class TestReportOk:
    """Tests for [OK] console output."""

    def test_prints_ok_with_category_counts(self, capsys):
        report_ok("scion_origin", {"knacks": 47, "callings": 10, "paths": 12, "pantheons": 8})
        captured = capsys.readouterr()
        # Counts are sorted alphabetically by category name
        assert "[OK] scion_origin: 4 categories extracted" in captured.out
        assert "callings: 10" in captured.out
        assert "knacks: 47" in captured.out
        assert "pantheons: 8" in captured.out
        assert "paths: 12" in captured.out

    def test_prints_ok_with_single_category(self, capsys):
        report_ok("test_book", {"boons": 25})
        captured = capsys.readouterr()
        assert "[OK] test_book: 1 categories extracted (boons: 25)" in captured.out

    def test_prints_ok_with_empty_categories(self, capsys):
        report_ok("test_book", {})
        captured = capsys.readouterr()
        assert "[OK] test_book: 0 categories extracted ()" in captured.out


class TestReportDependencySkip:
    """Tests for dependency skip messages."""

    def test_prints_skip_with_dependency_name(self, capsys):
        report_dependency_skip("pandoras_box", "pymupdf")
        captured = capsys.readouterr()
        assert "[SKIP] pandoras_box: missing dependency 'pymupdf' — skipping" in captured.out


# ---------------------------------------------------------------------------
# Regression detection tests
# ---------------------------------------------------------------------------


class TestCheckRegression:
    """Tests for regression detection logic."""

    def test_no_baseline_returns_empty(self):
        result = CategoryResult(category="knacks", entries={"a": {}, "b": {}}, entry_count=2)
        missing = check_regression("test_book", "knacks", result, None)
        assert missing == []

    def test_no_regression_returns_empty(self):
        result = CategoryResult(
            category="knacks",
            entries={"a": {}, "b": {}, "c": {}},
            entry_count=3,
        )
        baseline_ids = {"a", "b", "c"}
        missing = check_regression("test_book", "knacks", result, baseline_ids)
        assert missing == []

    def test_regression_returns_missing_ids(self, capsys):
        result = CategoryResult(
            category="knacks",
            entries={"a": {}, "c": {}},
            entry_count=2,
        )
        baseline_ids = {"a", "b", "c", "d"}
        missing = check_regression("test_book", "knacks", result, baseline_ids)
        assert missing == ["b", "d"]  # sorted

    def test_regression_emits_warn(self, capsys):
        result = CategoryResult(
            category="boons",
            entries={"x": {}},
            entry_count=1,
        )
        baseline_ids = {"x", "y", "z"}
        check_regression("my_book", "boons", result, baseline_ids)
        captured = capsys.readouterr()
        assert "[WARN] my_book/boons: 2 entries below baseline (missing: y, z)" in captured.out

    def test_new_entries_not_treated_as_regression(self):
        """New entries in current but not in baseline are not flagged."""
        result = CategoryResult(
            category="knacks",
            entries={"a": {}, "b": {}, "new_entry": {}},
            entry_count=3,
        )
        baseline_ids = {"a", "b"}
        missing = check_regression("test_book", "knacks", result, baseline_ids)
        assert missing == []


# ---------------------------------------------------------------------------
# Verbose log file writing tests
# ---------------------------------------------------------------------------


class TestWriteVerboseLog:
    """Tests for write_verbose_log file output."""

    def test_creates_log_file(self, tmp_path):
        result = CategoryResult(category="knacks", entries={"a": {}}, entry_count=1)
        path = write_verbose_log(
            "test_book",
            Path("/path/to/test.pdf"),
            {"knacks": result},
            output_dir=tmp_path,
        )
        assert path.exists()
        assert path.name == "test_book.log.json"

    def test_log_file_has_correct_structure(self, tmp_path):
        result = CategoryResult(
            category="knacks",
            entries={"entry1": {"name": "Foo"}},
            entry_count=1,
        )
        path = write_verbose_log(
            "pandoras_box",
            Path("/books/SCION_Pandoras_Box_(Revised_Download).pdf"),
            {"knacks": result},
            baselines={"knacks": 150},
            output_dir=tmp_path,
        )
        data = json.loads(path.read_text(encoding="utf-8"))

        assert data["book_id"] == "pandoras_box"
        assert "timestamp" in data
        assert data["pdf_path"] == "/books/SCION_Pandoras_Box_(Revised_Download).pdf"
        assert "categories" in data
        assert "knacks" in data["categories"]
        assert data["categories"]["knacks"]["entries_found"] == 1
        assert data["categories"]["knacks"]["entries_expected"] == 150

    def test_log_file_includes_category_log_entries(self, tmp_path):
        log_entry = LogEntry(entry_id="someName", field="mechanicalEffects", reason="not_found")
        result = CategoryResult(
            category="knacks",
            entries={"a": {}},
            entry_count=1,
            log=[log_entry],
        )
        path = write_verbose_log(
            "test_book",
            Path("/test.pdf"),
            {"knacks": result},
            output_dir=tmp_path,
        )
        data = json.loads(path.read_text(encoding="utf-8"))
        log = data["categories"]["knacks"]["log"]
        assert len(log) == 1
        assert log[0]["entry_id"] == "someName"
        assert log[0]["field"] == "mechanicalEffects"
        assert log[0]["reason"] == "not_found"

    def test_log_file_with_multiple_categories(self, tmp_path):
        knacks = CategoryResult(category="knacks", entries={"a": {}, "b": {}}, entry_count=2)
        boons = CategoryResult(category="boons", entries={"x": {}}, entry_count=1)
        path = write_verbose_log(
            "test_book",
            Path("/test.pdf"),
            {"knacks": knacks, "boons": boons},
            baselines={"knacks": 5, "boons": 3},
            output_dir=tmp_path,
        )
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data["categories"]["knacks"]["entries_found"] == 2
        assert data["categories"]["knacks"]["entries_expected"] == 5
        assert data["categories"]["boons"]["entries_found"] == 1
        assert data["categories"]["boons"]["entries_expected"] == 3

    def test_log_file_without_baselines(self, tmp_path):
        result = CategoryResult(category="knacks", entries={"a": {}}, entry_count=1)
        path = write_verbose_log(
            "test_book",
            Path("/test.pdf"),
            {"knacks": result},
            baselines=None,
            output_dir=tmp_path,
        )
        data = json.loads(path.read_text(encoding="utf-8"))
        # No entries_expected key when no baseline
        assert "entries_expected" not in data["categories"]["knacks"]

    def test_log_file_empty_log_array_when_no_issues(self, tmp_path):
        result = CategoryResult(category="knacks", entries={"a": {}}, entry_count=1, log=[])
        path = write_verbose_log(
            "test_book",
            Path("/test.pdf"),
            {"knacks": result},
            output_dir=tmp_path,
        )
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data["categories"]["knacks"]["log"] == []

    def test_log_file_timestamp_format(self, tmp_path):
        result = CategoryResult(category="knacks", entries={}, entry_count=0)
        path = write_verbose_log(
            "test_book",
            Path("/test.pdf"),
            {"knacks": result},
            output_dir=tmp_path,
        )
        data = json.loads(path.read_text(encoding="utf-8"))
        # Timestamp should be ISO format ending with Z
        ts = data["timestamp"]
        assert ts.endswith("Z")
        assert "T" in ts

    def test_log_file_ends_with_newline(self, tmp_path):
        result = CategoryResult(category="knacks", entries={}, entry_count=0)
        path = write_verbose_log(
            "test_book",
            Path("/test.pdf"),
            {"knacks": result},
            output_dir=tmp_path,
        )
        content = path.read_text(encoding="utf-8")
        assert content.endswith("\n")

    def test_creates_output_directory_if_missing(self, tmp_path):
        out_dir = tmp_path / "deep" / "nested" / "dir"
        result = CategoryResult(category="knacks", entries={}, entry_count=0)
        path = write_verbose_log(
            "test_book",
            Path("/test.pdf"),
            {"knacks": result},
            output_dir=out_dir,
        )
        assert path.exists()

    def test_returns_correct_path(self, tmp_path):
        result = CategoryResult(category="knacks", entries={}, entry_count=0)
        path = write_verbose_log(
            "my_book",
            Path("/test.pdf"),
            {"knacks": result},
            output_dir=tmp_path,
        )
        assert path == tmp_path / "my_book.log.json"
