"""
Load game data tables from ``data/<name>.json`` monolith files.

Scripts that patch PB-aligned rows should write to ``primary_write_path(table)``.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.config import DATA_DIR


def table_path(name: str) -> Path:
    return DATA_DIR / f"{name}.json"


def primary_write_path(name: str) -> Path:
    return table_path(name)


def _read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def load_merged_table(name: str) -> dict[str, Any]:
    path = table_path(name)
    if not path.is_file():
        raise FileNotFoundError(f"No data for table {name!r}: missing {path}")
    data = _read_json(path)
    if not isinstance(data, dict):
        raise TypeError(f"{name}.json must be a JSON object at the top level")
    return data
