#!/usr/bin/env python3
"""Extract Boons from Pandora's Box (Revised) text into per-Purview JSON files."""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from app.services.data_tables import load_merged_table

TEXT_PATH = ROOT / "src" / "data" / "_extracted" / "pandoras_box.txt"
OUT_DIR = ROOT / "json" / "boons"
BOOK = "SCION_Pandoras_Box_(Revised_Download).pdf"

PAGE_MARKER_RE = re.compile(r"===== Page (\d+) / \d+ =====")
BOON_START_RE = re.compile(r"^([A-Z][A-Z0-9 '\u2019\-\.&,()/]+)\s*\n\s*Cost:", re.MULTILINE)
MECH_FIELD_RE = re.compile(
    r"^(Cost|Duration|Subject|Range|Action|Clash)\s*:\s*(.+)$", re.IGNORECASE | re.MULTILINE
)
SPECIFIC_RE = re.compile(r"^([A-Za-z][A-Za-z ]+?)\s+Specific:\s*(.+)$", re.MULTILINE)
PREREQ_RE = re.compile(r"^Prerequisite\s*:\s*(.+)$", re.IGNORECASE | re.MULTILINE)

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
    "TE TL: NEXTLAHUALLI": "teotl_nextlahualli",
    "THEOI: METAMORPHOSIS": "theoi_metamorphosis",
    "TUATHA D  DANANN: GEASA": "tuatha_geasa",
    "YAZATA: ASHA": "asha",
    "ZEM: BEHIQUE": "behique",
    "K'UH: TZOLK'IN": "tzolkin",
    "KAMI:  YAOYOROZU-NO-KAMIGAMI": "yaoyorozuNoKamigami",
    "BEARER SIGNATURE MAGIC: UPEND": "bearer_upend",
    "DRAQ SIGNATURE MAGIC: \nPANDEMONIUM": "draq_pandemonium",
    "JOKA SIGNATURE MAGIC: \nREFINEMENT": "joka_refinement",
    "LINDWURMS SIGNATURE \nMAGIC: AVARICE": "magic_avarice",
    "L NG SIGNATURE MAGIC: \nBLESSINGS": "long_blessings",
    "NAGA SIGNATURE MAGIC: \nTELEPORTATION": "naga_teleportation",
    "RETURNING SIGNATURE MAGIC: ORACULAR FURY": "oracular_fury",
    "SERPENT SIGNATURE \nMAGIC: PURIFICATION": "magic_purification",
}

# Dragon Magic sub-purviews (whitelist — avoids page-header false positives)
DRAGON_SECTIONS: list[tuple[str, str, str]] = [
    ("ANIMAL CONTROL", "dragon_animal_control", "Animal Control"),
    ("DECAY", "dragon_decay", "Decay"),
    ("ELEMENTAL MANIPULATION \n(AIR)", "dragon_elemental_air", "Elemental Manipulation (Air)"),
    ("ELEMENTAL MANIPULATION \n(EARTH)", "dragon_elemental_earth", "Elemental Manipulation (Earth)"),
    ("ELEMENTAL MANIPULATION \n(FIRE)", "dragon_elemental_fire", "Elemental Manipulation (Fire)"),
    ("ELEMENTAL MANIPULATION \n(FROST)", "dragon_elemental_frost", "Elemental Manipulation (Frost)"),
    ("ELEMENTAL MANIPULATION \n(WATER)", "dragon_elemental_water", "Elemental Manipulation (Water)"),
    ("FEAR", "dragon_fear", "Fear"),
    ("FLIGHT", "dragon_flight", "Flight"),
    ("ILLUSIONS", "dragon_illusions", "Illusions"),
    ("LUCK", "dragon_luck", "Luck"),
    ("TRANSFORMATION", "dragon_transformation", "Transformation"),
    ("UNDERSTANDING", "dragon_understanding", "Understanding"),
    ("WEATHER CONTROL", "dragon_weather_control", "Weather Control"),
]

SKIP_TITLE_RE = re.compile(
    r"^(BOONS|PURVIEWS|DRAGON MAGIC|STANDARD|PANTHEON|DENIZEN|LINDWURMS|MAGIC|RETURNING)$",
    re.I,
)


def normalize_text(t: str) -> str:
    return (
        t.replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u00ad", "")
    )


