"""Integration tests verifying framework output is compatible with data_tables.

Validates Requirements 7.1, 7.2, 7.5, 7.6:
- Framework JSON output lands at monolith paths under src/data/
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
    """Verify framework output can be consumed by load_merged_table without modification."""

    def test_framework_output_loadable_as_monolith(self, tmp_path: Path, monkeypatch) -> None:
        """Framework output written to a monolith path loads via load_merged_table."""
        from app.config import DATA_DIR
        from app.services import data_tables

        data_dir = tmp_path / "data"
        data_dir.mkdir()
        monkeypatch.setattr(data_tables, "DATA_DIR", data_dir)

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

        output_path = data_dir / "boons.json"
        write_output(entries, output_path)

        result = data_tables.load_merged_table("boons")

        assert "beast_dot_01" in result
        assert result["beast_dot_01"]["description"] == "Control or command beasts"
        assert result["_meta"]["source"] == "pandoras_box"


class TestJsonOutputPathsWiring:
    """Verify json_output_paths in BookSpec maps to correct data_tables paths."""

    def test_pandoras_box_paths_match_monoliths(self) -> None:
        """Pandora's Box json_output_paths target src/data monolith files."""
        import yaml

        spec_path = _SCRIPTS_DIR / "book_specs" / "pandoras_box.yaml"
        with spec_path.open(encoding="utf-8") as f:
            spec_data = yaml.safe_load(f)

        json_output_paths = spec_data.get("json_output_paths", {})

        assert json_output_paths["boons"] == "src/data/boons.json"
        assert json_output_paths["purviews"] == "src/data/purviews.json"

    def test_scion_origin_paths_match_monoliths(self) -> None:
        """Scion Origin json_output_paths target src/data monolith files."""
        import yaml

        spec_path = _SCRIPTS_DIR / "book_specs" / "scion_origin.yaml"
        with spec_path.open(encoding="utf-8") as f:
            spec_data = yaml.safe_load(f)

        json_output_paths = spec_data.get("json_output_paths", {})

        assert json_output_paths["callings"] == "src/data/callings.json"
        assert json_output_paths["knacks"] == "src/data/knacks.json"

    def test_saints_monsters_paths_match_monoliths(self) -> None:
        """Saints & Monsters json_output_paths target src/data monolith files."""
        import yaml

        spec_path = _SCRIPTS_DIR / "book_specs" / "saints_monsters.yaml"
        with spec_path.open(encoding="utf-8") as f:
            spec_data = yaml.safe_load(f)

        json_output_paths = spec_data.get("json_output_paths", {})

        assert json_output_paths["boons"] == "src/data/boons.json"
        assert json_output_paths["knacks"] == "src/data/knacks.json"
        assert json_output_paths["purviews"] == "src/data/purviews.json"

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
                assert abs_path.parent.exists(), (
                    f"{spec_file.name}: json_output_paths.{table_name} targets "
                    f"non-existent directory {abs_path.parent}"
                )
                if rel_path.startswith("src/data/") and rel_path.endswith(".json"):
                    assert abs_path.name.endswith(".json")


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

    def test_monolith_table_files_exist(self) -> None:
        """Core game tables load from src/data/*.json monolith files."""
        data_dir = _REPO_ROOT / "src" / "data"
        for name in ("boons", "purviews", "knacks", "callings"):
            assert (data_dir / f"{name}.json").is_file(), f"Missing src/data/{name}.json"
