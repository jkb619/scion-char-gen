#!/usr/bin/env python3
"""
Check that Knack display names appear in local book text extracts (substring match
after normalizing whitespace and punctuation). Use after ingesting PDFs under books/.

  python3 src/scripts/verify_knacks_against_extracts.py --books-dir ./books --ensure-extracts

Exit 1 if any knack is missing from its expected extract(s), unless --warn-only.
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
    merge_hays,
    run_ingests,
    verify_file_by_name_field,
)


def main() -> int:
    ap = argparse.ArgumentParser(description="Verify knack names against _extracted/*.txt")
    ap.add_argument("--books-dir", type=Path, default=None, help="PDF folder (passed to ingest scripts)")
    ap.add_argument(
        "--ensure-extracts",
        action="store_true",
        help="Run ingest scripts first so extracts exist",
    )
    ap.add_argument(
        "--warn-only",
        action="store_true",
        help="Always exit 0; still print missing names",
    )
    args = ap.parse_args()

    if args.ensure_extracts:
        run_ingests(args.books_dir)

    pb_n, pb_ns = load_hay(EXTRACTED / "pandoras_box.txt")
    origin_n, origin_ns = load_hay(EXTRACTED / "scion_origin_revised.txt")
    motm_n, motm_ns = load_hay(EXTRACTED / "masks_of_the_mythos.txt")
    saints_n, saints_ns = load_hay(EXTRACTED / "saints_monsters.txt")
    titans_n, titans_ns = load_hay(EXTRACTED / "titans_rising.txt")
    dragon_n, dragon_ns = load_hay(EXTRACTED / "scion_dragon.txt")

    core_n, core_ns, _ = merge_hays([pb_n, origin_n], [pb_ns, origin_ns], "PB+Origin")
    core_label = "+".join(
        x
        for x, h in (
            ("PB", pb_n),
            ("Origin", origin_n),
        )
        if h
    ) or "(no core extracts)"

    all_bad: list[tuple[str, str, str, str]] = []

    kn = load_merged_table("knacks")
    if core_n is None and motm_n is None:
        print("SKIP knacks: need pandoras_box.txt and/or scion_origin_revised.txt (and MotM for mythos)")
    else:
        for kid, val in kn.items():
            if kid.startswith("_") or not isinstance(val, dict):
                continue
            name = (val.get("name") or "").strip()
            if not name:
                all_bad.append(("tables/knacks", kid, name, "empty name"))
                continue
            src = (val.get("source") or "").lower()
            if "community rules mirror" in src:
                continue
            if kid.startswith("mythos_"):
                h, hns, lab = motm_n, motm_ns, "MotM extract"
                if h is None or hns is None:
                    all_bad.append(("tables/knacks", kid, name, "no MotM extract"))
                    continue
                if not matches(h, hns, name):
                    all_bad.append(("tables/knacks", kid, name, f"not in {lab}"))
            elif kid.startswith("sm_"):
                h, hns, lab = saints_n, saints_ns, "Saints & Monsters extract"
                if h is None or hns is None:
                    all_bad.append(("tables/knacks", kid, name, "no Saints extract"))
                    continue
                if not matches(h, hns, name):
                    all_bad.append(("tables/knacks", kid, name, f"not in {lab}"))
            elif kid.startswith("tr_"):
                h, hns, lab = titans_n, titans_ns, "Titans Rising extract"
                if h is None or hns is None:
                    all_bad.append(("tables/knacks", kid, name, "no Titans Rising extract"))
                    continue
                if not matches(h, hns, name):
                    all_bad.append(("tables/knacks", kid, name, f"not in {lab}"))
            else:
                if core_n is None or core_ns is None:
                    all_bad.append(("tables/knacks", kid, name, f"no {core_label}"))
                    continue
                if not matches(core_n, core_ns, name):
                    all_bad.append(("tables/knacks", kid, name, f"not in {core_label}"))

    for rel, hay_n, hay_ns, lab in (
        ("data/dragonKnacks.json", dragon_n, dragon_ns, "Dragon extract"),
        ("data/dragonCallingKnacks.json", dragon_n, dragon_ns, "Dragon extract"),
    ):
        p = SRC / rel
        for kid, name, reason in verify_file_by_name_field(rel, p, hay_n, hay_ns, lab, use_smart=False):
            all_bad.append((rel, kid, name, reason))

    if not all_bad:
        print("OK: all checked knack names matched their extracts.")
        return 0

    print(f"FAIL: {len(all_bad)} knack(s) not found in expected extract(s):\n")
    for rel, kid, name, reason in all_bad:
        print(f"  [{rel}] {kid}  “{name}”  — {reason}")
    return 0 if args.warn_only else 1


if __name__ == "__main__":
    raise SystemExit(main())