def norm_heading(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = s.replace("\u00ad", "").replace("–", "-")
    s = s.replace("\u2019", "'").replace("\u2018", "'")
    return " ".join(s.upper().split()).strip()


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


def parse_mechanical_fields(block: str) -> dict[str, str]:
    fields = {k: "" for k in ("cost", "duration", "subject", "range", "action", "clash")}
    for m in MECH_FIELD_RE.finditer(block):
        key = m.group(1).lower()
        fields[key] = re.sub(r"\s+", " ", m.group(2).strip())
    return fields


def extract_specific_features(block: str) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    matches = list(SPECIFIC_RE.finditer(block))
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(block)
        chunk = block[start:end]
        chunk = re.split(r"\n[A-Z][A-Z0-9 '\-]{4,}\s*\n\s*Cost:", chunk)[0]
        text = re.sub(r"\s+", " ", m.group(2).strip() + " " + chunk.strip()).strip()
        if len(text) > 320:
            text = text[:317].rsplit(" ", 1)[0] + "…"
        out.append({"calling": m.group(1).strip(), "feature": text})
    return out


def extract_description(block: str) -> str:
    last_end = 0
    for m in MECH_FIELD_RE.finditer(block):
        line_end = block.find("\n", m.end())
        last_end = max(last_end, line_end if line_end != -1 else m.end())
    body = block[last_end:].strip() if last_end else block.strip()
    cut = SPECIFIC_RE.search(body)
    if cut:
        body = body[: cut.start()].strip()
    body = re.sub(r"(\w)-\s+(\w)", r"\1\2", body)
    body = re.sub(r"\s+", " ", body).strip()
    return body[:417].rsplit(" ", 1)[0] + "…" if len(body) > 420 else body


def find_boon_block(section: str, title: str) -> str | None:
    for candidate in (norm_heading(title), title.upper()):
        m = re.search(rf"(?m)^\s*{re.escape(candidate)}\s*\n", section)
        if not m:
            continue
        tail = section[m.start() :]
        skip = min(len(tail), len(candidate) + 5)
        nxt = re.search(r"\n[A-Z][A-Z0-9 '\u2019\-\.&,()/]{4,80}\s*\n\s*Cost:", tail[skip:])
        end = skip + nxt.start() if nxt else min(len(tail), 5000)
        return tail[:end]
    return None


def discover_boon_titles(section: str) -> list[str]:
    titles: list[str] = []
    for m in BOON_START_RE.finditer(section):
        t = " ".join(m.group(1).split()).strip()
        if len(t) < 4 or len(t) > 72 or SKIP_TITLE_RE.match(t):
            continue
        titles.append(title_case_pb(t))
    return titles


def build_anchor_map(purviews: dict) -> dict[str, tuple[str, str]]:
    anchors: dict[str, tuple[str, str]] = {}
    for pid, row in purviews.items():
        if pid.startswith("_") or not isinstance(row, dict):
            continue
        name = str(row.get("name") or pid).strip()
        for cand in anchor_candidates(pid, name):
            anchors[cand] = (pid, name)
    for anchor, pid in EXTRA_PB_ANCHORS.items():
        row = purviews.get(pid, {})
        name = str(row.get("name") or title_case_pb(pid)) if isinstance(row, dict) else title_case_pb(pid)
        anchors[anchor] = (pid, name)
    return anchors


def find_anchor_pos(text: str, anchor: str, after: int = 0, *, subsection: bool = False) -> int:
    if "\n" in anchor:
        parts = anchor.split("\n")
        pattern = "".join(rf"^\s*{re.escape(p)}\s*$\n?" for p in parts)
        m = re.search(pattern, text[after:], re.MULTILINE)
        return after + m.start() if m else -1
    pattern = rf"^\s*{re.escape(anchor)}\s*$"
    for m in re.finditer(pattern, text[after:], re.MULTILINE):
        pos = after + m.start()
        if subsection:
            rest = text[m.end() : m.end() + 120].lstrip("\n")
            if re.match(r"Cost\s*:", rest, re.I):
                continue
        return pos
    return -1


def find_sections(text: str, anchors: dict[str, tuple[str, str]]) -> list[tuple[int, str, str]]:
    hits: list[tuple[int, str, str]] = []
    for anchor, (pid, name) in anchors.items():
        pos = find_anchor_pos(text, anchor)
        if pos >= 0:
            hits.append((pos, pid, name))
    hits.sort(key=lambda x: x[0])
    deduped: list[tuple[int, str, str]] = []
    seen: set[int] = set()
    for h in hits:
        if h[0] not in seen:
            seen.add(h[0])
            deduped.append(h)
    return deduped


def dragon_subsections(text: str) -> list[tuple[int, str, str]]:
    start = text.find("\nDRAGON MAGIC")
    if start < 0:
        return []
    ends = [text.find(m, start) for m in ("\nBEARER SIGNATURE MAGIC", "\nLINDWURMS SIGNATURE")]
    ends = [e for e in ends if e > start]
    end = min(ends) if ends else len(text)
    hits: list[tuple[int, str, str]] = []
    search_from = start
    for anchor, slug, label in DRAGON_SECTIONS:
        pos = find_anchor_pos(text, anchor, after=search_from, subsection=True)
        if pos < 0 or pos >= end:
            continue
        hits.append((pos, slug, label))
        search_from = pos + 1
    return hits


def tier_for_dot(dot: int) -> str:
    if dot <= 4:
        return "hero"
    if dot <= 8:
        return "demigod"
    return "god"


def parse_boon_entry(block: str, pid: str, pname: str, title: str, dot: int | None, page: int) -> dict | None:
    fields = parse_mechanical_fields(block)
    if not fields["cost"]:
        return None
    entry: dict = {
        "name": title_case_pb(title) if title.isupper() else title,
        "purviews": [pid],
        "purviewName": pname,
        "cost": fields["cost"],
        "duration": fields["duration"],
        "range": fields["range"],
        "subject": fields["subject"],
        "action": fields["action"],
        "clash": fields["clash"],
        "purviewSpecificFeatures": extract_specific_features(block),
        "source": {"book": BOOK, "page": page},
        "description": extract_description(block),
    }
    if dot is not None:
        entry["dot"] = dot
        entry["tier"] = tier_for_dot(dot)
    prereq = PREREQ_RE.search(block)
    if prereq:
        entry["prerequisite"] = prereq.group(1).strip()
    return entry


def extract_boons(text: str, purviews: dict) -> dict[str, list[dict]]:
    text = normalize_text(text)
    lines = text.splitlines()
    line_pages: list[int] = []
    page = 1
    for line in lines:
        m = PAGE_MARKER_RE.match(line.strip())
        if m:
            page = int(m.group(1))
        line_pages.append(page)

    boon_line = next((i for i, p in enumerate(line_pages) if p >= 205), 0)
    boon_text = "\n".join(lines[boon_line:])
    line_pages_boon = line_pages[boon_line:]

    def page_for_section_offset(offset: int) -> int:
        consumed = 0
        for i, line in enumerate(lines[boon_line:]):
            if consumed >= offset:
                return line_pages_boon[i] if i < len(line_pages_boon) else line_pages_boon[-1]
            consumed += len(line) + 1
        return line_pages_boon[-1] if line_pages_boon else 205

    anchors = build_anchor_map(purviews)
    sections = find_sections(boon_text, anchors) + dragon_subsections(boon_text)
    sections.sort(key=lambda x: x[0])

    by_purview: dict[str, list[dict]] = defaultdict(list)

    for i, (start, pid, pname) in enumerate(sections):
        end = sections[i + 1][0] if i + 1 < len(sections) else len(boon_text)
        section = boon_text[start:end]
        page = page_for_section_offset(start)
        row = purviews.get(pid, {})
        ladder = []
        if isinstance(row, dict):
            ladder = [str(x).strip() for x in (row.get("boonLadderNames") or []) if str(x).strip()]

        if ladder:
            for dot, title in enumerate(ladder, start=1):
                block = find_boon_block(section, title)
                if not block:
                    continue
                entry = parse_boon_entry(block, pid, pname, title, dot, page)
                if entry:
                    by_purview[pid].append(entry)
        else:
            for title in discover_boon_titles(section):
                block = find_boon_block(section, title)
                if not block:
                    continue
                entry = parse_boon_entry(block, pid, pname, title, None, page)
                if entry:
                    by_purview[pid].append(entry)

    return by_purview


def write_output(by_purview: dict[str, list[dict]]) -> dict[str, int]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.json"):
        old.unlink()
    counts: dict[str, int] = {}
    for pid, boons in sorted(by_purview.items()):
        seen: set[str] = set()
        unique: list[dict] = []
        for b in boons:
            k = b["name"].lower()
            if k in seen:
                continue
            seen.add(k)
            unique.append(b)
        if not unique:
            continue
        unique.sort(key=lambda x: (x.get("dot") or 99, x["name"]))
        (OUT_DIR / f"{pid}.json").write_text(
            json.dumps(
                {
                    "_meta": {
                        "purview": pid,
                        "purviewLabel": unique[0].get("purviewName", pid),
                        "sourceBook": BOOK,
                        "boonCount": len(unique),
                        "extractedOn": date.today().isoformat(),
                    },
                    "boons": unique,
                },
                indent=2,
                ensure_ascii=False,
            )
            + "\n",
            encoding="utf-8",
        )
        counts[pid] = len(unique)
    return counts


def main() -> int:
    if not TEXT_PATH.is_file():
        print(f"Missing extract: {TEXT_PATH}")
        return 1
    purviews = load_merged_table("purviews")
    counts = write_output(extract_boons(TEXT_PATH.read_text(encoding="utf-8"), purviews))
    total = sum(counts.values())
    print(f"Extracted {total} boons into {len(counts)} files under {OUT_DIR}")
    for pid, n in sorted(counts.items(), key=lambda x: (-x[1], x[0]))[:30]:
        print(f"  {pid}.json: {n}")
    if len(counts) > 30:
        print(f"  ... and {len(counts) - 30} more")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
