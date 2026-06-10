#!/usr/bin/env python3
"""Extract Callings from Pandora's Box (Revised) into src/data/callings.json.

Reads ingested text from src/data/_extracted/pandoras_box.txt (run ingest_pandoras_box_pdf.py first).
Parses Calling intro blurbs from the Callings chapter (standard, Titanic, Denizen).

Default output: src/data/callings.json (app catalog format).
Optional --keep-supplements retains MotM inverted Callings from the existing file.
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
APP_OUT = ROOT / "src" / "data" / "callings.json"
BOOK = "SCION_Pandoras_Box_(Revised_Download).pdf"

PAGE_MARKER_RE = re.compile(r"===== Page (\d+) / \d+ =====")
TIER_RE = re.compile(r"^(HEROIC|IMMORTAL|MORTAL)\s+(.+)$")
CAPS_RE = re.compile(r"^[A-Z][A-Z0-9' \-:ÆÉÍÓÚ/'']+$")

CALLING_SLUGS: dict[str, str] = {
    "AUTOMACHY": "automachy",
    "ARCHITECT": "architect",
    "CREATOR": "creator",
    "COVENANT": "covenant",
    "DRUID": "druid",
    "GENERAL": "any",
    "GUARDIAN": "guardian",
    "HEALER": "healer",
    "HERALD": "herald",
    "HUNTER": "hunter",
    "JUDGE": "judge",
    "KNIGHT": "knight",
    "KNIGHTS": "knight",
    "LEADER": "leader",
    "LIMINAL": "liminal",
    "LOVER": "lover",
    "MIRACLEWORKER": "miracleworker",
    "ORACLE": "oracle",
    "OUTSIDER": "outsider",
    "PROPHETS": "prophets",
    "PSYCHOPOMP": "psychopomp",
    "SAGE": "sage",
    "SAINT": "saint",
    "SHEPHERD": "shepherd",
    "TRICKSTER": "trickster",
    "WARRIOR": "warrior",
    "ADVERSARY": "adversary",
    "DESTROYER": "destroyer",
    "MONSTER": "monster",
    "PRIMEVAL": "primeval",
    "TYRANT": "tyrant",
    "COLLECTOR": "collector",
    "RULER": "ruler",
    "MYSTIC": "mystic",
    "NOMAD": "nomad",
    "PREDATOR": "predator",
    "WATCHER": "watcher",
    "C  SITH": "c_sith",
    "CÚ SITH": "c_sith",
    "KITSUNE": "kitsune",
    "SATYR": "satyr",
    "THERIANTHROPE": "therianthrope",
    "WOLF-WARRIOR": "wolf_warrior",
}

CALLING_DISPLAY: dict[str, str] = {
    "automachy": "Automachy",
    "miracleworker": "Miracle Worker",
    "psychopomp": "Psychopomp",
    "c_sith": "Cú Sith",
    "wolf_warrior": "Wolf-Warrior",
}

CALLING_REGIONS = [
    (20, 69),
    (70, 101),
    (108, 111),
]

SKIP_LINE_RE = re.compile(
    r"^(CALLINGSCALLINGS|DRACONIC DRACONIC|TITANIC\s+TITANIC|"
    r"DENIZEN KNACKSDENIZEN KNACKS|MYTHIC SHARDSMYTHIC SHARDS|"
    r"TABLE OF CONTENTS|INTRODUCTION|CREDITS|BIRTHRIGHTSBIRTHRIGHTS|"
    r"P ANDORA|Callings|TiTaniC Callings|DraConiC Callings|"
    r"myThiC sharDs|Denizen KnaCKs|birThrighTs|Purviews:|"
    r"Flight Specific:|System:|Special:|Transformation:|CYBER-SCION).*$",
    re.I,
)
NOISE_RE = re.compile(r"^\d{1,3}$")

SUPPLEMENT_CALLING_IDS = frozenset({"corruptor", "cosmos", "defiler", "torturer"})
DENIZEN_CALLING_PAGE_MIN = 108
DESC_MAX = 420
MECH_MAX = 1500


def display_name(slug: str) -> str:
    return CALLING_DISPLAY.get(slug, slug.replace("_", " ").title())


def brief_description(text: str, max_len: int = DESC_MAX) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= max_len:
        return text
    cut = text[:max_len].rsplit(" ", 1)[0]
    return cut + "…"


def is_calling_header(line: str) -> str | None:
    upper = line.strip().upper()
    if upper in CALLING_SLUGS:
        slug = CALLING_SLUGS[upper]
        return None if slug == "any" else slug
    return None


def is_tier_header(line: str) -> bool:
    return bool(TIER_RE.match(line.strip()))


def should_skip_line(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    if PAGE_MARKER_RE.match(s):
        return True
    if SKIP_LINE_RE.match(s):
        return True
    if NOISE_RE.match(s):
        return True
    if len(s) <= 2 and s.isalpha():
        return True
    return False


def is_knack_heading(line: str) -> bool:
    s = line.strip()
    if not CAPS_RE.match(s) or len(s) < 4:
        return False
    if is_calling_header(s):
        return False
    if is_tier_header(s):
        return False
    return True


def join_intro_lines(lines: list[str]) -> str:
    text = ""
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if not text:
            text = line
            continue
        if len(text) == 1 and text.isupper() and line[0].islower():
            text = text + line
        elif text.endswith("-"):
            text = text.rstrip("- ") + line
        elif text[-1].isalnum() and line[0].islower():
            text = text + " " + line
        else:
            text += " " + line
    text = re.sub(r"(\w)-\s+(\w)", r"\1\2", text)
    return re.sub(r"\s+", " ", text).strip()


def in_calling_region(page: int) -> bool:
    return any(start <= page <= end for start, end in CALLING_REGIONS)


def parse_callings(text: str) -> dict[str, dict]:
    lines = text.splitlines()
    page_at: list[int] = [1] * len(lines)
    page = 1
    for i, line in enumerate(lines):
        m = PAGE_MARKER_RE.match(line.strip())
        if m:
            page = int(m.group(1))
        page_at[i] = page

    found: dict[str, dict] = {}
    current_slug: str | None = None
    intro_lines: list[str] = []
    collecting = False
    current_page = 20

    def flush() -> None:
        nonlocal current_slug, intro_lines, collecting
        if not current_slug:
            return
        intro = join_intro_lines(intro_lines)
        if current_slug not in found:
            found[current_slug] = {"page": current_page, "intro": intro}
        elif intro and len(intro) > len(found[current_slug].get("intro", "")):
            found[current_slug] = {"page": min(found[current_slug]["page"], current_page), "intro": intro}
        current_slug = None
        intro_lines = []
        collecting = False

    for idx, raw in enumerate(lines):
        if not in_calling_region(page_at[idx]):
            continue

        line = raw.strip()
        if PAGE_MARKER_RE.match(line):
            current_page = int(PAGE_MARKER_RE.match(line).group(1))
            continue
        if should_skip_line(line):
            if not (collecting and current_slug and len(line) <= 2 and line.isalpha()):
                continue

        slug = is_calling_header(line)
        if slug:
            flush()
            current_slug = slug
            collecting = True
            current_page = page_at[idx]
            continue

        if not current_slug or not collecting:
            continue

        if is_tier_header(line) or is_knack_heading(line):
            collecting = False
            continue

        intro_lines.append(raw)

    flush()
    return found


def calling_row(slug: str, parsed: dict) -> dict:
    intro = parsed.get("intro", "")
    page = parsed.get("page", 20)
    name = display_name(slug)
    description = brief_description(intro) if intro else f"Calling of the {name}."
    mech = intro if len(intro) <= MECH_MAX else intro[: MECH_MAX - 1].rsplit(" ", 1)[0] + "…"
    if not mech:
        mech = (
            "Knack lists by tier in Pandora's Box (Revised) Calling chapter; "
            "confirm tier limits at the table."
        )
    row = {
        "id": slug,
        "name": name,
        "description": description,
        "mechanicalEffects": mech,
        "source": f"{BOOK} p.{page}",
    }
    if page >= DENIZEN_CALLING_PAGE_MIN:
        row["denizenCalling"] = True
    return row


def build_catalog(parsed: dict[str, dict], keep_supplements: bool) -> dict:
    catalog: dict = {}
    existing: dict = {}
    if keep_supplements and APP_OUT.is_file():
        existing = json.loads(APP_OUT.read_text(encoding="utf-8"))

    for slug in sorted(parsed):
        catalog[slug] = calling_row(slug, parsed[slug])

    if keep_supplements:
        for key, row in existing.items():
            if key.startswith("_") or key in catalog:
                continue
            if key in SUPPLEMENT_CALLING_IDS and isinstance(row, dict):
                catalog[key] = row

    pb_count = len(parsed)
    supplement_count = len(catalog) - pb_count
    denizen_ids = sorted(slug for slug, row in catalog.items() if row.get("denizenCalling"))

    meta_extra: dict = {}
    if keep_supplements and isinstance(existing.get("_meta"), dict):
        for key in ("motmInvertedPairs", "motmUnpairedCallings", "motmKnackAccess"):
            if key in existing["_meta"]:
                meta_extra[key] = existing["_meta"][key]

    return {
        "_meta": {
            "note": (
                "Callings parsed from Pandora's Box (Revised) Callings chapter "
                f"({pb_count} rows). Intro blurbs precede tier Knack lists in the PDF."
            ),
            **meta_extra,
            "denizenCallingIds": denizen_ids,
            "denizenCallingNote": (
                "PB Denizen Knack chapters — companion types, not player Calling picks."
            ),
            "sourceBook": BOOK,
            "entryCount": len(catalog),
            "pbEntryCount": pb_count,
            "supplementEntryCount": supplement_count,
            "extractedOn": date.today().isoformat(),
            "regenerate": (
                "python3 src/scripts/ingest_pandoras_box_pdf.py && "
                "python3 src/scripts/extract_pb_callings_to_json.py"
            ),
        },
        **catalog,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Extract PB Callings into src/data/callings.json")
    ap.add_argument(
        "--keep-supplements",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Retain MotM inverted Callings from existing callings.json (default: true)",
    )
    ap.add_argument("--dry-run", action="store_true", help="Print summary only")
    args = ap.parse_args()

    if not TEXT_PATH.is_file():
        print(f"Missing extract: {TEXT_PATH}", file=sys.stderr)
        print("Run: python3 src/scripts/ingest_pandoras_box_pdf.py", file=sys.stderr)
        return 1

    parsed = parse_callings(TEXT_PATH.read_text(encoding="utf-8"))
    print(f"Parsed {len(parsed)} Calling intros from PB text.")

    if args.dry_run:
        for slug in sorted(parsed):
            intro = parsed[slug]["intro"]
            print(f"  {slug} p.{parsed[slug]['page']}: {intro[:80]}{'…' if len(intro) > 80 else ''}")
        return 0

    catalog = build_catalog(parsed, keep_supplements=args.keep_supplements)
    APP_OUT.parent.mkdir(parents=True, exist_ok=True)
    APP_OUT.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    meta = catalog["_meta"]
    print(
        f"Wrote {meta['entryCount']} calling entries to {APP_OUT} "
        f"({meta['pbEntryCount']} from PB, {meta['supplementEntryCount']} supplements)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
