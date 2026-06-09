"""Integration tests verifying framework output is compatible with data_tables.

Validates Requirements 7.1, 7.2, 7.5, 7.6:
- Framework JSON output lands at paths registered in data_tables.py PRIMARY_FRAGMENT
- data_tables.load_merged_table can consume framework output without modification
- Output format (top-level object, _meta key, entry values as dicts) is preserved
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

# Ensure src/ is importable for both app and scripts
_REPO_ROOT = Path(__file__).resolve().parents[2]
_SRC_DIR = _REPO_ROOT / "src"
_SCRIPTS_DIR = _SRC_DIR / "scripts"

if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from parser_framework.output_writer import format_json, write_output
from parser_framework.models import BookSpec, SectionAnchor, HeadingPattern


class TestFrameworkOutputFormat:
    """Verify the framework's JSON output format is compatible with load_merged_table."""

    def test_output_is_valid_utf8_json_object(self, tmp_path: Path) -> None:
        """Framework output is a valid UTF-8 JSON object at the top level."""
        entries = {
            "beast_dot_01": {"description": "A beast boon", "mechanicalEffects": "Does things"},
            "beast_dot_02": {"description": "Another boon", "mechanicalEffects": "More things"},
            "_meta": {"source": "pandoras_box", "version": "1.0"},
        }

        output_path = tmp_path / "test_output.json"
        write_output(entries, output_path)

        content = output_path.read_text(encoding="utf-8")
        parsed = json.loads(content)

        # Top-level must be a dict (JSON object) — load_merged_table requires this
        assert isinstance(parsed, dict)

    def test_output_preserves_meta_key(self, tmp_path: Path) -> None:
        """Framework output can include _meta key (load_merged_table handles it)."""
        entries = {
            "chaos_dot_01": {"description": "Chaos boon"},
            "_meta": {"source": "pandoras_box"},
        }

        output_path = tmp_path / "test_output.json"
        write_output(entries, output_path)

        content = output_path.read_text(encoding="utf-8")
        parsed = json.loads(content)

        assert "_meta" in parsed
        assert parsed["_meta"]["source"] == "pandoras_box"

    def test_output_entry_values_are_dicts(self, tmp_path: Path) -> None:
        """Each non-meta entry value is a dict — matches load_merged_table expectations."""
        entries = {
            "beast_dot_01": {"description": "Test", "mechanicalEffects": "Effect"},
            "beast_dot_02": {"description": "Test2", "mechanicalEffects": "Effect2"},
        }

        output_path = tmp_path / "test_output.json"
        write_output(entries, output_path)

        content = output_path.read_text(encoding="utf-8")
        parsed = json.loads(content)

        for key, value in parsed.items():
            if not key.startswith("_"):
                assert isinstance(value, dict), f"Entry '{key}' must be a dict"

    def test_output_uses_2_space_indent_and_trailing_newline(self, tmp_path: Path) -> None:
        """Output matches formatting required by existing conventions."""
        entries = {"key": {"field": "value"}}
        output_path = tmp_path / "test_output.json"
        write_output(entries, output_path)

        content = output_path.read_text(encoding="utf-8")

        # Must end with exactly one newline
        assert content.endswith("\n")
        assert not content.endswith("\n\n")

        # Must use 2-space indentation
        assert '  "key"' in content

    def test_format_json_matches_existing_output_style(self) -> None:
        """format_json produces the same style as existing scripts."""
        entries = {
            "beast_dot_01": {"description": "A boon", "mechanicalEffects": "Effect"},
            "_meta": {"source": "test"},
        }

        result = format_json(entries)

        # Valid JSON
        parsed = json.loads(result)
        assert parsed == entries

        # Trailing newline
        assert result.endswith("\n")

        # 2-space indent (check for indented key)
        lines = result.split("\n")
        indented_lines = [l for l in lines if l.startswith("  ")]
        assert len(indented_lines) > 0


