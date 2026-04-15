#!/usr/bin/env python3
"""
Verify Purview display names, optional innate names, and Boon ladder titles against
local PDF text extracts. Verify Calling names against extracts (word-aware for
short labels).

  python3 src/scripts/verify_purviews_callings_against_extracts.py --books-dir ./books --ensure-extracts
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent
_SRC = _SCRIPTS.parent
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from app.services.data_tables import load_merged_table
from scion_pdf_text_match import (
    EXTRACTED,
    SRC,
    load_hay,
    matches,
    matches_smart,
    merge_hays,
    run_ingests,
)

MYTHOS_OR_TITANIC_CALLING_IDS = frozenset(
    {
        "adversary",
        "corruptor",
        "cosmos",
        "defiler",
        "destroyer",
        "monster",
        "primeval",
        "torturer",
        "tyrant",
    }
)
SAINTS_ONLY_CALLING_IDS = frozenset({"outsider", "shepherd"})


def _purview_source_candidates(
    source: str,
    core_n: str | None,
    core_ns: str | None,
    origin_n: str | None,
    origin_ns: str | None,
    hero_n: str | None,
    hero_ns: str | None,
    motw_n: str | None,
    motw_ns: str | None,
    motm_n: str | None,
    motm_ns: str | None,
    saints_n: str | None,
    saints_ns: str | None,
    dragon_n: str | None,
    dragon_ns: str | None,
) -> list[tuple[str, str, str]]:
    s = (source or "").lower()
    out: list[tuple[str, str, str]] = []
    seen_lab: set[str] = set()

    def push(n: str | None, ns: str | None, lab: str) -> None:
        if n and ns and lab not in seen_lab:
            seen_lab.add(lab)
            out.append((n, ns, lab))

    if "mysteries_of_the_world" in s:
        push(motw_n, motw_ns, "MotW")
    if "masks_of_the_mythos" in s:
        push(motm_n, motm_ns, "MotM")
    if "saints" in s or "saints__monsters" in s:
        push(saints_n, saints_ns, "Saints")
    if "scion_dragon" in s:
        push(dragon_n, dragon_ns, "Dragon")
    if "hero_(" in s or "scion_hero" in s.replace(" ", "").lower():
        push(hero_n, hero_ns, "Hero")
    if "pandora" in s or "pandoras_box" in s or "scion_pandoras" in s:
        push(core_n, core_ns, "PB+Origin")
    if "scion_origin" in s and "pandora" not in s and "pandoras" not in s:
        push(origin_n, origin_ns, "Origin")
    if not out and core_n and core_ns:
        push(core_n, core_ns, "PB+Origin")
    return out


def _missing_cited_extracts(
    source: str,
    hero_n: str | None,
    motw_n: str | None,
    motm_n: str | None,
    saints_n: str | None,
    dragon_n: str | None,
    core_n: str | None,
    origin_n: str | None,
) -> list[str]:
    s = (source or "").lower()
    miss: list[str] = []
    if "mysteries_of_the_world" in s and not motw_n:
        miss.append("MotW (ingest Mysteries_of_the_World… PDF)")
    if "masks_of_the_mythos" in s and not motm_n:
        miss.append("MotM (ingest Masks_of_the_Mythos… PDF)")
    if ("saints" in s or "saints__monsters" in s) and not saints_n:
        miss.append("Saints (ingest Saints__Monsters… PDF)")
    if "scion_dragon" in s and not dragon_n:
        miss.append("Dragon (ingest Scion_Dragon… PDF)")
    if ("hero_(" in s or "scion_hero" in s.replace(" ", "").lower()) and not hero_n:
        miss.append("Hero (ingest Scion_Hero… PDF)")
    if ("pandora" in s or "pandoras_box" in s or "scion_pandoras" in s) and not core_n:
        miss.append("PB/Origin extracts")
    if "scion_origin" in s and "pandora" not in s and "pandoras" not in s and not origin_n:
        miss.append("Origin extract")
    return miss


def _matches_any(
    cands: list[tuple[str, str, str]], text: str, *, smart: bool
) -> tuple[bool, str]:
    fn = matches_smart if smart else matches
    labs: list[str] = []
    for hn, hns, lab in cands:
        if fn(hn, hns, text):
            labs.append(lab)
    if labs:
        return True, "/".join(labs)
    return False, ""


def main() -> int:
    ap = argparse.ArgumentParser(description="Verify purview & calling names vs extracts")
    ap.add_argument("--books-dir", type=Path, default=None)
    ap.add_argument("--ensure-extracts", action="store_true")
    ap.add_argument("--warn-only", action="store_true")
    args = ap.parse_args()

    if args.ensure_extracts:
        run_ingests(args.books_dir)

    pb_n, pb_ns = load_hay(EXTRACTED / "pandoras_box.txt")
    origin_n, origin_ns = load_hay(EXTRACTED / "scion_origin_revised.txt")
    hero_n, hero_ns = load_hay(EXTRACTED / "scion_hero.txt")
    motw_n, motw_ns = load_hay(EXTRACTED / "mysteries_of_the_world.txt")
    motm_n, motm_ns = load_hay(EXTRACTED / "masks_of_the_mythos.txt")
    saints_n, saints_ns = load_hay(EXTRACTED / "saints_monsters.txt")
    dragon_n, dragon_ns = load_hay(EXTRACTED / "scion_dragon.txt")

    core_n, core_ns, _ = merge_hays([pb_n, origin_n], [pb_ns, origin_ns], "PB+Origin")
    motm_saints_n, motm_saints_ns, _ = merge_hays(
        [motm_n, saints_n], [motm_ns, saints_ns], "MotM+Saints"
    )

    all_bad: list[tuple[str, str, str, str]] = []

    # --- Callings ---
    call_raw = load_merged_table("callings")
    for cid, val in call_raw.items():
        if cid.startswith("_") or not isinstance(val, dict):
            continue
        name = (val.get("name") or "").strip()
        if not name:
            all_bad.append(("tables/callings", cid, name, "empty name"))
            continue
        if cid in SAINTS_ONLY_CALLING_IDS:
            h, hs, lab = saints_n, saints_ns, "Saints extract"
            if h is None or hs is None:
                all_bad.append(("tables/callings", cid, name, "missing Saints extract"))
                continue
            if not matches_smart(h, hs, name):
                all_bad.append(("tables/callings", cid, name, f"not in {lab}"))
        elif cid in MYTHOS_OR_TITANIC_CALLING_IDS:
            if motm_saints_n is None or motm_saints_ns is None:
                all_bad.append(("tables/callings", cid, name, "missing MotM/Saints extract"))
                continue
            if not matches_smart(motm_saints_n, motm_saints_ns, name):
                all_bad.append(
                    ("tables/callings", cid, name, "not in MotM+Saints extract"),
                )
        else:
            if core_n is None or core_ns is None:
                all_bad.append(("tables/callings", cid, name, "missing PB+Origin extract"))
                continue
            if not matches_smart(core_n, core_ns, name):
                all_bad.append(("tables/callings", cid, name, "not in PB+Origin extract"))

    # --- Purviews (merged from tables/purviews/*.json) ---
    pur_raw = load_merged_table("purviews")
    for pid, val in pur_raw.items():
        if pid.startswith("_") or not isinstance(val, dict):
            continue
        src = val.get("source") or ""
        miss = _missing_cited_extracts(
            src, hero_n, motw_n, motm_n, saints_n, dragon_n, core_n, origin_n
        )
        if miss:
            all_bad.append(
                (
                    "tables/purviews",
                    pid,
                    (val.get("name") or pid),
                    "missing " + "; ".join(miss),
                ),
            )
            continue

        cands = _purview_source_candidates(
            src,
            core_n,
            core_ns,
            origin_n,
            origin_ns,
            hero_n,
            hero_ns,
            motw_n,
            motw_ns,
            motm_n,
            motm_ns,
            saints_n,
            saints_ns,
            dragon_n,
            dragon_ns,
        )
        if not cands:
            all_bad.append(("tables/purviews", pid, (val.get("name") or pid), "no extract for source"))
            continue

        pname = (val.get("name") or "").strip()
        if pname:
            ok, _ = _matches_any(cands, pname, smart=True)
            if not ok:
                all_bad.append(
                    ("tables/purviews", pid, pname, f"Purview name not in ({src[:48]}…)"),
                )

        innate = (val.get("purviewInnateName") or "").strip()
        if innate:
            ok, _ = _matches_any(cands, innate, smart=False)
            if not ok:
                all_bad.append(
                    ("tables/purviews", pid, innate, "purviewInnateName not in cited extract(s)"),
                )

        ladder = val.get("boonLadderNames")
        if isinstance(ladder, list):
            for i, title in enumerate(ladder):
                if not isinstance(title, str) or not title.strip():
                    continue
                t = title.strip()
                ok, _ = _matches_any(cands, t, smart=False)
                if not ok:
                    all_bad.append(
                        (
                            "tables/purviews",
                            f"{pid} boonLadderNames[{i}]",
                            t,
                            "not in cited extract(s)",
                        ),
                    )

    if not all_bad:
        print("OK: all checked Purview / Calling strings matched their extracts.")
        return 0

    print(f"FAIL: {len(all_bad)} issue(s):\n")
    for rel, kid, name, reason in all_bad:
        print(f"  [{rel}] {kid}  “{name}”  — {reason}")
    return 0 if args.warn_only else 1


if __name__ == "__main__":
    raise SystemExit(main())
