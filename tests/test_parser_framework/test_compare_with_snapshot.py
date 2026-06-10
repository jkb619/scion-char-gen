"""Unit tests for compare_with_snapshot.py.

Tests cover:
- JSON file comparison logic (MATCH, SUPERSET, REGRESSION, CHANGED statuses)
- Handling of missing files (both current and snapshot)
- _data_keys filtering of underscore-prefixed keys
- compare_all using manifest to find files
- Exit code semantics (0 = no regressions, 1 = regressions found)
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

from compare_with_snapshot import (
    FileDiff,
    _data_keys,
    _load_json,
    compare_all,
    compare_json_files,
)


class TestDataKeys:
    """Test the _data_keys helper."""

    def test_excludes_meta_keys(self):
        data = {"_meta": {}, "_internal": {}, "foo": 1, "bar": 2}
        assert _data_keys(data) == {"foo", "bar"}

    def test_empty_dict(self):
        assert _data_keys({}) == set()

    def test_only_meta_keys(self):
        data = {"_meta": {}, "_version": "1.0"}
        assert _data_keys(data) == set()

    def test_all_data_keys(self):
        data = {"alpha": 1, "beta": 2, "gamma": 3}
        assert _data_keys(data) == {"alpha", "beta", "gamma"}


class TestLoadJson:
    """Test JSON loading edge cases."""

    def test_nonexistent_file(self, tmp_path):
        assert _load_json(tmp_path / "nope.json") is None

    def test_valid_json(self, tmp_path):
        f = tmp_path / "test.json"
        f.write_text('{"a": 1}', encoding="utf-8")
        assert _load_json(f) == {"a": 1}

    def test_invalid_json(self, tmp_path):
        f = tmp_path / "bad.json"
        f.write_text("not json", encoding="utf-8")
        assert _load_json(f) is None


class TestCompareJsonFiles:
    """Test individual file comparison logic."""

    def _write_json(self, path: Path, data: dict) -> None:
        path.write_text(json.dumps(data), encoding="utf-8")

    def test_match(self, tmp_path):
        snap = tmp_path / "snap.json"
        curr = tmp_path / "curr.json"
        data = {"_meta": {"title": "test"}, "foo": {"id": "foo"}, "bar": {"id": "bar"}}
        self._write_json(snap, data)
        self._write_json(curr, data)

        diff = compare_json_files(snap, curr, "test.json")
        assert diff.status == "MATCH"
        assert diff.snapshot_key_count == 2
        assert diff.current_key_count == 2
        assert diff.keys_added == []
        assert diff.keys_removed == []
        assert diff.keys_changed == []

    def test_superset(self, tmp_path):
        snap = tmp_path / "snap.json"
        curr = tmp_path / "curr.json"
        self._write_json(snap, {"_meta": {}, "a": 1, "b": 2})
        self._write_json(curr, {"_meta": {}, "a": 1, "b": 2, "c": 3})

        diff = compare_json_files(snap, curr, "test.json")
        assert diff.status == "SUPERSET"
        assert diff.keys_added == ["c"]
        assert diff.keys_removed == []

    def test_regression(self, tmp_path):
        snap = tmp_path / "snap.json"
        curr = tmp_path / "curr.json"
        self._write_json(snap, {"_meta": {}, "a": 1, "b": 2, "c": 3})
        self._write_json(curr, {"_meta": {}, "a": 1})

        diff = compare_json_files(snap, curr, "test.json")
        assert diff.status == "REGRESSION"
        assert sorted(diff.keys_removed) == ["b", "c"]

    def test_changed_values(self, tmp_path):
        snap = tmp_path / "snap.json"
        curr = tmp_path / "curr.json"
        self._write_json(snap, {"_meta": {}, "a": {"value": "old"}, "b": 2})
        self._write_json(curr, {"_meta": {}, "a": {"value": "new"}, "b": 2})

        diff = compare_json_files(snap, curr, "test.json")
        assert diff.status == "CHANGED"
        assert diff.keys_changed == ["a"]

    def test_missing_current_file(self, tmp_path):
        snap = tmp_path / "snap.json"
        self._write_json(snap, {"_meta": {}, "a": 1, "b": 2})

        diff = compare_json_files(snap, tmp_path / "nope.json", "test.json")
        assert diff.status == "MISSING_CURRENT"
        assert diff.snapshot_key_count == 2

    def test_missing_snapshot_file(self, tmp_path):
        curr = tmp_path / "curr.json"
        self._write_json(curr, {"_meta": {}, "x": 1})

        diff = compare_json_files(tmp_path / "nope.json", curr, "test.json")
        assert diff.status == "MISSING_SNAPSHOT"
        assert diff.current_key_count == 1

    def test_both_missing(self, tmp_path):
        diff = compare_json_files(tmp_path / "a.json", tmp_path / "b.json", "test.json")
        assert diff.status == "MISSING_BOTH"


class TestCompareAll:
    """Test the full compare_all workflow with a manifest."""

    def _write_json(self, path: Path, data: dict) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data), encoding="utf-8")

    def test_uses_manifest(self, tmp_path):
        snapshot_dir = tmp_path / "snapshot"
        data_dir = tmp_path / "data"
        snapshot_dir.mkdir()
        data_dir.mkdir()

        # Create manifest
        manifest = {
            "files_copied": ["knacks.json", "boons.json"],
            "files_missing": [],
        }
        self._write_json(snapshot_dir / "_manifest.json", manifest)

        # Create matching files
        self._write_json(snapshot_dir / "knacks.json", {"_meta": {}, "k1": 1, "k2": 2})
        self._write_json(data_dir / "knacks.json", {"_meta": {}, "k1": 1, "k2": 2, "k3": 3})
        self._write_json(snapshot_dir / "boons.json", {"_meta": {}, "b1": 1})
        self._write_json(data_dir / "boons.json", {"_meta": {}, "b1": 1})

        results = compare_all(snapshot_dir, data_dir)
        assert len(results) == 2
        assert results[0].status == "SUPERSET"
        assert results[1].status == "MATCH"

    def test_missing_manifest(self, tmp_path, capsys):
        results = compare_all(tmp_path / "nonexistent", tmp_path)
        assert results == []

    def test_empty_manifest(self, tmp_path):
        snapshot_dir = tmp_path / "snapshot"
        snapshot_dir.mkdir()
        manifest = {"files_copied": [], "files_missing": []}
        self._write_json(snapshot_dir / "_manifest.json", manifest)

        results = compare_all(snapshot_dir, tmp_path)
        assert results == []

    def _write_json(self, path: Path, data: dict) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data), encoding="utf-8")
