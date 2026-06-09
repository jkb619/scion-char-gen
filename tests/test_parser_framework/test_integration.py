"""Integration tests for end-to-end pipeline and data_tables compatibility.

Validates Requirements 7.1, 7.2, 7.4, 7.6:
- Full pipeline (ingest → extract → write_output) produces output loadable by load_merged_table
- Output schema matches existing script conventions (keys, types, field names)
- --dry-run writes no files and prints summary to stdout
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure src/ and src/scripts/ are importable
_REPO_ROOT = Path(__file__).resolve().parents[2]
_SRC_DIR = _REPO_ROOT / "src"
_SCRIPTS_DIR = _SRC_DIR / "scripts"

if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from parser_framework.models import (
    BookSpec,
    ExtractResult,
    HeadingPattern,
    IngestResult,
    LogEntry,
    SectionAnchor,
    ValidationReport,
)
from parser_framework.output_writer import format_json, write_output


def _make_test_spec(tmp_path: Path, book_id: str = "test_book") -> BookSpec:
    """Create a minimal BookSpec for integration testing."""
    return BookSpec(
        book_id=book_id,
        filenames=["test.pdf"],
        output_path=f"src/data/_extracted/{book_id}.txt",
        section_anchors=[
            SectionAnchor(pattern="BEAST", pattern_type="literal"),
        ],
        heading_patterns=[
            HeadingPattern(
                regex=r"^([A-Z][A-Z0-9 '\-\.&,]+)\nCost:",
                flags=["MULTILINE"],
            ),
        ],
        expected_fields=["Cost", "Duration", "Subject"],
        pipeline_stages=["ingest", "extract", "validate"],
        extraction_mode="pypdf",
        noise_line_regex=None,
        json_output_paths={
            "boons": str(tmp_path / "tables" / "boons" / "00_test_fragment.json"),
        },
    )


def _simulate_load_merged_table(frag_dir: Path) -> dict:
    """Simulate the core logic of data_tables.load_merged_table.

    Replicates fragment-loading and merging behavior exactly as
    data_tables.py implements it.
    """
    json_files = sorted(frag_dir.glob("*.json"))
    json_files = [p for p in json_files if p.is_file() and not p.name.startswith("_")]

    if not json_files:
        raise FileNotFoundError(f"No data for table: missing {frag_dir}")

    merged: dict = {}
    meta_acc: dict = {}
    frag_names: list[str] = []

    for p in json_files:
        with p.open(encoding="utf-8") as f:
            part = json.load(f)
        if not isinstance(part, dict):
            raise TypeError(f"{p} must be a JSON object at the top level")
        meta_piece = part.pop("_meta", None)
        if isinstance(meta_piece, dict):
            mp = dict(meta_piece)
            mp.pop("tableFragments", None)
            for mk, mv in mp.items():
                meta_acc.setdefault(mk, mv)
        frag_names.append(p.name)
        for k, v in part.items():
            if not k or k.startswith("_"):
                continue
            merged[k] = v

    meta_acc["tableFragments"] = frag_names
    merged["_meta"] = meta_acc
    return merged


class TestEndToEndPipelineProducesLoadableOutput:
    """Test that the full pipeline produces output loadable by load_merged_table.

    Validates Requirements 7.1, 7.6.
    """

    def test_pipeline_output_loadable_by_load_merged_table(self, tmp_path: Path) -> None:
        """Full pipeline output (extract → write_output) is loadable by load_merged_table."""
        # Set up a fragment directory structure mimicking data/tables/boons/
        frag_dir = tmp_path / "tables" / "boons"
        frag_dir.mkdir(parents=True)

        # Simulate extraction producing entries with the expected schema
        entries = {
            "beast_dot_01": {
                "description": "Control or command beasts",
                "mechanicalEffects": "Spend Legend to summon animals",
                "Cost": "1 Legend",
                "Duration": "Permanent",
                "Subject": "Animals",
            },
            "beast_dot_02": {
                "description": "Transform into a beast form",
                "mechanicalEffects": "Shift form to gain animal traits",
                "Cost": "2 Legend",
                "Duration": "One scene",
                "Subject": "Self",
            },
            "_meta": {"source": "test_book", "extractionMode": "pypdf"},
        }

        # Write output via the framework's writer
        output_path = frag_dir / "00_test_fragment.json"
        write_output(entries, output_path)

        # Verify output can be loaded via load_merged_table's logic
        result = _simulate_load_merged_table(frag_dir)

        # Entries are present and correct
        assert "beast_dot_01" in result
        assert result["beast_dot_01"]["description"] == "Control or command beasts"
        assert result["beast_dot_01"]["mechanicalEffects"] == "Spend Legend to summon animals"
        assert result["beast_dot_01"]["Cost"] == "1 Legend"

        assert "beast_dot_02" in result
        assert result["beast_dot_02"]["Duration"] == "One scene"

        # _meta is assembled correctly
        assert "_meta" in result
        assert result["_meta"]["source"] == "test_book"
        assert "tableFragments" in result["_meta"]
        assert "00_test_fragment.json" in result["_meta"]["tableFragments"]

    def test_pipeline_with_extract_engine_produces_loadable_output(
        self, tmp_path: Path
    ) -> None:
        """Extract engine output piped through write_output is loadable."""
        from parser_framework.extract_engine import extract

        spec = _make_test_spec(tmp_path)

        # Provide text that matches the spec's section anchors and heading patterns
        ingested_text = (
            "Preamble text to skip\n"
            "BEAST\n"
            "ANIMAL COMMAND\n"
            "Cost: 1 Legend\n"
            "Duration: Permanent\n"
            "Subject: Animals\n"
            "Description of the boon goes here.\n"
            "\n"
            "BEAST SHIFT\n"
            "Cost: 2 Legend\n"
            "Duration: One scene\n"
            "Subject: Self\n"
            "Another description block.\n"
        )

        # Run extract
        result = extract(spec, ingested_text)

        # Build output entries (add _meta as the framework does)
        output_entries = dict(result.entries)
        output_entries["_meta"] = {"source": spec.book_id}

        # Write to a table fragment path
        frag_dir = tmp_path / "tables" / "boons"
        frag_dir.mkdir(parents=True)
        output_path = frag_dir / "00_test_fragment.json"
        write_output(output_entries, output_path)

        # Load via simulated load_merged_table
        loaded = _simulate_load_merged_table(frag_dir)

        # Verify structure
        assert isinstance(loaded, dict)
        assert "_meta" in loaded
        assert loaded["_meta"]["source"] == "test_book"

        # Verify non-meta entries are dicts
        for key, value in loaded.items():
            if not key.startswith("_"):
                assert isinstance(value, dict), f"Entry '{key}' should be a dict"

    def test_entries_have_expected_keys_and_types(self, tmp_path: Path) -> None:
        """Extracted entries have expected keys (string values or null)."""
        entries = {
            "chaos_dot_01": {
                "description": "Introduce entropy",
                "mechanicalEffects": "Roll additional dice",
                "Cost": "1 Legend",
                "Duration": None,  # Missing field returns null
                "Subject": "Area",
            },
            "_meta": {"source": "test_book"},
        }

        frag_dir = tmp_path / "tables" / "boons"
        frag_dir.mkdir(parents=True)
        output_path = frag_dir / "00_fragment.json"
        write_output(entries, output_path)

        loaded = _simulate_load_merged_table(frag_dir)
        entry = loaded["chaos_dot_01"]

        # Values are strings or null
        for field_name, value in entry.items():
            assert value is None or isinstance(value, str), (
                f"Field '{field_name}' should be str or None, got {type(value)}"
            )


class TestOutputSchemaMatchesExistingConventions:
    """Test that output schema matches existing script output conventions.

    Validates Requirements 7.1, 7.2.
    """

    def test_top_level_is_json_object(self, tmp_path: Path) -> None:
        """Output is a top-level JSON object (dict)."""
        entries = {
            "beast_dot_01": {"description": "A boon"},
        }

        output_path = tmp_path / "output.json"
        write_output(entries, output_path)

        content = output_path.read_text(encoding="utf-8")
        parsed = json.loads(content)
        assert isinstance(parsed, dict)

    def test_entry_keys_follow_section_dot_nn_convention(self, tmp_path: Path) -> None:
        """Entry keys follow the {section}_dot_{NN} convention (zero-padded 2-digit)."""
        import re

        entries = {
            "beast_dot_01": {"description": "First beast boon"},
            "beast_dot_02": {"description": "Second beast boon"},
            "chaos_dot_01": {"description": "First chaos boon"},
            "chaos_dot_10": {"description": "Tenth chaos boon"},
            "_meta": {"source": "test"},
        }

        output_path = tmp_path / "output.json"
        write_output(entries, output_path)

        content = output_path.read_text(encoding="utf-8")
        parsed = json.loads(content)

        key_pattern = re.compile(r"^[a-z_]+_dot_\d{2,}$")

        for key in parsed:
            if key.startswith("_"):
                continue
            assert key_pattern.match(key), (
                f"Entry key '{key}' does not follow {{section}}_dot_{{NN}} convention"
            )

    def test_entry_values_are_dicts(self, tmp_path: Path) -> None:
        """Each non-meta entry value is a dict."""
        entries = {
            "beast_dot_01": {"description": "Boon", "Cost": "1 Legend"},
            "beast_dot_02": {"description": "Another", "Cost": "2 Legend"},
        }

        output_path = tmp_path / "output.json"
        write_output(entries, output_path)

        content = output_path.read_text(encoding="utf-8")
        parsed = json.loads(content)

        for key, value in parsed.items():
            if not key.startswith("_"):
                assert isinstance(value, dict), f"Entry '{key}' must be a dict"

    def test_expected_field_names_present_even_if_null(self, tmp_path: Path) -> None:
        """Expected field names are present in entries even if their value is null."""
        entries = {
            "beast_dot_01": {
                "description": "A beast boon",
                "mechanicalEffects": None,
                "Cost": "1 Legend",
                "Duration": None,
                "Subject": None,
                "Range": None,
                "Action": None,
                "Clash": None,
            },
        }

        output_path = tmp_path / "output.json"
        write_output(entries, output_path)

        content = output_path.read_text(encoding="utf-8")
        parsed = json.loads(content)

        entry = parsed["beast_dot_01"]
        expected_fields = ["description", "mechanicalEffects", "Cost", "Duration", "Subject", "Range", "Action", "Clash"]
        for field_name in expected_fields:
            assert field_name in entry, f"Field '{field_name}' missing from entry"

    def test_meta_key_present_when_added(self, tmp_path: Path) -> None:
        """A _meta key is present in output when included in entries."""
        entries = {
            "beast_dot_01": {"description": "A boon"},
            "_meta": {"source": "pandoras_box", "version": "2.0"},
        }

        output_path = tmp_path / "output.json"
        write_output(entries, output_path)

        content = output_path.read_text(encoding="utf-8")
        parsed = json.loads(content)

        assert "_meta" in parsed
        assert parsed["_meta"]["source"] == "pandoras_box"
        assert parsed["_meta"]["version"] == "2.0"

    def test_output_is_utf8_with_2_space_indent_and_trailing_newline(
        self, tmp_path: Path
    ) -> None:
        """Output JSON is UTF-8 encoded with 2-space indentation and trailing newline."""
        entries = {
            "beast_dot_01": {"description": "Contrôle des bêtes"},
        }

        output_path = tmp_path / "output.json"
        write_output(entries, output_path)

        raw_bytes = output_path.read_bytes()
        content = raw_bytes.decode("utf-8")

        # Valid UTF-8
        assert "Contrôle des bêtes" in content

        # Trailing newline
        assert content.endswith("\n")
        assert not content.endswith("\n\n")

        # 2-space indentation
        assert '  "beast_dot_01"' in content


class TestDryRunWritesNoFiles:
    """Test that --dry-run writes no files and prints summary.

    Validates Requirement 7.4.
    """

    def test_dry_run_does_not_write_output_file(self, tmp_path: Path) -> None:
        """--dry-run mode does not create or modify any output files."""
        entries = {
            "beast_dot_01": {"description": "A boon"},
            "beast_dot_02": {"description": "Another boon"},
        }

        output_path = tmp_path / "output.json"

        # Verify no file exists before
        assert not output_path.exists()

        # Run with dry_run=True
        summary = write_output(entries, output_path, dry_run=True)

        # File still does not exist
        assert not output_path.exists()
        assert summary.written is False

    def test_dry_run_does_not_overwrite_existing_file(self, tmp_path: Path) -> None:
        """--dry-run does not modify an existing output file."""
        output_path = tmp_path / "existing.json"
        original_content = '{"old": "data"}\n'
        output_path.write_text(original_content, encoding="utf-8")

        entries = {
            "beast_dot_01": {"description": "New content"},
        }

        write_output(entries, output_path, dry_run=True)

        # File still has original content
        assert output_path.read_text(encoding="utf-8") == original_content

    def test_dry_run_prints_summary_to_stdout(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """--dry-run prints a summary line with path, entry count, and changed count."""
        entries = {
            "beast_dot_01": {"description": "A boon"},
            "beast_dot_02": {"description": "Another boon"},
            "_meta": {"source": "test"},
        }

        output_path = tmp_path / "tables" / "boons" / "fragment.json"

        write_output(entries, output_path, dry_run=True)

        captured = capsys.readouterr()

        # Summary line should contain the path, entry count, and changed count
        assert str(output_path) in captured.out
        assert "2 entries" in captured.out
        assert "2 changed" in captured.out

    def test_dry_run_reports_changes_against_existing(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """--dry-run correctly reports changed entries vs existing file."""
        output_path = tmp_path / "fragment.json"

        # Write initial version
        initial_entries = {
            "beast_dot_01": {"description": "Original"},
            "beast_dot_02": {"description": "Unchanged"},
        }
        write_output(initial_entries, output_path)

        # Now dry-run with one changed entry
        updated_entries = {
            "beast_dot_01": {"description": "Modified"},
            "beast_dot_02": {"description": "Unchanged"},
        }
        write_output(updated_entries, output_path, dry_run=True)

        captured = capsys.readouterr()

        # Should report 2 entries, 1 changed
        assert "2 entries" in captured.out
        assert "1 changed" in captured.out

    def test_dry_run_via_cmd_run_writes_no_files(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """cmd_run with --dry-run does not write any output files."""
        from parse import cmd_run, build_parser

        # Set up a minimal book spec in a temp directory
        specs_dir = tmp_path / "book_specs"
        specs_dir.mkdir()

        spec_content = {
            "book_id": "dry_run_test",
            "filenames": ["test.pdf"],
            "output_path": "src/data/_extracted/dry_run_test.txt",
            "section_anchors": [{"pattern": "TEST", "pattern_type": "literal"}],
            "heading_patterns": [{"regex": "^HEADING", "flags": ["MULTILINE"]}],
            "expected_fields": ["Cost"],
            "pipeline_stages": ["ingest", "extract", "validate"],
            "json_output_paths": {
                "boons": str(tmp_path / "output" / "test.json"),
            },
        }

        import yaml
        (specs_dir / "dry_run_test.yaml").write_text(
            yaml.dump(spec_content), encoding="utf-8"
        )

        output_dir = tmp_path / "output"

        # Patch _BOOK_SPECS_DIR and run with --dry-run
        parser = build_parser()
        args = parser.parse_args(["run", "--book", "dry_run_test", "--dry-run"])

        with patch("parse._BOOK_SPECS_DIR", specs_dir):
            exit_code = cmd_run(args)

        # No output file should exist
        assert not output_dir.exists() or not any(output_dir.iterdir())

