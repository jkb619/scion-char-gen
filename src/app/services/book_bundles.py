"""
Optional per-book game data under ``src/data/books/*.json``.

Each file is one volume (community supplement or Onyx PDF mirrored locally).
Removing a file drops its rows from the API bundle without editing ``meta.json``.

Supported top-level keys (merged into the main bundle tables):
  ``equipment``, ``tags``, ``birthrights``, ``boons``, ``knacks``, ``purviews``, ``callings``, ``paths``

Each merged object dict gets ``sourceBook`` set to the file's ``_meta.slug`` when absent.
``purviews`` rows deep-merge with existing entries (same rule as table fragments).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

BOOK_MERGE_KEYS = frozenset(
    {"equipment", "tags", "birthrights", "boons", "knacks", "purviews", "callings", "paths"},
)


def _read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _deep_merge_purview_row(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    """Match ``data_tables.load_merged_table`` purview merge (skip ``_*`` patch keys)."""
    out = dict(base)
    for k, v in patch.items():
        if str(k).startswith("_"):
            continue
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = {**out[k], **v}
        else:
            out[k] = v
    return out


def merge_book_directory_into_bundle(bundle: dict[str, Any], data_dir: Path) -> None:
    """Merge every ``data_dir/books/*.json`` into ``bundle`` (mutates in place)."""
    books_dir = data_dir / "books"
    if not books_dir.is_dir():
        return

    registry: list[dict[str, Any]] = []

    for path in sorted(books_dir.glob("*.json")):
        if not path.is_file() or path.name.startswith("_"):
            continue
        raw = _read_json(path)
        if not isinstance(raw, dict):
            continue

        root_meta = raw.get("_meta")
        slug = path.stem
        if isinstance(root_meta, dict):
            slug = str(root_meta.get("slug") or slug).strip() or slug

        tables_touched: list[str] = []
        for key, val in raw.items():
            if key == "_meta" or str(key).startswith("_"):
                continue
            if key not in BOOK_MERGE_KEYS:
                continue
            if not isinstance(val, dict):
                continue

            base = bundle.get(key)
            if not isinstance(base, dict):
                bundle[key] = {}
                base = bundle[key]

            for rid, row in val.items():
                if not rid or str(rid).startswith("_"):
                    continue
                if not isinstance(row, dict):
                    base[rid] = row
                    continue
                stamped = dict(row)
                stamped.setdefault("sourceBook", slug)
                if key == "purviews" and rid in base and isinstance(base.get(rid), dict):
                    base[rid] = _deep_merge_purview_row(base[rid], stamped)
                else:
                    base[rid] = stamped
            tables_touched.append(str(key))

        entry: dict[str, Any] = {"slug": slug, "file": path.name, "tables": tables_touched}
        if isinstance(root_meta, dict):
            entry["meta"] = root_meta
        registry.append(entry)

    if registry:
        bundle["bookBundleRegistry"] = registry
