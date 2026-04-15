from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.config import DATA_DIR
from app.services.data_tables import load_merged_table, table_fragment_dir


def _stamp_patron_asset_skills_from_pantheon(pantheons: dict[str, Any]) -> None:
    """Copy each pantheon's `assetSkills` onto every deity/titan that does not already list its own."""
    for pid, pant in pantheons.items():
        if not pid or pid.startswith("_") or not isinstance(pant, dict):
            continue
        bas = pant.get("assetSkills")
        if not isinstance(bas, list) or not bas:
            continue
        valid = [str(x).strip() for x in bas if isinstance(x, str) and str(x).strip()]
        if not valid:
            continue
        for row_key in ("deities", "titans"):
            rows = pant.get(row_key)
            if not isinstance(rows, list):
                continue
            for row in rows:
                if not isinstance(row, dict):
                    continue
                cur = row.get("assetSkills")
                if isinstance(cur, list) and len(cur) > 0:
                    continue
                row["assetSkills"] = list(valid)


def _apply_patron_asset_skill_overrides(pantheons: dict[str, Any], overrides_root: Any) -> None:
    """Apply `pantheonId:patronId` → [skill, …] from patronAssetSkillOverrides.json (1–3 skills)."""
    if not isinstance(overrides_root, dict):
        return
    table = overrides_root.get("overrides")
    if not isinstance(table, dict):
        return
    for key, skills in table.items():
        if not isinstance(key, str) or ":" not in key:
            continue
        pantheon_id, patron_id = key.split(":", 1)
        pantheon_id, patron_id = pantheon_id.strip(), patron_id.strip()
        if not pantheon_id or not patron_id:
            continue
        pant = pantheons.get(pantheon_id)
        if not isinstance(pant, dict):
            continue
        if not isinstance(skills, list):
            continue
        cleaned = [str(x).strip() for x in skills if isinstance(x, str) and str(x).strip()]
        if not cleaned or len(cleaned) > 3:
            continue
        for row_key in ("deities", "titans"):
            rows = pant.get(row_key)
            if not isinstance(rows, list):
                continue
            for row in rows:
                if isinstance(row, dict) and row.get("id") == patron_id:
                    row["assetSkills"] = list(cleaned)


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
    return load_merged_table(name)


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
    pant_table = bundle.get("pantheons")
    if isinstance(pant_table, dict):
        _stamp_patron_asset_skills_from_pantheon(pant_table)
        ov = bundle.pop("patronAssetSkillOverrides", None)
        _apply_patron_asset_skill_overrides(pant_table, ov)
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
    tags_dr = bundle.pop("tagsDragon", None)
    if isinstance(tags_dr, dict):
        base_tags = bundle.get("tags")
        if isinstance(base_tags, dict):
            merged_tags = dict(base_tags)
            for k, v in tags_dr.items():
                if k == "_meta" or not k:
                    continue
                if isinstance(v, dict):
                    merged_tags[k] = v
            bundle["tags"] = merged_tags
    equip_dr = bundle.pop("equipmentDragon", None)
    if isinstance(equip_dr, dict):
        base_eq = bundle.get("equipment")
        if isinstance(base_eq, dict):
            merged_eq = dict(base_eq)
            for k, v in equip_dr.items():
                if k == "_meta" or not k:
                    continue
                if isinstance(v, dict):
                    merged_eq[k] = v
            bundle["equipment"] = merged_eq
    br_dr = bundle.pop("birthrightsDragon", None)
    if isinstance(br_dr, dict):
        base_br = bundle.get("birthrights")
        if isinstance(base_br, dict):
            merged_br = dict(base_br)
            for k, v in br_dr.items():
                if k == "_meta" or not k:
                    continue
                if isinstance(v, dict):
                    merged_br[k] = v
            bundle["birthrights"] = merged_br
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
    if table_fragment_dir(name).is_dir() and any(table_fragment_dir(name).glob("*.json")):
        raise NotImplementedError(
            f"Table {name!r} is loaded from data/tables/{name}/*.json fragments; "
            f"use a file editor or extend save_table to write the appropriate fragment."
        )
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