class TestLoadMergedTableCompatibility:
    """Verify framework output can be consumed by load_merged_table without modification.

    These tests simulate load_merged_table's core logic against framework output
    to ensure structural compatibility without requiring the full app import chain.
    """

    def _simulate_load_merged_table(self, frag_dir: Path) -> dict:
        """Simulate the core logic of data_tables.load_merged_table.

        This replicates the fragment-loading and merging behavior exactly as
        data_tables.py implements it, without importing the app module (which
        would require Flask context).
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

    def test_framework_output_loadable_as_table_fragment(self, tmp_path: Path) -> None:
        """Framework output written to a fragment dir can be loaded by load_merged_table."""
        # Simulate framework writing to a table fragment path
        frag_dir = tmp_path / "tables" / "boons"
        frag_dir.mkdir(parents=True)

        entries = {
            "beast_dot_01": {
                "description": "Control or command beasts",
                "mechanicalEffects": "Spend Legend to summon...",
            },
            "beast_dot_02": {
                "description": "Transform into a beast",
                "mechanicalEffects": "Shift form...",
            },
            "_meta": {"source": "pandoras_box", "version": "2.0"},
        }

        output_path = frag_dir / "00_SCION_Pandoras_Box_Revised.json"
        write_output(entries, output_path)

        # Now simulate load_merged_table reading it
        result = self._simulate_load_merged_table(frag_dir)

        # Verify entries are present and correct
        assert "beast_dot_01" in result
        assert result["beast_dot_01"]["description"] == "Control or command beasts"
        assert "beast_dot_02" in result
        assert result["beast_dot_02"]["mechanicalEffects"] == "Shift form..."

        # Verify _meta is assembled correctly
        assert "_meta" in result
        assert result["_meta"]["source"] == "pandoras_box"
        assert "tableFragments" in result["_meta"]
        assert "00_SCION_Pandoras_Box_Revised.json" in result["_meta"]["tableFragments"]

    def test_multiple_fragments_merge_correctly(self, tmp_path: Path) -> None:
        """Multiple framework-produced fragments merge like existing behavior."""
        frag_dir = tmp_path / "tables" / "boons"
        frag_dir.mkdir(parents=True)

        # First fragment (primary - Pandora's Box)
        primary = {
            "beast_dot_01": {"description": "Original PB boon"},
            "_meta": {"source": "pandoras_box"},
        }
        write_output(primary, frag_dir / "00_SCION_Pandoras_Box_Revised.json")

        # Second fragment (supplement - Saints & Monsters)
        supplement = {
            "new_boon_01": {"description": "S&M supplement boon"},
            "_meta": {"source": "saints_monsters"},
        }
        write_output(supplement, frag_dir / "20_Scion_Players_Guide_Saints_Monsters.json")

        result = self._simulate_load_merged_table(frag_dir)

        # Both entries present
        assert "beast_dot_01" in result
        assert "new_boon_01" in result
        # Later fragment overrides _meta keys set by earlier ones (setdefault)
        assert result["_meta"]["source"] == "pandoras_box"  # first wins with setdefault

    def test_underscore_prefixed_files_excluded(self, tmp_path: Path) -> None:
        """Files starting with _ are excluded from loading (baseline files, etc)."""
        frag_dir = tmp_path / "tables" / "boons"
        frag_dir.mkdir(parents=True)

        # Regular fragment
        entries = {"beast_dot_01": {"description": "Boon"}}
        write_output(entries, frag_dir / "00_fragment.json")

        # Underscore-prefixed file (should be ignored)
        ignored = {"_internal": {"data": "ignored"}}
        write_output(ignored, frag_dir / "_baseline_snapshot.json")

        result = self._simulate_load_merged_table(frag_dir)

        assert "beast_dot_01" in result
        assert "_internal" not in result


class TestJsonOutputPathsWiring:
    """Verify json_output_paths in BookSpec maps to correct data_tables paths."""

    def test_pandoras_box_paths_match_primary_fragment(self) -> None:
        """Pandora's Box json_output_paths match PRIMARY_FRAGMENT entries."""
        import yaml

        spec_path = _SCRIPTS_DIR / "book_specs" / "pandoras_box.yaml"
        with spec_path.open(encoding="utf-8") as f:
            spec_data = yaml.safe_load(f)

        json_output_paths = spec_data.get("json_output_paths", {})

        # These must match data_tables.py PRIMARY_FRAGMENT
        assert "boons" in json_output_paths
        assert json_output_paths["boons"] == "src/data/tables/boons/00_SCION_Pandoras_Box_Revised.json"

        assert "purviews" in json_output_paths
        assert json_output_paths["purviews"] == "src/data/tables/purviews/00_SCION_Pandoras_Box_Revised.json"

    def test_scion_origin_paths_match_primary_fragment(self) -> None:
        """Scion Origin json_output_paths match PRIMARY_FRAGMENT entries."""
        import yaml

        spec_path = _SCRIPTS_DIR / "book_specs" / "scion_origin.yaml"
        with spec_path.open(encoding="utf-8") as f:
            spec_data = yaml.safe_load(f)

        json_output_paths = spec_data.get("json_output_paths", {})

        assert "callings" in json_output_paths
        assert json_output_paths["callings"] == "src/data/tables/callings/00_Scion_Origin_Core_Callings.json"

    def test_saints_monsters_paths_match_table_fragments(self) -> None:
        """Saints & Monsters json_output_paths match its table fragment files."""
        import yaml

        spec_path = _SCRIPTS_DIR / "book_specs" / "saints_monsters.yaml"
        with spec_path.open(encoding="utf-8") as f:
            spec_data = yaml.safe_load(f)

        json_output_paths = spec_data.get("json_output_paths", {})

        assert "boons" in json_output_paths
        assert "20_Scion_Players_Guide_Saints_Monsters.json" in json_output_paths["boons"]

    def test_output_paths_point_to_existing_directories(self) -> None:
        """All json_output_paths target directories that exist in the repo."""
        import yaml

        specs_dir = _SCRIPTS_DIR / "book_specs"
        for spec_file in specs_dir.glob("*.yaml"):
            with spec_file.open(encoding="utf-8") as f:
                spec_data = yaml.safe_load(f)

            json_output_paths = spec_data.get("json_output_paths")
            if json_output_paths is None:
                continue

            for table_name, rel_path in json_output_paths.items():
                abs_path = _REPO_ROOT / rel_path
                # The parent directory should exist (tables/boons/, etc.)
                assert abs_path.parent.exists(), (
                    f"{spec_file.name}: json_output_paths.{table_name} targets "
                    f"non-existent directory {abs_path.parent}"
                )


class TestDirectoryStructure:
    """Verify required directory structure exists."""

    def test_baselines_directory_exists(self) -> None:
        """src/data/_baselines/ directory exists with .gitkeep."""
        baselines_dir = _REPO_ROOT / "src" / "data" / "_baselines"
        assert baselines_dir.is_dir()
        assert (baselines_dir / ".gitkeep").exists()

    def test_extracted_directory_exists(self) -> None:
        """src/data/_extracted/ directory exists with .gitkeep."""
        extracted_dir = _REPO_ROOT / "src" / "data" / "_extracted"
        assert extracted_dir.is_dir()
        assert (extracted_dir / ".gitkeep").exists()

    def test_tables_fragment_directories_exist(self) -> None:
        """All table fragment directories referenced by PRIMARY_FRAGMENT exist."""
        tables_dir = _REPO_ROOT / "src" / "data" / "tables"
        expected_subdirs = ["boons", "purviews", "knacks", "callings"]
        for subdir in expected_subdirs:
            assert (tables_dir / subdir).is_dir(), f"Missing tables/{subdir}/"
