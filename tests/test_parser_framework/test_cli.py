"""Unit tests for the CLI orchestrator (src/scripts/parse.py).

Tests cover:
- Subcommand routing and argument parsing
- --book filtering (valid and invalid identifiers)
- Exit code semantics (0 for ok/warning, 1 for error/no specs)
- Pipeline halt-on-error per book in `run` subcommand
- --dry-run flag (no files written)
- --verbose flag (log file written)
- Continuation of processing after per-book errors
- Summary line format
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure src/scripts is importable
_SCRIPTS_DIR = Path(__file__).resolve().parents[2] / "src" / "scripts"
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from parse import (
    build_parser,
    cmd_extract,
    cmd_ingest,
    cmd_run,
    cmd_validate,
    main,
    _load_and_filter_specs,
)
from parser_framework.models import (
    BookSpec,
    ExtractResult,
    IngestResult,
    LogEntry,
    ValidationReport,
)


def _make_spec(book_id: str = "test_book") -> BookSpec:
    """Create a minimal BookSpec for testing."""
    return BookSpec(
        book_id=book_id,
        filenames=["test.pdf"],
        output_path=f"src/data/_extracted/{book_id}.txt",
        section_anchors=[],
        heading_patterns=[],
        expected_fields=[],
        pipeline_stages=["ingest", "extract", "validate"],
    )


class TestBuildParser:
    """Tests for argparse construction."""

    def test_subcommands_registered(self):
        parser = build_parser()
        # Parse each subcommand to confirm they're registered
        for cmd in ["ingest", "extract", "validate", "run"]:
            args = parser.parse_args([cmd])
            assert args.command == cmd

    def test_generate_spec_subcommand(self):
        parser = build_parser()
        args = parser.parse_args(["generate-spec", "/some/script.py"])
        assert args.command == "generate-spec"
        assert args.script_path == "/some/script.py"

    def test_common_args_available_on_run(self):
        parser = build_parser()
        args = parser.parse_args([
            "run", "--book", "my_book", "--books-dir", "/tmp/books",
            "--verbose", "--dry-run", "--update-baseline"
        ])
        assert args.book == "my_book"
        assert args.books_dir == "/tmp/books"
        assert args.verbose is True
        assert args.dry_run is True
        assert args.update_baseline is True

    def test_no_subcommand_returns_1(self):
        assert main([]) == 1


class TestLoadAndFilterSpecs:
    """Tests for spec loading and --book filtering."""

    @patch("parse.load_specs")
    def test_unknown_book_id_returns_none(self, mock_load):
        """Invalid --book should return None."""
        specs = [_make_spec("alpha"), _make_spec("beta")]
        mock_load.return_value = specs

        with patch("parse._BOOK_SPECS_DIR", Path("/tmp")):
            with patch("pathlib.Path.is_dir", return_value=True):
                result = _load_and_filter_specs("unknown_id")
                assert result is None

    @patch("parse.load_specs")
    def test_valid_book_filter(self, mock_load):
        """Valid --book should return only that spec."""
        specs = [_make_spec("alpha"), _make_spec("beta")]
        mock_load.return_value = specs

        with patch("parse._BOOK_SPECS_DIR", Path("/tmp")):
            with patch("pathlib.Path.is_dir", return_value=True):
                result = _load_and_filter_specs("alpha")
                assert result is not None
                assert len(result) == 1
                assert result[0].book_id == "alpha"

    @patch("parse.load_specs")
    def test_no_filter_returns_all(self, mock_load):
        """No --book filter should return all specs."""
        specs = [_make_spec("alpha"), _make_spec("beta")]
        mock_load.return_value = specs

        with patch("parse._BOOK_SPECS_DIR", Path("/tmp")):
            with patch("pathlib.Path.is_dir", return_value=True):
                result = _load_and_filter_specs(None)
                assert result is not None
                assert len(result) == 2

    @patch("parse.load_specs")
    def test_empty_specs_returns_none(self, mock_load):
        """No specs found should return None."""
        mock_load.return_value = []

        with patch("parse._BOOK_SPECS_DIR", Path("/tmp")):
            with patch("pathlib.Path.is_dir", return_value=True):
                result = _load_and_filter_specs(None)
                assert result is None


class TestCmdIngest:
    """Tests for the ingest subcommand."""

    @patch("parse._resolve_search_dirs")
    @patch("parse._load_and_filter_specs")
    @patch("parse.ingest")
    def test_successful_ingest(self, mock_ingest, mock_filter, mock_dirs, capsys):
        spec = _make_spec("my_book")
        mock_filter.return_value = [spec]
        mock_dirs.return_value = [Path("/books")]
        mock_ingest.return_value = IngestResult(
            book_id="my_book", output_path=Path("/out.txt"), page_count=42, errors=[]
        )

        args = build_parser().parse_args(["ingest"])
        code = cmd_ingest(args)

        assert code == 0
        captured = capsys.readouterr()
        assert "my_book ingest ok 42" in captured.out

    @patch("parse._resolve_search_dirs")
    @patch("parse._load_and_filter_specs")
    @patch("parse.ingest")
    def test_ingest_with_page_errors_is_warning(self, mock_ingest, mock_filter, mock_dirs, capsys):
        spec = _make_spec("my_book")
        mock_filter.return_value = [spec]
        mock_dirs.return_value = [Path("/books")]
        mock_ingest.return_value = IngestResult(
            book_id="my_book",
            output_path=Path("/out.txt"),
            page_count=50,
            errors=["[page 3: extract error: bad page]"],
        )

        args = build_parser().parse_args(["ingest"])
        code = cmd_ingest(args)

        assert code == 0
        captured = capsys.readouterr()
        assert "my_book ingest warning 50" in captured.out

    @patch("parse._resolve_search_dirs")
    @patch("parse._load_and_filter_specs")
    @patch("parse.ingest")
    def test_ingest_file_not_found_is_error(self, mock_ingest, mock_filter, mock_dirs, capsys):
        spec = _make_spec("my_book")
        mock_filter.return_value = [spec]
        mock_dirs.return_value = [Path("/books")]
        mock_ingest.side_effect = FileNotFoundError("PDF not found")

        args = build_parser().parse_args(["ingest"])
        code = cmd_ingest(args)

        assert code == 1
        captured = capsys.readouterr()
        assert "my_book ingest error 1" in captured.out

    @patch("parse._resolve_search_dirs")
    @patch("parse._load_and_filter_specs")
    @patch("parse.ingest")
    def test_ingest_continues_on_per_book_error(self, mock_ingest, mock_filter, mock_dirs, capsys):
        """One book erroring should not stop processing of the next."""
        spec_a = _make_spec("book_a")
        spec_b = _make_spec("book_b")
        mock_filter.return_value = [spec_a, spec_b]
        mock_dirs.return_value = [Path("/books")]
        mock_ingest.side_effect = [
            FileNotFoundError("not found"),
            IngestResult(book_id="book_b", output_path=Path("/b.txt"), page_count=10, errors=[]),
        ]

        args = build_parser().parse_args(["ingest"])
        code = cmd_ingest(args)

        assert code == 1  # error from book_a
        captured = capsys.readouterr()
        assert "book_a ingest error 1" in captured.out
        assert "book_b ingest ok 10" in captured.out

    @patch("parse._load_and_filter_specs")
    def test_no_specs_returns_1(self, mock_filter):
        mock_filter.return_value = None
        args = build_parser().parse_args(["ingest"])
        code = cmd_ingest(args)
        assert code == 1


class TestCmdRun:
    """Tests for the run subcommand (full pipeline)."""

    @patch("parse._resolve_search_dirs")
    @patch("parse._load_and_filter_specs")
    @patch("parse.ingest")
    @patch("parse._run_extract_for_spec")
    @patch("parse.validate")
    def test_full_pipeline_success(
        self, mock_validate, mock_extract, mock_ingest, mock_filter, mock_dirs, capsys
    ):
        spec = _make_spec("my_book")
        mock_filter.return_value = [spec]
        mock_dirs.return_value = [Path("/books")]
        mock_ingest.return_value = IngestResult(
            book_id="my_book", output_path=Path("/out.txt"), page_count=20, errors=[]
        )
        mock_extract.return_value = ExtractResult(
            book_id="my_book", entries={"a_dot_01": {"Cost": "3"}}, log=[]
        )
        mock_validate.return_value = ValidationReport(
            book_id="my_book",
            table_name="test",
            timestamp="2025-01-01T00:00:00Z",
            total_entries=1,
            regressions={"missing_entry": 0, "new_entry": 0, "content_changed": 0},
            flagged=[],
            status="ok",
        )

        args = build_parser().parse_args(["run"])
        code = cmd_run(args)

        assert code == 0
        captured = capsys.readouterr()
        assert "my_book ingest ok 20" in captured.out
        assert "my_book extract ok 1" in captured.out
        assert "my_book validate ok 1" in captured.out

    @patch("parse._resolve_search_dirs")
    @patch("parse._load_and_filter_specs")
    @patch("parse.ingest")
    @patch("parse._run_extract_for_spec")
    def test_run_halts_on_ingest_error(
        self, mock_extract, mock_ingest, mock_filter, mock_dirs, capsys
    ):
        """If ingest fails for a book, extract and validate should not run for that book."""
        spec = _make_spec("my_book")
        mock_filter.return_value = [spec]
        mock_dirs.return_value = [Path("/books")]
        mock_ingest.side_effect = FileNotFoundError("not found")

        args = build_parser().parse_args(["run"])
        code = cmd_run(args)

        assert code == 1
        captured = capsys.readouterr()
        assert "my_book ingest error 1" in captured.out
        # Extract should not have been called
        mock_extract.assert_not_called()

    @patch("parse._resolve_search_dirs")
    @patch("parse._load_and_filter_specs")
    @patch("parse.ingest")
    @patch("parse._run_extract_for_spec")
    @patch("parse.validate")
    def test_run_continues_other_books_after_one_error(
        self, mock_validate, mock_extract, mock_ingest, mock_filter, mock_dirs, capsys
    ):
        """Processing should continue for book_b even if book_a errors at ingest."""
        spec_a = _make_spec("book_a")
        spec_b = _make_spec("book_b")
        mock_filter.return_value = [spec_a, spec_b]
        mock_dirs.return_value = [Path("/books")]

        mock_ingest.side_effect = [
            FileNotFoundError("not found"),
            IngestResult(book_id="book_b", output_path=Path("/b.txt"), page_count=5, errors=[]),
        ]
        mock_extract.return_value = ExtractResult(
            book_id="book_b", entries={"x_dot_01": {"Cost": "1"}}, log=[]
        )
        mock_validate.return_value = ValidationReport(
            book_id="book_b",
            table_name="test",
            timestamp="2025-01-01T00:00:00Z",
            total_entries=1,
            regressions={"missing_entry": 0, "new_entry": 0, "content_changed": 0},
            flagged=[],
            status="ok",
        )

        args = build_parser().parse_args(["run"])
        code = cmd_run(args)

        assert code == 1  # book_a had an error
        captured = capsys.readouterr()
        assert "book_a ingest error 1" in captured.out
        assert "book_b ingest ok 5" in captured.out
        assert "book_b extract ok 1" in captured.out
        assert "book_b validate ok 1" in captured.out

    @patch("parse._resolve_search_dirs")
    @patch("parse._load_and_filter_specs")
    def test_dry_run_prints_without_executing(self, mock_filter, mock_dirs, capsys):
        """--dry-run should print summary lines without calling pipeline stages."""
        spec = _make_spec("my_book")
        mock_filter.return_value = [spec]
        mock_dirs.return_value = [Path("/books")]

        args = build_parser().parse_args(["run", "--dry-run"])
        code = cmd_run(args)

        assert code == 0
        captured = capsys.readouterr()
        assert "my_book ingest ok 0" in captured.out
        assert "my_book extract ok 0" in captured.out
        assert "my_book validate ok 0" in captured.out


class TestCmdValidate:
    """Tests for the validate subcommand."""

    @patch("parse._resolve_search_dirs")
    @patch("parse._load_and_filter_specs")
    @patch("parse._run_extract_for_spec")
    @patch("parse.validate")
    def test_validate_ok(self, mock_validate, mock_extract, mock_filter, mock_dirs, capsys):
        spec = _make_spec("my_book")
        mock_filter.return_value = [spec]
        mock_dirs.return_value = [Path("/books")]
        mock_extract.return_value = ExtractResult(
            book_id="my_book", entries={"a_dot_01": {"Cost": "3"}}, log=[]
        )
        mock_validate.return_value = ValidationReport(
            book_id="my_book",
            table_name="test",
            timestamp="2025-01-01T00:00:00Z",
            total_entries=1,
            regressions={"missing_entry": 0, "new_entry": 0, "content_changed": 0},
            flagged=[],
            status="ok",
        )

        args = build_parser().parse_args(["validate"])
        code = cmd_validate(args)

        assert code == 0
        captured = capsys.readouterr()
        assert "my_book validate ok 1" in captured.out

    @patch("parse._resolve_search_dirs")
    @patch("parse._load_and_filter_specs")
    @patch("parse._run_extract_for_spec")
    @patch("parse.validate")
    def test_validate_error_status(self, mock_validate, mock_extract, mock_filter, mock_dirs, capsys):
        spec = _make_spec("my_book")
        mock_filter.return_value = [spec]
        mock_dirs.return_value = [Path("/books")]
        mock_extract.return_value = ExtractResult(
            book_id="my_book", entries={"a_dot_01": {"Cost": "3"}}, log=[]
        )
        mock_validate.return_value = ValidationReport(
            book_id="my_book",
            table_name="test",
            timestamp="2025-01-01T00:00:00Z",
            total_entries=1,
            regressions={"missing_entry": 2, "new_entry": 0, "content_changed": 1},
            flagged=[],
            status="error",
        )

        args = build_parser().parse_args(["validate"])
        code = cmd_validate(args)

        assert code == 1
        captured = capsys.readouterr()
        assert "my_book validate error 3" in captured.out


class TestExitCodes:
    """Tests verifying exit code semantics."""

    def test_no_command_returns_1(self):
        assert main([]) == 1

    @patch("parse._load_and_filter_specs")
    def test_invalid_book_returns_1(self, mock_filter):
        """--book with non-existent ID returns exit code 1."""
        mock_filter.return_value = None  # signals error (already printed)
        args = build_parser().parse_args(["ingest", "--book", "nonexistent"])
        code = cmd_ingest(args)
        assert code == 1


class TestVerboseLog:
    """Tests for --verbose log writing."""

    @patch("parse._resolve_search_dirs")
    @patch("parse._load_and_filter_specs")
    @patch("parse._run_extract_for_spec")
    def test_verbose_writes_log_file(
        self, mock_extract, mock_filter, mock_dirs, tmp_path, capsys
    ):
        spec = _make_spec("my_book")
        mock_filter.return_value = [spec]
        mock_dirs.return_value = [Path("/books")]

        log_entry = LogEntry(
            book_id="my_book",
            entry_id="beast_dot_01",
            field="Cost",
            reason="not_found",
            detail="Field 'Cost' not found in entry block",
        )
        mock_extract.return_value = ExtractResult(
            book_id="my_book",
            entries={"beast_dot_01": {"Cost": None}},
            log=[log_entry],
        )

        # Patch the extracted dir to use tmp_path
        with patch("parse._EXTRACTED_DIR", tmp_path):
            args = build_parser().parse_args(["extract", "--verbose"])
            code = cmd_extract(args)

        assert code == 0
        log_file = tmp_path / "my_book.log.json"
        assert log_file.exists()
        log_data = json.loads(log_file.read_text())
        assert len(log_data) == 1
        assert log_data[0]["book_id"] == "my_book"
        assert log_data[0]["reason"] == "not_found"


class TestCmdGenerateSpec:
    """Tests for the generate-spec subcommand."""

    def test_nonexistent_script_returns_1(self, capsys):
        """Non-existent script path should return exit code 1."""
        from parse import cmd_generate_spec

        args = build_parser().parse_args(["generate-spec", "/nonexistent/script.py"])
        code = cmd_generate_spec(args)

        assert code == 1
        captured = capsys.readouterr()
        assert "script not found" in captured.err

    def test_script_without_find_import_returns_1(self, tmp_path, capsys):
        """Script without 'from scion_books_dir import find_*' should fail."""
        from parse import cmd_generate_spec

        script = tmp_path / "bad_script.py"
        script.write_text("DEFAULT_OUT = 'something'\n", encoding="utf-8")

        args = build_parser().parse_args(["generate-spec", str(script)])
        code = cmd_generate_spec(args)

        assert code == 1
        captured = capsys.readouterr()
        assert "could not locate" in captured.err
        assert "find_*" in captured.err

    def test_script_without_default_out_returns_1(self, tmp_path, capsys):
        """Script without DEFAULT_OUT should fail."""
        from parse import cmd_generate_spec

        script = tmp_path / "no_out_script.py"
        script.write_text(
            "from scion_books_dir import find_pandoras_box_revised_pdf\n",
            encoding="utf-8",
        )

        args = build_parser().parse_args(["generate-spec", str(script)])
        code = cmd_generate_spec(args)

        assert code == 1
        captured = capsys.readouterr()
        assert "DEFAULT_OUT" in captured.err

    def test_generates_skeleton_from_pandoras_box_script(self, tmp_path, capsys):
        """Should generate a valid skeleton YAML from the pandoras box ingest script."""
        import yaml
        from parse import cmd_generate_spec

        # Use the actual ingest script
        script_path = _SCRIPTS_DIR / "ingest_pandoras_box_pdf.py"
        if not script_path.exists():
            pytest.skip("ingest_pandoras_box_pdf.py not found")

        # Patch _BOOK_SPECS_DIR to use tmp_path
        with patch("parse._BOOK_SPECS_DIR", tmp_path):
            args = build_parser().parse_args(["generate-spec", str(script_path)])
            code = cmd_generate_spec(args)

        assert code == 0
        captured = capsys.readouterr()
        assert "Generated skeleton Book Spec" in captured.out

        # Verify generated file exists
        spec_file = tmp_path / "pandoras_box.yaml"
        assert spec_file.exists()

        # Verify YAML is parseable and has expected content
        content = yaml.safe_load(spec_file.read_text(encoding="utf-8"))
        assert content["book_id"] == "pandoras_box"
        assert "SCION_Pandoras_Box_(Revised_Download).pdf" in content["filenames"]
        assert content["output_path"] == "src/data/_extracted/pandoras_box.txt"
        assert content["pipeline_stages"] == ["ingest", "extract", "validate"]
        assert content["section_anchors"] is not None
        assert content["heading_patterns"] is not None
        assert content["expected_fields"] is not None

    def test_generates_skeleton_from_mysteries_script(self, tmp_path, capsys):
        """Should generate a valid skeleton YAML from the mysteries ingest script."""
        import yaml
        from parse import cmd_generate_spec

        script_path = _SCRIPTS_DIR / "ingest_mysteries_of_the_world_pdf.py"
        if not script_path.exists():
            pytest.skip("ingest_mysteries_of_the_world_pdf.py not found")

        with patch("parse._BOOK_SPECS_DIR", tmp_path):
            args = build_parser().parse_args(["generate-spec", str(script_path)])
            code = cmd_generate_spec(args)

        assert code == 0

        spec_file = tmp_path / "mysteries_of_the_world.yaml"
        assert spec_file.exists()

        content = yaml.safe_load(spec_file.read_text(encoding="utf-8"))
        assert content["book_id"] == "mysteries_of_the_world"
        assert "Mysteries_of_the_World_-_Scion_Companion_(Final_Download).pdf" in content["filenames"]

    def test_yaml_uses_2_space_indentation(self, tmp_path, capsys):
        """Generated YAML should use 2-space indentation."""
        from parse import cmd_generate_spec

        script_path = _SCRIPTS_DIR / "ingest_pandoras_box_pdf.py"
        if not script_path.exists():
            pytest.skip("ingest_pandoras_box_pdf.py not found")

        with patch("parse._BOOK_SPECS_DIR", tmp_path):
            args = build_parser().parse_args(["generate-spec", str(script_path)])
            cmd_generate_spec(args)

        spec_file = tmp_path / "pandoras_box.yaml"
        text = spec_file.read_text(encoding="utf-8")

        # Check that indented lines use exactly 2-space indent (not 4)
        for line in text.split("\n"):
            if line.startswith(" "):
                stripped = line.lstrip(" ")
                indent = len(line) - len(stripped)
                assert indent % 2 == 0, f"Non-2-space indent found: {line!r}"
                assert indent <= 6, f"Unexpected deep indent: {line!r}"

    def test_yaml_field_order(self, tmp_path, capsys):
        """Generated YAML should have fixed field order."""
        from parse import cmd_generate_spec

        script_path = _SCRIPTS_DIR / "ingest_pandoras_box_pdf.py"
        if not script_path.exists():
            pytest.skip("ingest_pandoras_box_pdf.py not found")

        with patch("parse._BOOK_SPECS_DIR", tmp_path):
            args = build_parser().parse_args(["generate-spec", str(script_path)])
            cmd_generate_spec(args)

        spec_file = tmp_path / "pandoras_box.yaml"
        text = spec_file.read_text(encoding="utf-8")

        # Find top-level keys in order
        import re
        top_keys = re.findall(r"^(\w+):", text, re.MULTILINE)
        expected_order = [
            "book_id", "filenames", "output_path", "section_anchors",
            "heading_patterns", "expected_fields", "pipeline_stages"
        ]
        assert top_keys == expected_order

    def test_unknown_finder_returns_1(self, tmp_path, capsys):
        """Unknown finder function should fail gracefully."""
        from parse import cmd_generate_spec

        script = tmp_path / "unknown_finder.py"
        script.write_text(
            'from scion_books_dir import find_unknown_book_pdf\n'
            'DEFAULT_OUT = "src/data/_extracted/unknown.txt"\n',
            encoding="utf-8",
        )

        with patch("parse._BOOK_SPECS_DIR", tmp_path):
            args = build_parser().parse_args(["generate-spec", str(script)])
            code = cmd_generate_spec(args)

        assert code == 1
        captured = capsys.readouterr()
        assert "could not resolve filenames constant" in captured.err


class TestSummaryLineFormat:
    """Verify summary lines follow the format: <book_id> <stage> <status> <count>"""

    @patch("parse._resolve_search_dirs")
    @patch("parse._load_and_filter_specs")
    @patch("parse.ingest")
    def test_summary_line_format(self, mock_ingest, mock_filter, mock_dirs, capsys):
        spec = _make_spec("pandoras_box")
        mock_filter.return_value = [spec]
        mock_dirs.return_value = [Path("/books")]
        mock_ingest.return_value = IngestResult(
            book_id="pandoras_box", output_path=Path("/out.txt"), page_count=156, errors=[]
        )

        args = build_parser().parse_args(["ingest"])
        cmd_ingest(args)

        captured = capsys.readouterr()
        line = captured.out.strip()
        parts = line.split()
        assert len(parts) == 4
        assert parts[0] == "pandoras_box"
        assert parts[1] == "ingest"
        assert parts[2] == "ok"
        assert parts[3] == "156"
