#!/usr/bin/env python3
"""Extract Purview catalog rows from Pandora's Box (Revised) into src/data/purviews.json.

Reads ingested text from src/data/_extracted/pandoras_box.txt (run ingest_pandoras_box_pdf.py first).
Discovers Purview sections in the Boons chapter and emits boonLadderNames (padded to 12) per Purview.

Default output: src/data/purviews.json (app catalog format).
Optional --keep-supplements retains non-PB rows (e.g. magic) and innate blurbs from the existing file.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEXT_PATH = ROOT / "src" / "data" / "_extracted" / "pandoras_box.txt"
APP_OUT = ROOT / "src" / "data" / "purviews.json"
BOOK = "SCION_Pandoras_Box_(Revised_Download).pdf"

PAGE_MARKER_RE = re.compile(r"===== Page (\d+) / \d+ =====")
BOON_HEAD = re.compile(r"^([A-Z][A-Z0-9 '\-\.&,]+)\nCost:", re.MULTILINE)

ANCHOR_ALIASES: dict[str, tuple[str, ...]] = {"beasts": ("BEAST", "BEASTS")}

EXTRA_PB_ANCHORS: dict[str, str] = {
    "EARTH FRIEND": "denizenEarthFriend",
    "ILLUSIONS": "denizenIllusions",
    "LAIR": "denizenLair",
    "OBDURANCE": "denizenObdurance",
    "TRANSFORMATION": "denizenTransformation",
    "WATER FRIEND": "denizenWaterFriend",
    "WIND FRIEND": "denizenWindFriend",
    "SIR: WYRD": "wyrd",
    "ANUNNA: SHUIL": "shuila",
    "APU: PACHAKUTIC": "pachakutic",
    "ATUA: MANA": "atuaMana",
    "BALAHALA: PAGANITO": "paganito",
    "BOGOVI: DVOEVERIE": "dvoeverie",
    "DEV : Y G": "yoga",
    "ILHM: MARZEH": "marzeh",
    "MANITOU: DODAEM": "dodaem",
    "MYTHOS: ARCANE CALCULUS": "arcaneCalculus",
    "NEMETONDEVOS: NEMETON": "nemeton",
    "NETJER: HEKU": "heku",
    "P LAS: YIDAM": "yidam",
    "SH N: TIANMING": "tianming",
    "TENGRI: QUT": "qut",
    "YAZATA: ASHA": "asha",
    "ZEM: BEHIQUE": "behique",
    "K'UH: TZOLK'IN": "tzolkin",
    "KAMI:  YAOYOROZU-NO-KAMIGAMI": "yaoyorozuNoKamigami",
}

PB_PURVIEWS: dict[str, str] = {
    "arcaneCalculus": "Arcane Calculus",
    "artistry": "Artistry",
    "asha": "Asha",
    "atuaMana": "Mana",
    "beasts": "Beasts",
    "beauty": "Beauty",
    "behique": "Behique",
    "chaos": "Chaos",
    "darkness": "Darkness",
    "death": "Death",
    "deception": "Deception",
    "denizenEarthFriend": "Earth Friend",
    "denizenIllusions": "Illusions",
    "denizenLair": "Lair",
    "denizenObdurance": "Obdurance",
    "denizenTransformation": "Transformation",
    "denizenWaterFriend": "Water Friend",
    "denizenWindFriend": "Wind Friend",
    "dodaem": "Dodaem",
    "dvoeverie": "Dvoeverie",
    "earth": "Earth",
    "epicCharisma": "Epic Charisma",
    "epicDexterity": "Epic Dexterity",
    "epicPerception": "Epic Perception",
    "epicStamina": "Epic Stamina",
    "epicStrength": "Epic Strength",
    "fertility": "Fertility",
    "fire": "Fire",
    "forge": "Forge",
    "fortune": "Fortune",
    "frost": "Frost",
    "health": "Health",
    "heku": "Heku",
    "journeys": "Journeys",
    "marzeh": "Marzeh",
    "moon": "Moon",
    "nemeton": "Nemeton",
    "order": "Order",
    "pachakutic": "Pachakutic",
    "paganito": "Paganito",
    "passion": "Passion",
    "prosperity": "Prosperity",
    "qut": "Qut",
    "shuila": "Shuilá",
    "sky": "Sky",
    "stars": "Stars",
    "sun": "Sun",
    "tianming": "Tianming",
    "tzolkin": "Tzolk'in",
    "war": "War",
    "water": "Water",
    "wild": "Wild",
    "wyrd": "Wyrd",
    "yaoyorozuNoKamigami": "Yaoyorozu-no-Kamigami",
    "yidam": "Yidam",
    "yoga": "Yógá",
}

SUPPLEMENT_PURVIEW_IDS = frozenset({"magic"})
SUPPLEMENT_FIELDS = (
    "purviewInnateSummary",
    "purviewInnateName",
    "mythosAwarenessInnate",
    "denizenOrSorcery",
    "denizenPurview",
)


def normalize_text(t: str) -> str:
    return (
        t.replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u00ad", "")
    )


def anchor_candidates(pid: str, display_name: str) -> tuple[str, ...]:
    if pid in ANCHOR_ALIASES:
        return ANCHOR_ALIASES[pid]
    return (" ".join(display_name.upper().split()),)


def title_case_pb(s: str) -> str:
    parts: list[str] = []
    for w in s.split():
        wl = w.lower()
        if "'" in wl:
            bits = [b[:1].upper() + b[1:].lower() if b else "" for b in wl.split("'")]
            parts.append("'".join(bits))
        else:
            parts.append(wl[:1].upper() + wl[1:])
    small = {"Of", "The", "And", "To", "For", "In", "On", "At", "Or", "A", "An"}
    return " ".join(p.lower() if i > 0 and p in small else p for i, p in enumerate(parts))


def pad12(names: list[str]) -> list[str]:
    out = names[:12]
    while len(out) < 12:
        out.append("")
    return out


def build_anchor_map() -> dict[str, tuple[str, str]]:
    anchors: dict[str, tuple[str, str]] = {}
    for pid, name in PB_PURVIEWS.items():
        for cand in anchor_candidates(pid, name):
            anchors[cand] = (pid, name)
    for anchor, pid in EXTRA_PB_ANCHORS.items():
        anchors[anchor] = (pid, PB_PURVIEWS[pid])
    return anchors


def find_anchor_pos(text: str, anchor: str, after: int = 0) -> int:
    if "\n" in anchor:
        parts = anchor.split("\n")
        pattern = "".join(rf"^\s*{re.escape(p)}\s*$\n?" for p in parts)
        m = re.search(pattern, text[after:], re.MULTILINE)
        return after + m.start() if m else -1
    pattern = rf"^\s*{re.escape(anchor)}\s*$"
    for m in re.finditer(pattern, text[after:], re.MULTILINE):
        pos = after + m.start()
        rest = text[m.end() : m.end() + 120].lstrip("\n")
        if re.match(r"Cost\s*:", rest, re.I):
            continue
        return pos
    return -1


def find_sections(text: str, anchors: dict[str, tuple[str, str]]) -> list[tuple[int, str, str, str]]:
    hits: list[tuple[int, str, str, str]] = []
    for anchor, (pid, name) in anchors.items():
        pos = find_anchor_pos(text, anchor)
        if pos >= 0:
            hits.append((pos, pid, name, anchor))
    hits.sort(key=lambda x: x[0])
    deduped: list[tuple[int, str, str, str]] = []
    seen: set[int] = set()
    for h in hits:
        if h[0] not in seen:
            seen.add(h[0])
            deduped.append(h)
    return deduped


def extract_boon_titles(block: str, anchor: str) -> list[str]:
    raw = BOON_HEAD.findall(block)
    out: list[str] = []
    for r in raw:
        t = " ".join(r.split()).strip()
        if not t or len(t) > 72:
            continue
        out.append(title_case_pb(t))
    header_like = anchor.replace(" ", "")
    if out and out[0].replace(" ", "").upper() == header_like:
        out = out[1:]
    return out


def boon_chapter_text(text: str) -> str:
    lines = text.splitlines()
    boon_line = 0
    page = 1
    for i, line in enumerate(lines):
        m = PAGE_MARKER_RE.match(line.strip())
        if m:
            page = int(m.group(1))
        if page >= 205:
            boon_line = i
            break
    return "\n".join(lines[boon_line:])


def extract_ladders(text: str) -> dict[str, list[str]]:
    text = normalize_text(text)
    boon_text = boon_chapter_text(text)
    anchors = build_anchor_map()
    sections = find_sections(boon_text, anchors)
    ladders: dict[str, list[str]] = {}

    for i, (start, pid, _name, anchor) in enumerate(sections):
        end = sections[i + 1][0] if i + 1 < len(sections) else len(boon_text)
        block = boon_text[start:end]
        titles = extract_boon_titles(block, anchor)
        if titles:
            ladders[pid] = pad12(titles)
    return ladders


def purview_row(pid: str, name: str, ladder: list[str]) -> dict:
    row: dict = {
        "id": pid,
        "name": name,
        "description": f"Purview of {name}. Boons and Marvels per Pandora's Box (Revised).",
        "mechanicalEffects": "Standard Purview ladder (up to 12 Boons) per tier and Legend.",
        "source": BOOK,
        "boonLadderNames": ladder,
    }
    if pid.startswith("denizen"):
        row["denizenPurview"] = True
    if pid.startswith("epic"):
        row["description"] = f"Epic Attribute Purview: {name}. Boons per Pandora's Box (Revised)."
    return row


def merge_supplement_fields(row: dict, existing: dict) -> None:
    for field in SUPPLEMENT_FIELDS:
        if field in existing and field not in row:
            row[field] = existing[field]


def build_catalog(ladders: dict[str, list[str]], keep_supplements: bool) -> dict:
    catalog: dict = {}
    existing: dict = {}
    if keep_supplements and APP_OUT.is_file():
        existing = json.loads(APP_OUT.read_text(encoding="utf-8"))

    for pid, name in sorted(PB_PURVIEWS.items()):
        ladder = ladders.get(pid, pad12([]))
        row = purview_row(pid, name, ladder)
        if pid in existing:
            merge_supplement_fields(row, existing[pid])
        catalog[pid] = row

    if keep_supplements:
        for key, row in existing.items():
            if key.startswith("_") or key in catalog:
                continue
            if key in SUPPLEMENT_PURVIEW_IDS and isinstance(row, dict):
                catalog[key] = row

    pb_count = len(PB_PURVIEWS)
    supplement_count = len(catalog) - pb_count

    return {
        "_meta": {
            "note": (
                "Purview catalog parsed from Pandora's Box (Revised) Boons chapter "
                f"({pb_count} rows). boonLadderNames are extracted Boon titles (length 12)."
            ),
            "sourceBook": BOOK,
            "entryCount": len(catalog),
            "pbEntryCount": pb_count,
            "supplementEntryCount": supplement_count,
            "extractedOn": date.today().isoformat(),
            "regenerate": (
                "python3 src/scripts/ingest_pandoras_box_pdf.py && "
                "python3 src/scripts/extract_pb_purviews_to_json.py"
            ),
        },
        **catalog,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Extract PB Purviews into src/data/purviews.json")
    ap.add_argument(
        "--keep-supplements",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Retain magic and innate blurbs from existing purviews.json (default: true)",
    )
    ap.add_argument("--dry-run", action="store_true", help="Print summary only")
    args = ap.parse_args()

    if not TEXT_PATH.is_file():
        print(f"Missing extract: {TEXT_PATH}", file=sys.stderr)
        print("Run: python3 src/scripts/ingest_pandoras_box_pdf.py", file=sys.stderr)
        return 1

    ladders = extract_ladders(TEXT_PATH.read_text(encoding="utf-8"))
    with_ladder = sum(1 for v in ladders.values() if any(v))
    print(f"Extracted boon ladders for {with_ladder}/{len(PB_PURVIEWS)} purviews from PB text.")

    if args.dry_run:
        for pid in sorted(ladders):
            nn = [x for x in ladders[pid] if x]
            print(f"  {pid}: {len(nn)} titles")
        return 0

    catalog = build_catalog(ladders, keep_supplements=args.keep_supplements)
    APP_OUT.parent.mkdir(parents=True, exist_ok=True)
    APP_OUT.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    meta = catalog["_meta"]
    print(
        f"Wrote {meta['entryCount']} purview entries to {APP_OUT} "
        f"({meta['pbEntryCount']} from PB, {meta['supplementEntryCount']} supplements)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
