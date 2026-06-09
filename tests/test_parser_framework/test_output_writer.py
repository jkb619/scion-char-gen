"""Unit tests for parser_framework.output_writer module."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from parser_framework.output_writer import (
    OutputSummary,
    compute_changes,
    format_json,
    write_output,
)


class TestFormatJson:
    """Tests for format_json function."""

    def test_empty_dict(self):
        result = format_json({})
        assert result == "{}\n"

    def test_trailing_newline(self):
        result = format_json({"a": 1})
        assert result.endswith("\n")
        # Should have exactly one trailing newline
        assert not result.endswith("\n\n")

    def test_two_space_indent(self):
        result = format_json({"key": {"nested": "value"}})
        lines = result.split("\n")
        # Second line should start with 2 spaces (first level indent)
        assert lines[1].startswith("  ")
        # Third line should start with 4 spaces (second level indent)
        assert lines[2].startswith("    ")

    def test_utf8_characters_preserved(self):
        result = format_json({"name": "café"})
        assert "café" in result
        # ensure_ascii=False means no \\u escapes for non-ASCII
        assert "\\u" not in result

    def test_unicode_preserved(self):
        result = format_json({"desc": "en\u2013dash and \u201csmart\u201d quotes"})
        assert "\u2013" in result
        assert "\u201c" in result

    def test_valid_json(self):
        entries = {
            "_meta": {"note": "test"},
            "artistry_dot_01": {"description": "test", "mechanicalEffects": "Cost: 1"},
        }
        result = format_json(entries)
        parsed = json.loads(result)
        assert parsed == entries

    def test_entry_key_convention(self):
        entries = {
            "beast_dot_01": {"description": "first"},
            "beast_dot_02": {"description": "second"},
            "beast_dot_10": {"description": "tenth"},
        }
        result = format_json(entries)
        parsed = json.loads(result)
        assert "beast_dot_01" in parsed
        assert "beast_dot_02" in parsed
        assert "beast_dot_10" in parsed


class TestComputeChanges:
    """Tests for compute_changes function."""

    def test_no_existing_file(self, tmp_path: Path):
        entries = {
            "_meta": {"note": "test"},
            "a_dot_01": {"desc": "one"},
            "a_dot_02": {"desc": "two"},
        }
        output_path = tmp_path / "nonexistent.json"
        entry_count, changed_count = compute_changes(entries, output_path)
        assert entry_count == 2  # excludes _meta
        assert changed_count == 2  # all new

    def test_identical_file(self, tmp_path: Path):
        entries = {
            "_meta": {"note": "test"},
            "a_dot_01": {"desc": "one"},
            "a_dot_02": {"desc": "two"},
        }
        output_path = tmp_path / "existing.json"
        output_path.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")

        entry_count, changed_count = compute_changes(entries, output_path)
        assert entry_count == 2
        assert changed_count == 0

    def test_modified_entries(self, tmp_path: Path):
        old_entries = {
            "_meta": {"note": "test"},
            "a_dot_01": {"desc": "one"},
            "a_dot_02": {"desc": "two"},
        }
        new_entries = {
            "_meta": {"note": "test"},
            "a_dot_01": {"desc": "modified"},
            "a_dot_02": {"desc": "two"},
        }
        output_path = tmp_path / "existing.json"
        output_path.write_text(json.dumps(old_entries, indent=2) + "\n", encoding="utf-8")

        entry_count, changed_count = compute_changes(new_entries, output_path)
        assert entry_count == 2
        assert changed_count == 1

    def test_new_entries_added(self, tmp_path: Path):
        old_entries = {
            "_meta": {"note": "test"},
            "a_dot_01": {"desc": "one"},
        }
        new_entries = {
            "_meta": {"note": "test"},
            "a_dot_01": {"desc": "one"},
            "a_dot_02": {"desc": "two"},
        }
        output_path = tmp_path / "existing.json"
        output_path.write_text(json.dumps(old_entries, indent=2) + "\n", encoding="utf-8")

        entry_count, changed_count = compute_changes(new_entries, output_path)
        assert entry_count == 2
        assert changed_count == 1  # a_dot_02 is new (counts as changed)

    def test_entries_removed(self, tmp_path: Path):
        old_entries = {
            "_meta": {"note": "test"},
            "a_dot_01": {"desc": "one"},
            "a_dot_02": {"desc": "two"},
        }
        new_entries = {
            "_meta": {"note": "test"},
            "a_dot_01": {"desc": "one"},
        }
        output_path = tmp_path / "existing.json"
        output_path.write_text(json.dumps(old_entries, indent=2) + "\n", encoding="utf-8")

        entry_count, changed_count = compute_changes(new_entries, output_path)
        assert entry_count == 1
        assert changed_count == 1  # a_dot_02 missing counts as changed

    def test_corrupt_file(self, tmp_path: Path):
        entries = {"a_dot_01": {"desc": "one"}}
        output_path = tmp_path / "corrupt.json"
        output_path.write_text("not valid json {{{", encoding="utf-8")

        entry_count, changed_count = compute_changes(entries, output_path)
        assert entry_count == 1
        assert changed_count == 1  # all treated as new

    def test_meta_keys_excluded_from_count(self, tmp_path: Path):
        entries = {
            "_meta": {"note": "test"},
            "_internal": {"debug": True},
            "a_dot_01": {"desc": "one"},
        }
        output_path = tmp_path / "nonexistent.json"
        entry_count, changed_count = compute_changes(entries, output_path)
        assert entry_count == 1  # only a_dot_01


class TestWriteOutput:
    """Tests for write_output function."""

    def test_writes_json_file(self, tmp_path: Path):
        entries = {
            "_meta": {"note": "test"},
            "beast_dot_01": {"description": "first beast"},
        }
        output_path = tmp_path / "output.json"
        summary = write_output(entries, output_path)

        assert summary.written is True
        assert summary.output_path == output_path
        assert summary.entry_count == 1
        assert output_path.exists()

        content = output_path.read_text(encoding="utf-8")
        assert content.endswith("\n")
        parsed = json.loads(content)
        assert parsed == entries

    def test_formatting_matches_convention(self, tmp_path: Path):
        entries = {
            "_meta": {"note": "test"},
            "artistry_dot_01": {"description": "desc", "mechanicalEffects": "Cost: 1"},
        }
        output_path = tmp_path / "output.json"
        write_output(entries, output_path)

        content = output_path.read_text(encoding="utf-8")
        expected = json.dumps(entries, indent=2, ensure_ascii=False) + "\n"
        assert content == expected

    def test_creates_parent_directories(self, tmp_path: Path):
        entries = {"a_dot_01": {"desc": "one"}}
        output_path = tmp_path / "nested" / "dir" / "output.json"
        summary = write_output(entries, output_path)

        assert summary.written is True
        assert output_path.exists()

    def test_dry_run_does_not_write(self, tmp_path: Path, capsys):
        entries = {
            "_meta": {"note": "test"},
            "beast_dot_01": {"description": "first"},
            "beast_dot_02": {"description": "second"},
        }
        output_path = tmp_path / "output.json"
        summary = write_output(entries, output_path, dry_run=True)

        assert summary.written is False
        assert summary.entry_count == 2
        assert summary.changed_count == 2  # all new since file doesn't exist
        assert not output_path.exists()

        captured = capsys.readouterr()
        assert str(output_path) in captured.out
        assert "2 entries" in captured.out
        assert "2 changed" in captured.out

    def test_dry_run_reports_changes(self, tmp_path: Path, capsys):
        old_entries = {
            "_meta": {"note": "test"},
            "a_dot_01": {"desc": "one"},
            "a_dot_02": {"desc": "two"},
        }
        new_entries = {
            "_meta": {"note": "test"},
            "a_dot_01": {"desc": "modified"},
            "a_dot_02": {"desc": "two"},
        }
        output_path = tmp_path / "output.json"
        output_path.write_text(json.dumps(old_entries, indent=2) + "\n", encoding="utf-8")

        summary = write_output(new_entries, output_path, dry_run=True)

        assert summary.written is False
        assert summary.entry_count == 2
        assert summary.changed_count == 1

        # File should remain unchanged
        content = output_path.read_text(encoding="utf-8")
        parsed = json.loads(content)
        assert parsed == old_entries

    def test_overwrites_existing_file(self, tmp_path: Path):
        old_entries = {"a_dot_01": {"desc": "old"}}
        new_entries = {"a_dot_01": {"desc": "new"}, "a_dot_02": {"desc": "added"}}
        output_path = tmp_path / "output.json"
        output_path.write_text(json.dumps(old_entries, indent=2) + "\n", encoding="utf-8")

        write_output(new_entries, output_path)

        content = output_path.read_text(encoding="utf-8")
        parsed = json.loads(content)
        assert parsed == new_entries

    def test_output_is_utf8(self, tmp_path: Path):
        entries = {"café_dot_01": {"description": "naïve résumé"}}
        output_path = tmp_path / "output.json"
        write_output(entries, output_path)

        # Read as bytes to verify encoding
        raw = output_path.read_bytes()
        text = raw.decode("utf-8")
        assert "café_dot_01" in text
        assert "naïve résumé" in text

    def test_standalone_output_path(self, tmp_path: Path):
        """Test writing to a standalone JSON path like boonPbMechanics.json."""
        entries = {
            "_meta": {"note": "PB boon mechanics"},
            "beast_dot_01": {"description": "first", "mechanicalEffects": "Cost: 1"},
        }
        output_path = tmp_path / "src" / "data" / "boonPbMechanics.json"
        summary = write_output(entries, output_path)

        assert summary.written is True
        assert output_path.exists()

    def test_table_fragment_output_path(self, tmp_path: Path):
        """Test writing to a table fragment path."""
        entries = {
            "_meta": {"tableFragments": ["00_SCION_Pandoras_Box_Revised.json"]},
            "artistry_dot_01": {"description": "test"},
        }
        output_path = tmp_path / "src" / "data" / "tables" / "boons" / "00_SCION_Pandoras_Box_Revised.json"
        summary = write_output(entries, output_path)

        assert summary.written is True
        assert output_path.exists()
