"""
Load game data tables from ``data/tables/<name>/*.json`` fragments (merged in sorted
filename order), or fall back to ``data/<name>.json`` when no fragment directory exists.

Supplement rows (Saints & Monsters, Titans Rising, etc.) live in later fragments so they
override on duplicate keys where intended.

Scripts that patch PB-aligned rows should write to ``primary_write_path(table)``.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.config import DATA_DIR

TABLES_DIR = DATA_DIR / "tables"

PRIMARY_FRAGMENT: dict[str, str] = {
    "purviews": "00_SCION_Pandoras_Box_Revised.json",
    "boons": "00_SCION_Pandoras_Box_Revised.json",
    "knacks": "00_SCION_Pandoras_Box_and_Origin_Knacks.json",
    "callings": "00_Scion_Origin_Core_Callings.json",
}


def table_fragment_dir(name: str) -> Path:
    return TABLES_DIR / name


def primary_write_path(name: str) -> Path:
    fname = PRIMARY_FRAGMENT.get(name)
    if not fname:
        raise KeyError(f"No primary_write_path registered for table {name!r}")
    return table_fragment_dir(name) / fname


def _read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _deep_merge_purview_row(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for k, v in patch.items():
        if k.startswith("_"):
            continue
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = {**out[k], **v}
        else:
            out[k] = v
    return out


def load_merged_table(name: str) -> dict[str, Any]:
    frag_dir = table_fragment_dir(name)
    json_files = sorted(frag_dir.glob("*.json")) if frag_dir.is_dir() else []
    json_files = [p for p in json_files if p.is_file() and not p.name.startswith("_")]
    legacy = DATA_DIR / f"{name}.json"

    if not json_files:
        if not legacy.is_file():
            raise FileNotFoundError(f"No data for table {name!r}: missing {frag_dir} and {legacy}")
        data = _read_json(legacy)
        if not isinstance(data, dict):
            raise TypeError(f"{name}.json must be a JSON object at the top level")
        return data

    merged: dict[str, Any] = {}
    meta_acc: dict[str, Any] = {}
    frag_names: list[str] = []

    for p in json_files:
        part = _read_json(p)
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
            if not isinstance(v, dict):
                merged[k] = v
                continue
            if name == "purviews" and k in merged and isinstance(merged[k], dict):
                merged[k] = _deep_merge_purview_row(merged[k], v)
            else:
                merged[k] = v

    meta_acc["tableFragments"] = frag_names
    merged["_meta"] = meta_acc
    return merged
