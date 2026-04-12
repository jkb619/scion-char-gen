from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.config import DATA_DIR


def _read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def allowed_names() -> frozenset[str]:
    meta_path = DATA_DIR / "meta.json"
    if not meta_path.exists():
        return frozenset()
    meta = _read_json(meta_path)
    return frozenset(meta.get("gameDataFiles", []))


def load_table(name: str) -> dict[str, Any]:
    if name not in allowed_names():
        raise KeyError(name)
    path = DATA_DIR / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(path)
    data = _read_json(path)
    if not isinstance(data, dict):
        raise TypeError(f"{name}.json must be a JSON object at the top level")
    return data


def load_bundle() -> dict[str, Any]:
    bundle: dict[str, Any] = {}
    for name in sorted(allowed_names()):
        bundle[name] = load_table(name)
    # Merge Saints & Monsters Titanic Knacks into the main `knacks` table (single bundle surface for the UI).
    sm_k = bundle.pop("knacksSaintsMonsters", None)
    if isinstance(sm_k, dict):
        base = bundle.get("knacks")
        if isinstance(base, dict):
            merged = dict(base)
            for k, v in sm_k.items():
                if k == "_meta" or not k:
                    continue
                if isinstance(v, dict):
                    merged[k] = v
            bundle["knacks"] = merged
    sm_pv = bundle.pop("purviewsDenizens", None)
    if isinstance(sm_pv, dict):
        base_p = bundle.get("purviews")
        if isinstance(base_p, dict):
            merged_p = dict(base_p)
            for k, v in sm_pv.items():
                if k == "_meta" or not k:
                    continue
                if isinstance(v, dict):
                    merged_p[k] = v
            bundle["purviews"] = merged_p
    sm_bo = bundle.pop("boonsSaintsMonsters", None)
    if isinstance(sm_bo, dict):
        base_b = bundle.get("boons")
        if isinstance(base_b, dict):
            merged_b = dict(base_b)
            for k, v in sm_bo.items():
                if k == "_meta" or not k:
                    continue
                if isinstance(v, dict):
                    merged_b[k] = v
            bundle["boons"] = merged_b
    tr_k = bundle.pop("knacksTitansRising", None)
    if isinstance(tr_k, dict):
        base_kn = bundle.get("knacks")
        if isinstance(base_kn, dict):
            merged_tr = dict(base_kn)
            for k, v in tr_k.items():
                if k == "_meta" or not k:
                    continue
                if isinstance(v, dict):
                    merged_tr[k] = v
            bundle["knacks"] = merged_tr
    titans_table = bundle.pop("titans", None)
    if isinstance(titans_table, dict):
        pant_table = bundle.get("pantheons")
        by = titans_table.get("titansByPantheon")
        if isinstance(pant_table, dict) and isinstance(by, dict):
            for pid, rows in by.items():
                if not isinstance(pid, str) or not isinstance(rows, list):
                    continue
                pant = pant_table.get(pid)
                if isinstance(pant, dict):
                    pant["titans"] = rows
    myth_inn = bundle.pop("mythosPurviewInnates", None)
    if isinstance(myth_inn, dict):
        base_p = bundle.get("purviews")
        if isinstance(base_p, dict):
            merged_p = dict(base_p)
            for k, v in myth_inn.items():
                if k == "_meta" or not k:
                    continue
                if not isinstance(v, dict):
                    continue
                inn = v.get("mythosAwarenessInnate")
                if not isinstance(inn, str) or not inn.strip():
                    continue
                cur = merged_p.get(k)
                if not isinstance(cur, dict):
                    continue
                next_pv = dict(cur)
                next_pv["mythosAwarenessInnate"] = inn.strip()
                merged_p[k] = next_pv
            bundle["purviews"] = merged_p
    std_inn = bundle.pop("purviewStandardInnates", None)
    if isinstance(std_inn, dict):
        base_p = bundle.get("purviews")
        if isinstance(base_p, dict):
            merged_p = dict(base_p)
            for k, v in std_inn.items():
                if k == "_meta" or not k:
                    continue
                if not isinstance(v, dict):
                    continue
                summ = v.get("purviewInnateSummary")
                if not isinstance(summ, str) or not summ.strip():
                    continue
                cur = merged_p.get(k)
                if not isinstance(cur, dict):
                    continue
                next_pv = dict(cur)
                next_pv["purviewInnateSummary"] = summ.strip()
                name = v.get("purviewInnateName")
                if isinstance(name, str) and name.strip():
                    next_pv["purviewInnateName"] = name.strip()
                merged_p[k] = next_pv
            bundle["purviews"] = merged_p
    meta_path = DATA_DIR / "meta.json"
    if meta_path.is_file():
        meta_full = _read_json(meta_path)
        if isinstance(meta_full, dict):
            cr = meta_full.get("canonicalRules")
            if isinstance(cr, dict):
                bundle["canonicalRules"] = cr
    return bundle


def save_table(name: str, data: dict[str, Any]) -> None:
    """Write a game data JSON table atomically. Caller must pass a full top-level object (e.g. include `_meta` for birthrights)."""
    if name not in allowed_names():
        raise KeyError(name)
    if not isinstance(data, dict):
        raise TypeError("payload must be a JSON object")
    path = DATA_DIR / f"{name}.json"
    if name in ("birthrights", "tags", "equipment"):
        meta = data.get("_meta")
        if not isinstance(meta, dict):
            raise ValueError(f"{name}.json must include an object `_meta`")
    tmp = path.with_suffix(path.suffix + ".tmp")
    try:
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        tmp.replace(path)
    except Exception:
        if tmp.exists():
            tmp.unlink(missing_ok=True)
        raise
