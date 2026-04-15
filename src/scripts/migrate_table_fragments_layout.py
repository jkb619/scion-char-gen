#!/usr/bin/env python3
"""
One-time (or idempotent) migration: split knacks, purviews, boons, callings into
``src/data/tables/<table>/<order>_<Book_Title>.json`` and remove legacy monolith files.

Run from repo root:
  python3 src/scripts/migrate_table_fragments_layout.py
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
DATA = SRC / "data"
TABLES = DATA / "tables"
BAK = DATA / "_migrated_backup"


def load_json_legacy(name: str) -> dict:
    """Reads ``data/<name>.json`` if present, else ``data/_migrated_backup/<name>`` (re-run after archive)."""
    p = DATA / name
    if p.is_file():
        return json.loads(p.read_text(encoding="utf-8"))
    alt = BAK / name
    if alt.is_file():
        return json.loads(alt.read_text(encoding="utf-8"))
    raise FileNotFoundError(f"Need {p} or {alt}")


def dump(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    # --- knacks ---
    kn = load_json_legacy("knacks.json")
    smk = load_json_legacy("knacksSaintsMonsters.json")
    trk = load_json_legacy("knacksTitansRising.json")
    dump(TABLES / "knacks" / "00_SCION_Pandoras_Box_and_Origin_Knacks.json", kn)
    dump(TABLES / "knacks" / "20_Scion_Players_Guide_Saints_Monsters.json", smk)
    dump(TABLES / "knacks" / "30_TItans_Rising_Titanic_Knacks.json", trk)

    # --- purviews ---
    pv = load_json_legacy("purviews.json")
    den = load_json_legacy("purviewsDenizens.json")
    myth = load_json_legacy("mythosPurviewInnates.json")
    inn = load_json_legacy("purviewStandardInnates.json")
    dump(TABLES / "purviews" / "00_SCION_Pandoras_Box_Revised.json", pv)
    dump(TABLES / "purviews" / "15_Scion_Players_Guide_Saints_Monsters_Denizens_and_Magic.json", den)
    dump(TABLES / "purviews" / "25_Scion_Masks_of_the_Mythos_Awareness_Innates.json", myth)
    dump(TABLES / "purviews" / "40_Standard_Purview_Innate_Blurbs.json", inn)

    # --- boons ---
    bo = load_json_legacy("boons.json")
    bsm = load_json_legacy("boonsSaintsMonsters.json")
    dump(TABLES / "boons" / "00_SCION_Pandoras_Box_Revised.json", bo)
    dump(TABLES / "boons" / "20_Scion_Players_Guide_Saints_Monsters.json", bsm)

    # --- callings ---
    ca = load_json_legacy("callings.json")
    core_ids = {
        "creator",
        "guardian",
        "healer",
        "hunter",
        "judge",
        "leader",
        "liminal",
        "lover",
        "sage",
        "trickster",
        "warrior",
    }
    core_meta = {
        "title": "Core Callings (Origin / Pandora’s Box)",
        "sourcePdf": "Scion_Origin_(Revised_Download).pdf; SCION_Pandoras_Box_(Revised_Download).pdf",
    }
    ext_meta = {
        "title": "Mythos & Titanic Callings (Masks of the Mythos / Saints & Monsters)",
        "sourcePdf": "Scion_Masks_of_the_Mythos_(Final_Download).pdf; Scion_Players_Guide__Saints__Monsters_(Final_Download).pdf",
    }
    core_out: dict = {"_meta": dict(core_meta)}
    ext_out: dict = {"_meta": dict(ext_meta)}
    if isinstance(ca.get("_meta"), dict):
        core_out["_meta"] = {**ca["_meta"], **core_meta}
    for k, v in ca.items():
        if k == "_meta":
            continue
        if not isinstance(v, dict):
            continue
        cid = str(v.get("id") or k)
        if cid in core_ids:
            core_out[k] = v
        else:
            ext_out[k] = v
    dump(TABLES / "callings" / "00_Scion_Origin_Core_Callings.json", core_out)
    dump(TABLES / "callings" / "40_Scion_Masks_Saints_Titanic_Callings.json", ext_out)

    # Remove legacy files (fragments are canonical)
    for rel in (
        "knacks.json",
        "knacksSaintsMonsters.json",
        "knacksTitansRising.json",
        "purviews.json",
        "purviewsDenizens.json",
        "mythosPurviewInnates.json",
        "purviewStandardInnates.json",
        "boons.json",
        "boonsSaintsMonsters.json",
        "callings.json",
    ):
        p = DATA / rel
        if p.is_file():
            bak = DATA / "_migrated_backup" / rel
            bak.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(p), str(bak))
            print("Archived", rel, "->", bak.relative_to(ROOT))

    print("Wrote table fragments under", TABLES.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
