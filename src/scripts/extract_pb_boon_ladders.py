#!/usr/bin/env python3
"""
Read data/_extracted/pandoras_box.txt (from SCION_Pandoras_Box_(Revised_Download).pdf) and
emit boon ladder names per Purview for merging into data/purviews.json.

Run ingest first:
  python3 scripts/ingest_pandoras_box_pdf.py

Then:
  python3 scripts/extract_pb_boon_ladders.py --write-purviews
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))
from app.services.data_tables import primary_write_path

EXTRACT = SRC / "data" / "_extracted" / "pandoras_box.txt"
PURVIEWS_PATH = primary_write_path("purviews")

# PDF section headers that differ from purviews.json `name` (uppercase, single line).
ANCHOR_ALIASES: dict[str, tuple[str, ...]] = {
    "beasts": ("BEAST", "BEASTS"),
}

SKIP_PURVIEWS = frozenset({
    "_meta",
    "arcaneCalculus",
    "nemeton",
    "asha",
    "wyrd",
    "shuila",
    "pachakutic",
    "atuaMana",
    "paganito",
    "dvoeverie",
    "yoga",
    "marzeh",
    "tzolkin",
    "yaoyorozuNoKamigami",
    "dodaem",
    "heku",
    "tianming",
    "qut",
    "yidam",
    "behique",
})

# PDF uses curly apostrophes in some Boon titles (e.g. CAN'T STOP, WON'T STOP).
BOON_HEAD = re.compile(r"^([A-Z][A-Z0-9 '\-\.&,]+)\nCost:", re.MULTILINE)


def normalize_pdf_text(t: str) -> str:
    return t.replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"')


def anchor_candidates(pid: str, display_name: str) -> tuple[str, ...]:
    if pid in ANCHOR_ALIASES:
        return ANCHOR_ALIASES[pid]
    base = " ".join(display_name.upper().split())
    return (base,)


def find_section_start(text: str, anchor: str) -> int:
    needle = f"\n{anchor}\n"
    return text.find(needle)


def extract_boon_titles(block: str) -> list[str]:
    raw = BOON_HEAD.findall(block)
    out: list[str] = []
    for r in raw:
        t = " ".join(r.split()).strip()
        if not t or len(t) > 72:
            continue
        out.append(title_case_pb(t))
    return out


def title_case_pb(s: str) -> str:
    """Turn ALL-CAPS PB headings into readable chip titles (best-effort)."""
    parts: list[str] = []
    for w in s.split():
        wl = w.lower()
        if "'" in wl:
            bits = [b[:1].upper() + b[1:].lower() if b else "" for b in wl.split("'")]
            parts.append("'".join(bits))
        else:
            parts.append(wl[:1].upper() + wl[1:])
    small = {"Of", "The", "And", "To", "For", "In", "On", "At", "Or", "A", "An"}
    fixed: list[str] = []
    for i, p in enumerate(parts):
        if i > 0 and p in small:
            fixed.append(p.lower())
        else:
            fixed.append(p)
    return " ".join(fixed)


def pad12(names: list[str]) -> list[str]:
    out = names[:12]
    while len(out) < 12:
        out.append("")
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-purviews", action="store_true", help="Merge boonLadderNames into data/purviews.json")
    parser.add_argument("--dry-run", action="store_true", help="Print summary only")
    args = parser.parse_args()

    if not EXTRACT.is_file():
        print(f"Missing {EXTRACT}; run: python3 scripts/ingest_pandoras_box_pdf.py", file=sys.stderr)
        return 1

    text = normalize_pdf_text(EXTRACT.read_text(encoding="utf-8"))
    pur = json.loads(PURVIEWS_PATH.read_text(encoding="utf-8"))

    hits: list[tuple[int, str, str]] = []
    for pid, row in pur.items():
        if pid.startswith("_") or pid in SKIP_PURVIEWS:
            continue
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or pid).strip()
        pos = -1
        used_anchor = ""
        for cand in anchor_candidates(pid, name):
            p = find_section_start(text, cand)
            if p >= 0:
                pos = p
                used_anchor = cand
                break
        if pos < 0:
            continue
        hits.append((pos, pid, used_anchor))

    hits.sort(key=lambda x: x[0])
    ladders: dict[str, list[str]] = {}

    for i, (start, pid, anchor) in enumerate(hits):
        end = hits[i + 1][0] if i + 1 < len(hits) else len(text)
        block = text[start:end]
        titles = extract_boon_titles(block)
        if not titles:
            continue
        # Drop accidental echo of section header as first Boon title
        header_like = anchor.replace(" ", "")
        if titles and titles[0].replace(" ", "").upper() == header_like:
            titles = titles[1:]
        if not titles:
            continue
        ladders[pid] = pad12(titles)

    print(f"Extracted ladders for {len(ladders)} purviews from Pandora's Box text.")

    if args.dry_run or not args.write_purviews:
        for pid in sorted(ladders):
            nn = [x for x in ladders[pid] if x]
            print(f"  {pid}: {len(nn)} titles — {nn[:3]}{'…' if len(nn) > 3 else ''}")
        if not args.write_purviews:
            print("(Use --write-purviews to patch purviews.json)")
        return 0

    changed = 0
    for pid, names in ladders.items():
        if pid not in pur or not isinstance(pur[pid], dict):
            continue
        pur[pid]["boonLadderNames"] = names
        changed += 1

    PURVIEWS_PATH.write_text(json.dumps(pur, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote boonLadderNames for {changed} entries to {PURVIEWS_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
