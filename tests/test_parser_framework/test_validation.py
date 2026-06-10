"""Unit tests for validation_reporter.py — baseline comparison and regression detection."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from parser_framework.models import BookSpec, FlaggedEntry, ValidationReport
from parser_framework.validation_reporter import (
    compute_content_hash,
    load_baseline,
    save_baseline,
    validate,
)


def _make_spec(book_id: str = "test_book", output_path: str = "src/data/test_table.json") -> BookSpec:
    """Create a minimal BookSpec for testing."""
    return BookSpec(
        book_id=book_id,
        filenames=["test.pdf"],
        output_path=output_path,
        section_anchors=[],
        heading_patterns=[],
        expected_fields=["field1", "field2"],
        pipeline_stages=["validate"],
    )


class TestComputeContentHash:
    """Tests for compute_content_hash."""

    def test_deterministic_for_same_input(self):
        entry = {"name": "Beast", "cost": "1"}
        assert compute_content_hash(entry) == compute_content_hash(entry)

    def test_key_order_does_not_matter(self):
        entry_a = {"name": "Beast", "cost": "1"}
        entry_b = {"cost": "1", "name": "Beast"}
        assert compute_content_hash(entry_a) == compute_content_hash(entry_b)

    def test_different_content_produces_different_hash(self):
        entry_a = {"name": "Beast", "cost": "1"}
        entry_b = {"name": "Beast", "cost": "2"}
        assert compute_content_hash(entry_a) != compute_content_hash(entry_b)

    def test_returns_hex_string_of_correct_length(self):
        entry = {"key": "value"}
        h = compute_content_hash(entry)
        assert len(h) == 64  # SHA-256 hex digest is 64 chars
        assert all(c in "0123456789abcdef" for c in h)

    def test_empty_dict(self):
        h = compute_content_hash({})
        assert len(h) == 64


class TestLoadBaseline:
    """Tests for load_baseline."""

    def test_returns_none_when_file_missing(self, tmp_path):
        result = load_baseline(tmp_path / "nonexistent.json")
        assert result is None

    def test_loads_valid_json(self, tmp_path):
        baseline = {"book_id": "test", "entries": {"key1": {"hash": "abc"}}}
        path = tmp_path / "baseline.json"
        path.write_text(json.dumps(baseline), encoding="utf-8")
        result = load_baseline(path)
        assert result == baseline


class TestSaveBaseline:
    """Tests for save_baseline."""

    def test_creates_file_with_correct_structure(self, tmp_path):
        path = tmp_path / "test_book" / "my_table.json"
        entries = {
            "entry_1": {"field_a": "value_a", "field_b": "value_b"},
            "entry_2": {"field_a": "val2", "field_b": "val3"},
        }
        save_baseline(path, entries)

        assert path.exists()
        data = json.loads(path.read_text(encoding="utf-8"))

        assert data["book_id"] == "test_book"
        assert data["table_name"] == "my_table"
        assert data["entry_count"] == 2
        assert "generated_at" in data
        assert "entry_1" in data["entries"]
        assert "hash" in data["entries"]["entry_1"]
        assert sorted(data["entries"]["entry_1"]["fields"]) == ["field_a", "field_b"]

    def test_creates_parent_directories(self, tmp_path):
        path = tmp_path / "deep" / "nested" / "dir" / "table.json"
        save_baseline(path, {"k": {"f": "v"}})
        assert path.exists()

    def test_file_ends_with_newline(self, tmp_path):
        path = tmp_path / "book" / "table.json"
        save_baseline(path, {"k": {"f": "v"}})
        content = path.read_text(encoding="utf-8")
        assert content.endswith("\n")

    def test_uses_2_space_indentation(self, tmp_path):
        path = tmp_path / "book" / "table.json"
        save_baseline(path, {"k": {"f": "v"}})
        content = path.read_text(encoding="utf-8")
        # 2-space indent means lines like '  "book_id": ...'
        lines = content.split("\n")
        indented_lines = [l for l in lines if l.startswith("  ") and not l.startswith("    ")]
        assert len(indented_lines) > 0


class TestValidate:
    """Tests for the validate function."""

    def test_skipped_due_to_errors_when_has_errors(self, tmp_path):
        spec = _make_spec()
        entries = {"key1": {"field1": "a", "field2": "b"}}
        report = validate(spec, entries, tmp_path, has_errors=True)

        assert report.status == "skipped_due_to_errors"
        assert report.regressions == {"missing_entry": 0, "new_entry": 0, "content_changed": 0}
        assert report.flagged == []

    def test_skipped_due_to_errors_when_entries_empty(self, tmp_path):
        spec = _make_spec()
        report = validate(spec, {}, tmp_path)

        assert report.status == "skipped_due_to_errors"

    def test_first_run_creates_baseline_and_reports_ok(self, tmp_path):
        spec = _make_spec()
        entries = {
            "beast_dot_01": {"field1": "val1", "field2": "val2"},
            "beast_dot_02": {"field1": "val3", "field2": "val4"},
        }
        report = validate(spec, entries, tmp_path)

        assert report.status == "ok"
        assert report.regressions == {"missing_entry": 0, "new_entry": 0, "content_changed": 0}
        assert report.flagged == []
        assert report.total_entries == 2

        # Verify baseline file was created
        baseline_path = tmp_path / spec.book_id / "test_table.json"
        assert baseline_path.exists()

    def test_no_changes_reports_ok(self, tmp_path):
        spec = _make_spec()
        entries = {"key1": {"field1": "a"}, "key2": {"field1": "b"}}

        # First run creates baseline
        validate(spec, entries, tmp_path)
        # Second run with same data
        report = validate(spec, entries, tmp_path)

        assert report.status == "ok"
        assert report.regressions == {"missing_entry": 0, "new_entry": 0, "content_changed": 0}
        assert report.flagged == []

    def test_missing_entry_flagged(self, tmp_path):
        spec = _make_spec()
        entries_v1 = {"key1": {"f": "a"}, "key2": {"f": "b"}, "key3": {"f": "c"}}
        entries_v2 = {"key1": {"f": "a"}, "key3": {"f": "c"}}

        validate(spec, entries_v1, tmp_path)
        report = validate(spec, entries_v2, tmp_path)

        assert report.status == "error"
        assert report.regressions["missing_entry"] == 1
        missing = [f for f in report.flagged if f.severity == "missing_entry"]
        assert len(missing) == 1
        assert missing[0].key == "key2"

    def test_new_entry_flagged_as_warning(self, tmp_path):
        spec = _make_spec()
        entries_v1 = {"key1": {"f": "a"}}
        entries_v2 = {"key1": {"f": "a"}, "key2": {"f": "b"}}

        validate(spec, entries_v1, tmp_path)
        report = validate(spec, entries_v2, tmp_path)

        assert report.status == "warning"
        assert report.regressions["new_entry"] == 1
        new = [f for f in report.flagged if f.severity == "new_entry"]
        assert len(new) == 1
        assert new[0].key == "key2"

    def test_content_changed_flagged_as_error(self, tmp_path):
        spec = _make_spec()
        entries_v1 = {"key1": {"f": "original"}}
        entries_v2 = {"key1": {"f": "modified"}}

        validate(spec, entries_v1, tmp_path)
        report = validate(spec, entries_v2, tmp_path)

        assert report.status == "error"
        assert report.regressions["content_changed"] == 1
        changed = [f for f in report.flagged if f.severity == "content_changed"]
        assert len(changed) == 1
        assert changed[0].key == "key1"
        assert changed[0].old_hash is not None
        assert changed[0].new_hash is not None
        assert changed[0].old_hash != changed[0].new_hash

    def test_mixed_regressions(self, tmp_path):
        spec = _make_spec()
        entries_v1 = {"key1": {"f": "a"}, "key2": {"f": "b"}, "key3": {"f": "c"}}
        entries_v2 = {"key1": {"f": "changed"}, "key3": {"f": "c"}, "key4": {"f": "d"}}

        validate(spec, entries_v1, tmp_path)
        report = validate(spec, entries_v2, tmp_path)

        assert report.status == "error"
        assert report.regressions["missing_entry"] == 1  # key2 missing
        assert report.regressions["new_entry"] == 1  # key4 new
        assert report.regressions["content_changed"] == 1  # key1 changed
        assert len(report.flagged) == 3

    def test_update_flag_overwrites_baseline(self, tmp_path):
        spec = _make_spec()
        entries_v1 = {"key1": {"f": "a"}}
        entries_v2 = {"key1": {"f": "changed"}, "key2": {"f": "new"}}

        validate(spec, entries_v1, tmp_path)
        # Update with new entries
        report = validate(spec, entries_v2, tmp_path, update=True)

        # Report should show the diffs
        assert report.regressions["content_changed"] == 1
        assert report.regressions["new_entry"] == 1

        # But baseline should now be updated — running again should be clean
        report2 = validate(spec, entries_v2, tmp_path)
        assert report2.status == "ok"
        assert report2.flagged == []

    def test_table_name_derived_from_output_path(self, tmp_path):
        spec = _make_spec(output_path="src/data/boonPbMechanics.json")
        entries = {"k": {"f": "v"}}
        report = validate(spec, entries, tmp_path)

        assert report.table_name == "boonPbMechanics"

    def test_report_has_correct_book_id(self, tmp_path):
        spec = _make_spec(book_id="pandoras_box")
        entries = {"k": {"f": "v"}}
        report = validate(spec, entries, tmp_path)

        assert report.book_id == "pandoras_box"

    def test_baseline_stored_at_correct_path(self, tmp_path):
        spec = _make_spec(book_id="my_book", output_path="src/data/my_output.json")
        entries = {"k": {"f": "v"}}
        validate(spec, entries, tmp_path)

        expected_path = tmp_path / "my_book" / "my_output.json"
        assert expected_path.exists()
