#!/usr/bin/env python3
"""Deduplicate knacks.json (PB primary), tag chargenLines, migrate draconic rows to dragonKnacks.json.

Rules:
- Group by normalized (name, callings key, tier). Keep PB row; drop tr_/sm_ supplements when PB matches.
- Drop PB *_2 ids when a non-_2 PB sibling exists in the same group.
- Tag every knack with `chargenLines` (deity | titan | sorcerer | draconic | denizen | any).
- Move draconic-only rows out of knacks.json into dragonKnacks.json (PB text wins over paraphrase stubs).
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KNACKS_PATH = ROOT / "src" / "data" / "knacks.json"
DRAGON_KNACKS_PATH = ROOT / "src" / "data" / "dragonKnacks.json"

PB_MARK = "Pandoras_Box"
SUPPLEMENT_PREFIXES = ("sm_", "tr_", "mythos_")

STANDARD_SCION_CALLINGS = frozenset(
    {
        "creator",
        "covenant",
        "guardian",
        "healer",
        "hunter",
        "judge",
        "leader",
        "liminal",
        "lover",
        "outsider",
        "psychopomp",
        "sage",
        "shepherd",
        "saint",
        "trickster",
        "warrior",
    }
)
TITAN_SCION_CALLINGS = frozenset(
    {
        "adversary",
        "destroyer",
        "monster",
        "primeval",
        "tyrant",
    }
)
DENIZEN_CALLINGS = frozenset(
    {
        "c_sith",
        "kitsune",
        "satyr",
        "therianthrope",
        "wolf_warrior",
        "tenebrian",
    }
)
# PB Dragon Knacks of Scale (p.92–93) — Heir / draconic, not Scion deity/titan picks.
DRAGON_FEATS_OF_SCALE_IDS = frozenset(
    {
        "collector_insatiable_collector",
        "destroyer_unstoppable_force",
        "guardian_vigilant_dragon",
        "healer_panacea_2",
        "judge_iron_fisted_rule",
        "mystic_eternal_genius",
        "nomad_nameless_and_faceless",
        "predator_relentless",
        "primeval_force_of_nature",
        "ruler_on_my_command",
        "watcher_sight_unseen",
    }
)

CAMEL_ID_RE = re.compile(r"^[a-z]+[A-Z]")
FEAT_OF_SCALE_RE = re.compile(r"allows you to perform .+ feats of scale", re.I)


def norm_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (name or "").lower())


def is_pb_source(source: str) -> bool:
    return PB_MARK in (source or "")


def callings_key(row: dict) -> frozenset[str]:
    if row.get("callingsAny") is True:
        return frozenset({"__any__"})
    calls = row.get("callings") or []
    if isinstance(calls, list) and calls:
        return frozenset(str(c) for c in calls)
    calling = row.get("calling")
    if isinstance(calling, str) and calling.strip():
        return frozenset({calling.strip()})
    return frozenset({"__none__"})


def page_from_source(source: str) -> int | None:
    m = re.search(r"p\.(\d+)", source or "")
    return int(m.group(1)) if m else None


def is_draconic_row(kid: str, row: dict) -> bool:
    if kid in DRAGON_FEATS_OF_SCALE_IDS:
        return True
    src = row.get("source") or ""
    page = page_from_source(src)
    blob = " ".join(
        str(row.get(k) or "")
        for k in ("description", "mechanicalEffects", "name")
    ).lower()
    if page in (92, 93) and FEAT_OF_SCALE_RE.search(blob):
        return True
    if page and 93 <= page <= 107 and "(General Knacks)" in src:
        return True
    if CAMEL_ID_RE.match(kid) and page and 93 <= page <= 107:
        return True
    if CAMEL_ID_RE.match(kid) and (
        "prerequisite: inheritance" in blob
        or "transformation:" in blob
        or "your draconic" in blob
        or "great form of the dragon" in blob
    ):
        return True
    return False


def infer_chargen_lines(kid: str, row: dict) -> list[str]:
    if is_draconic_row(kid, row):
        return ["draconic"]
    calls = callings_key(row)
    if row.get("callingsAny") is True or calls == frozenset({"__any__"}):
        if kid.startswith("mythos_") or row.get("pantheonAnyOf"):
            return ["deity"]
        if kid.startswith("tr_"):
            return ["titan"]
        return ["any"]
    if calls & DENIZEN_CALLINGS:
        return ["denizen"]
    page = page_from_source(row.get("source") or "")
    if page and 108 <= page <= 111:
        return ["denizen"]
    if kid.startswith("sm_") or kid.startswith("tr_"):
        return ["titan"]
    if calls & TITAN_SCION_CALLINGS:
        return ["titan"]
    if calls & STANDARD_SCION_CALLINGS:
        return ["deity"]
    if row.get("pantheonAnyOf"):
        return ["deity"]
    return ["any"]


def draconic_subkind(row: dict) -> str:
    blob = " ".join(
        str(row.get(k) or "")
        for k in ("description", "mechanicalEffects")
    ).lower()
    if FEAT_OF_SCALE_RE.search(blob) or "feat of scale" in blob:
        return "featOfScale"
    return "transformation"


def to_dragon_knack_entry(kid: str, row: dict) -> dict:
    out: dict = {
        "id": kid,
        "name": row.get("name") or kid,
        "kind": "draconic",
        "subkind": draconic_subkind(row),
        "description": row.get("description") or "",
        "mechanicalEffects": row.get("mechanicalEffects") or row.get("description") or "",
        "source": row.get("source") or "",
    }
    if row.get("tier"):
        out["tier"] = row["tier"]
    if row.get("callingSlotCost") is not None:
        out["callingSlotCost"] = row["callingSlotCost"]
    if row.get("callingsAny") is True:
        out["callingsAny"] = True
    elif row.get("callings"):
        out["callings"] = row["callings"]
    out["chargenLines"] = ["draconic"]
    return out


def dedupe_ids(rows: dict[str, dict]) -> tuple[dict[str, dict], list[str]]:
    tier_groups: dict[tuple, list[tuple[str, dict]]] = defaultdict(list)
    loose_groups: dict[tuple, list[tuple[str, dict]]] = defaultdict(list)
    for kid, row in rows.items():
        name_key = norm_name(row.get("name") or "")
        calls = callings_key(row)
        tier = str(row.get("tier") or "").lower()
        tier_groups[(name_key, calls, tier)].append((kid, row))
        loose_groups[(name_key, calls)].append((kid, row))

    remove: set[str] = set()

    for _key, items in tier_groups.items():
        if len(items) < 2:
            continue
        pb_primary = [
            (kid, row)
            for kid, row in items
            if is_pb_source(row.get("source") or "") and not kid.endswith("_2")
        ]
        if not pb_primary:
            continue
        keep_ids = {kid for kid, _ in pb_primary}
        for kid, row in items:
            if kid in keep_ids:
                continue
            src = row.get("source") or ""
            if kid.endswith("_2") and is_pb_source(src):
                remove.add(kid)
            elif not is_pb_source(src) and not kid.startswith(("tr_", "sm_", "mythos_")):
                remove.add(kid)

    for _key, items in loose_groups.items():
        pb_any = [
            (kid, row)
            for kid, row in items
            if is_pb_source(row.get("source") or "") and not kid.endswith("_2")
        ]
        if not pb_any:
            continue
        for kid, _row in items:
            if kid.startswith(("tr_", "sm_")):
                remove.add(kid)

    kept = {kid: row for kid, row in rows.items() if kid not in remove}
    return kept, sorted(remove)


def process(
    *,
    write: bool = True,
    report_path: Path | None = None,
) -> dict:
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    meta = knacks.pop("_meta", {})
    rows = {k: v for k, v in knacks.items() if isinstance(v, dict)}

    rows, removed_dupes = dedupe_ids(rows)

    dragon_existing = json.loads(DRAGON_KNACKS_PATH.read_text(encoding="utf-8"))
    dragon_meta = dragon_existing.pop("_meta", {})
    dragon_out: dict = dict(dragon_existing)
    migrated: list[str] = []
    draconic_removed: list[str] = []

    tagged: dict[str, dict] = {}
    for kid, row in rows.items():
        if is_draconic_row(kid, row):
            entry = to_dragon_knack_entry(kid, row)
            prev = dragon_out.get(kid)
            if prev and isinstance(prev, dict):
                entry["subkind"] = prev.get("subkind") or entry["subkind"]
            dragon_out[kid] = entry
            migrated.append(kid)
            draconic_removed.append(kid)
            continue
        tagged_row = dict(row)
        tagged_row["chargenLines"] = infer_chargen_lines(kid, tagged_row)
        tagged[kid] = tagged_row

    pb_count = sum(1 for r in tagged.values() if is_pb_source(r.get("source") or ""))
    supp_count = sum(
        1
        for kid in tagged
        if kid.startswith(SUPPLEMENT_PREFIXES)
    )

    meta.update(
        {
            "entryCount": len(tagged),
            "pbEntryCount": pb_count,
            "supplementEntryCount": supp_count,
            "deduplicatedOn": date.today().isoformat(),
            "eligibility": {
                **(meta.get("eligibility") or {}),
                "chargenLines": (
                    "Array of chargen line ids: any (deity+titan Scion), deity, titan, "
                    "sorcerer, draconic (Dragon Heir — lives in dragonKnacks.json), denizen (NPC). "
                    "Omit only on legacy rows; wizard filters by character line."
                ),
            },
            "regenerate": (
                "python3 src/scripts/ingest_pandoras_box_pdf.py && "
                "python3 src/scripts/extract_pb_knacks_to_json.py --keep-supplements && "
                "python3 src/scripts/deduplicate_and_tag_knacks.py"
            ),
        }
    )

    dragon_meta.update(
        {
            "note": (
                "Draconic Knacks (Feats of Scale / Transformation). PB full text merged from knacks.json; "
                "Flight-path paraphrases retained where no PB row existed."
            ),
            "entryCount": len(dragon_out),
            "mergedOn": date.today().isoformat(),
        }
    )

    report = {
        "removedDuplicates": removed_dupes,
        "migratedToDragonKnacks": migrated,
        "remainingKnackCount": len(tagged),
        "dragonKnackCount": len(dragon_out),
    }

    if write:
        out_knacks = {"_meta": meta, **tagged}
        KNACKS_PATH.write_text(json.dumps(out_knacks, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        out_dragon = {"_meta": dragon_meta, **dragon_out}
        DRAGON_KNACKS_PATH.write_text(
            json.dumps(out_dragon, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        if report_path:
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    return report


def main() -> None:
    ap = argparse.ArgumentParser(description="Deduplicate and tag knacks.json; migrate draconic rows.")
    ap.add_argument("--dry-run", action="store_true", help="Print report only; do not write files.")
    ap.add_argument(
        "--report",
        type=Path,
        default=ROOT / "json" / "knacks_dedup_report.json",
        help="Write JSON report path (default: json/knacks_dedup_report.json)",
    )
    args = ap.parse_args()
    report = process(write=not args.dry_run, report_path=None if args.dry_run else args.report)
    print(json.dumps(report, indent=2))
    if not args.dry_run:
        print(f"Wrote {KNACKS_PATH} and {DRAGON_KNACKS_PATH}")
        print(f"Report: {args.report}")


if __name__ == "__main__":
    main()
