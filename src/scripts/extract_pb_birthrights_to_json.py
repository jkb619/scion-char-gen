#!/usr/bin/env python3
"""Extract Birthrights from Pandora's Box (Revised) text into per-type JSON files."""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEXT_PATH = ROOT / "src" / "data" / "_extracted" / "pandoras_box.txt"
OUT_DIR = ROOT / "json" / "birthrights"
BOOK = "SCION_Pandoras_Box_(Revised_Download).pdf"

PAGE_MARKER_RE = re.compile(r"===== Page (\d+) / \d+ =====")
DOT_CHARS = "•●◆⬥"
DOT_HEADING_RE = re.compile(
    rf"(?:^|\n)([^\n(]+?)\s*\(([{DOT_CHARS}]+)\)",
    re.M,
)
NAME_ONLY_RE = re.compile(r"(?:^|\n)([A-Z][^\n]+?)\s*(?:\n|$)", re.M)

PAGE_JUNK_RE = re.compile(
    r"===== Page \d+ / \d+ =====|P ANDORA 'S BOX|^\s*birThrighTs\s*$|^\s*\d{1,3}\s*$",
    re.I | re.M,
)

SECTION_ORDER: list[tuple[str, str, str]] = [
    ("CREATURES", "creatures", "Creatures"),
    ("CREEDS", "creeds", "Creeds"),
    ("COMPANIONS", "companions", "Companions"),
    ("COVENANT", "covenant", "Covenant"),
    ("CULTS", "cults", "Cults"),
    ("FOLLOWERS", "followers", "Followers"),
    ("GUIDES", "guides", "Guides"),
    ("PAWNS", "pawns", "Pawns"),
    ("REALMS", "realms", "Realms"),
    ("RELICS", "relics", "Relics"),
    ("SANCTUM", "sanctum", "Sanctum"),
]

SKIP_HEADING = {
    "CREATURES",
    "CREEDS",
    "COMPANIONS",
    "COVENANT",
    "CULTS",
    "FOLLOWERS",
    "GUIDES",
    "PAWNS",
    "REALMS",
    "RELICS",
    "SANCTUM",
    "BIRTHRIGHTSBIRTHRIGHTS",
    "BIRTHRIGHTS",
    "MYTHIC",
    "FOLLOWER ORGANIZATIONS",
    "THE COURT OF STARS",
    "P ANDORA 'S BOX",
    "P ANDORA'S BOX",
    "TABLE OF CONTENTS",
}

STRUCT_FIELD_NAMES = (
    r"Tier|Drive|Primary Pool|Secondary Pool|Qualities?|Flairs?|"
    r"Defense|Health|Initiative|Enhancement|Archetype|Role|Tags?|Knacks?|Flaws?|"
    r"Purviews?|Motif|Sacred Symbol|Cult Rating|Foundation|Light|Shadow|"
    r"Cult Skills?|Contacts?|Followers?|Tenets?|Rites?|Brands?|Images?|"
    r"Asset Skills?|Guide Stunt|Calling|Marvel|Special|Requirement|"
    r"Physical Location|Touchstone|Other Worldly|Axis Mundi|Midrealm|Access"
)
STRUCT_START_RE = re.compile(rf"(?:^|\s)(?:{STRUCT_FIELD_NAMES})\s*:", re.I)

def normalize_fields(block: str) -> str:
    block = clean_block(block)
    return re.sub(rf"\s+({STRUCT_FIELD_NAMES})\s*:", r"\n\1:", block, flags=re.I)


FIELD_RES: list[tuple[str, re.Pattern[str]]] = [
    ("tier", re.compile(r"^Tier:\s*(.+)$", re.I | re.M)),
    ("drive", re.compile(r"^Drive:\s*(.+)$", re.I | re.M)),
    ("primaryPool", re.compile(r"^Primary Pool[^:]*:\s*(.+)$", re.I | re.M)),
    ("secondaryPool", re.compile(r"^Secondary Pool[^:]*:\s*(.+)$", re.I | re.M)),
    ("qualities", re.compile(r"^Qualities?:\s*(.+)$", re.I | re.M)),
    ("flairs", re.compile(r"^Flairs?:\s*(.+)$", re.I | re.M)),
    ("defense", re.compile(r"^Defense:\s*(.+)$", re.I | re.M)),
    ("health", re.compile(r"^Health:\s*(.+)$", re.I | re.M)),
    ("initiative", re.compile(r"^Initiative:\s*(.+)$", re.I | re.M)),
    ("enhancement", re.compile(r"^Enhancement:\s*(.+)$", re.I | re.M)),
    ("archetype", re.compile(r"^Archetype:\s*(.+)$", re.I | re.M)),
    ("role", re.compile(r"^Role:\s*(.+)$", re.I | re.M)),
    ("tags", re.compile(r"^Tags?:\s*(.+)$", re.I | re.M)),
    ("purviews", re.compile(r"^Purviews?:\s*(.+)$", re.I | re.M)),
    ("motif", re.compile(r"^Motif:\s*(.+)$", re.I | re.M)),
    ("sacredSymbol", re.compile(r"^Sacred Symbol:\s*(.+)$", re.I | re.M)),
    ("cultRating", re.compile(r"^Cult Rating:\s*(.+)$", re.I | re.M)),
    ("foundation", re.compile(r"^Foundation:\s*(.+)$", re.I | re.M)),
    ("light", re.compile(r"^Light:\s*(.+)$", re.I | re.M)),
    ("shadow", re.compile(r"^Shadow:\s*(.+)$", re.I | re.M)),
    ("cultSkills", re.compile(r"^Cult Skills?:\s*(.+)$", re.I | re.M)),
    ("tenets", re.compile(r"^Tenets?:\s*(.+)$", re.I | re.M)),
    ("rites", re.compile(r"^Rites?:\s*(.+)$", re.I | re.M)),
    ("brands", re.compile(r"^Brands?:\s*(.+)$", re.I | re.M)),
    ("images", re.compile(r"^Images?:\s*(.+)$", re.I | re.M)),
    ("assetSkills", re.compile(r"^Asset Skills?:\s*(.+)$", re.I | re.M)),
    ("guideStunt", re.compile(r"^Guide Stunt[^:]*:\s*(.+)$", re.I | re.M)),
    ("calling", re.compile(r"^Calling:\s*(.+)$", re.I | re.M)),
    ("marvel", re.compile(r"^Marvel:\s*(.+)$", re.I | re.M)),
    ("special", re.compile(r"^Special:\s*(.+)$", re.I | re.M)),
    ("requirement", re.compile(r"^Requirement:\s*(.+)$", re.I | re.M)),
    ("physicalLocation", re.compile(r"^Physical Location:\s*(.+)$", re.I | re.M)),
    ("touchstone", re.compile(r"^Touchstone:\s*(.+)$", re.I | re.M)),
    ("otherWorldlyLocations", re.compile(r"^Other Worldly Locations?:\s*(.+)$", re.I | re.M)),
    ("axisMundiConnection", re.compile(r"^Axis Mundi Connection[^:]*:\s*(.+)$", re.I | re.M)),
    ("midrealm", re.compile(r"^Midrealm[^:]*:\s*(.+)$", re.I | re.M)),
    ("access", re.compile(r"^Access[^:]*:\s*(.+)$", re.I | re.M)),
]

MULTI_FIELD_KEYS = {"knacks", "flaws", "contacts", "followers"}


def normalize_text(t: str) -> str:
    return (
        t.replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u00ad", "")
    )


def count_dots(s: str) -> int:
    return sum(s.count(c) for c in DOT_CHARS)


def join_wrapped_headings(text: str) -> str:
    """Join rare PDF line-breaks inside a single birthright title (e.g. Superintendent of December Lake)."""
    lines = text.splitlines()
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if i + 1 < len(lines):
            nxt = lines[i + 1].strip()
            if (
                re.fullmatch(r"[A-Z0-9'\"][A-Z0-9'\u2019\-.,/&() ]*", line)
                and ":" not in line
                and not re.search(rf"\([{DOT_CHARS}]+\)", line)
                and re.search(rf"\([{DOT_CHARS}]+\)", nxt)
            ):
                out.append(re.sub(r"\s+", " ", f"{line} {nxt}"))
                i += 2
                continue
        out.append(line)
        i += 1
    return "\n".join(out)


def is_noise_heading(name: str) -> bool:
    n = re.sub(r"\s+", " ", name).strip().upper()
    if not n or len(n) < 2 or n in SKIP_HEADING:
        return True
    if re.fullmatch(r"\d{1,3}", n):
        return True
    if n.startswith("P ANDORA"):
        return True
    if n.startswith("BIRTHRIGHT"):
        return True
    if re.search(rf"\([{DOT_CHARS}]+\)", name):
        return True
    if ":" in n and not re.match(r"^RE:\s", n):
        return True
    # Drop lines that look like sentence fragments, not titles.
    if re.search(r"[a-z]", name) and not re.search(r"\d", name):
        return True
    if re.search(r"\b(THE|AND|OR|OF|IN|TO|FOR|WITH|FROM|THAT|WHOSE)\b", n) and len(n.split()) > 6:
        return True
    return False


def clean_block(block: str) -> str:
    return PAGE_JUNK_RE.sub("\n", block)


def build_page_index(text: str) -> tuple[list[str], list[int]]:
    lines = text.splitlines()
    pages: list[int] = []
    page = 1
    for line in lines:
        m = PAGE_MARKER_RE.match(line.strip())
        if m:
            page = int(m.group(1))
        pages.append(page)
    return lines, pages


def slice_birthrights(text: str) -> tuple[str, int]:
    start = text.find("BIRTHRIGHTSBIRTHRIGHTS")
    if start < 0:
        start = text.find("CREATURES \n")
    end = text.find("BOONSBOONS")
    if end < 0:
        end = text.find("\nBOONS\n")
    if start < 0 or end < 0 or end <= start:
        raise RuntimeError("Could not locate Birthrights chapter boundaries")
    return text[start:end], start


def find_section_spans(chapter: str) -> list[tuple[int, str, str, str]]:
    spans: list[tuple[int, str, str, str]] = []
    for anchor, slug, label in SECTION_ORDER:
        pat = re.compile(rf"^\s*{re.escape(anchor)}\s*$", re.M)
        m = pat.search(chapter)
        if not m:
            continue
        spans.append((m.start(), anchor, slug, label))
    spans.sort(key=lambda x: x[0])
    sections: list[tuple[int, str, str, str, int]] = []
    for i, (pos, _anchor, slug, label) in enumerate(spans):
        end = spans[i + 1][0] if i + 1 < len(spans) else len(chapter)
        sections.append((pos, slug, label, end))
    return [(pos, slug, label, end) for pos, slug, label, end in sections]


def find_dot_entries(section: str) -> list[tuple[int, str, int]]:
    found: list[tuple[int, str, int]] = []
    for m in DOT_HEADING_RE.finditer(section):
        name = re.sub(r"\s+", " ", m.group(1)).strip()
        if is_noise_heading(name):
            continue
        found.append((m.start(), name, count_dots(m.group(2))))
    return found


def find_marker_entries(section: str, marker: str) -> list[tuple[int, str, int | None]]:
    """Name-only headings whose block contains a type-specific marker field."""
    dot_starts = {p for p, _, _ in find_dot_entries(section)}
    found: list[tuple[int, str, int | None]] = []
    for m in NAME_ONLY_RE.finditer(section):
        if m.start() in dot_starts:
            continue
        name = re.sub(r"\s+", " ", m.group(1)).strip()
        if is_noise_heading(name):
            continue
        window = section[m.end() : m.end() + 2500]
        marker_at = window.find(marker)
        if marker_at < 0:
            continue
        between = window[:marker_at]
        if DOT_HEADING_RE.search(between):
            continue
        found.append((m.start(), name, None))
    return found


def merge_entry_starts(
    section: str, slug: str
) -> list[tuple[int, str, int | None]]:
    entries = [(p, n, c) for p, n, c in find_dot_entries(section)]
    if slug == "covenant":
        for p, n, _ in find_marker_entries(section, "Motif:"):
            if not any(p == e[0] for e in entries):
                entries.append((p, n, None))
    elif slug == "cults":
        for p, n, _ in find_marker_entries(section, "Cult Rating:"):
            if not any(p == e[0] for e in entries):
                entries.append((p, n, None))
    entries.sort(key=lambda x: x[0])
    return entries


def strip_heading_prefix(block: str) -> str:
    m = DOT_HEADING_RE.search(block)
    if m:
        return block[m.end() :]
    m = NAME_ONLY_RE.search(block)
    if m:
        return block[m.end() :]
    return block


def extract_description(block: str, slug: str = "") -> str:
    remainder = strip_heading_prefix(block).lstrip()
    if slug == "covenant":
        remainder = re.sub(r"^Motif:\s*.+?(?:\n|$)", "", remainder, flags=re.I | re.M)
        remainder = re.sub(r"^Sacred Symbol:\s*.+?(?:\n|$)", "", remainder, flags=re.I | re.M)
    struct = STRUCT_START_RE.search(remainder)
    if struct:
        remainder = remainder[: struct.start()]
    text = re.sub(r"\s+", " ", remainder).strip()
    return text


def extract_fields(block: str) -> dict[str, str | list[str]]:
    fields: dict[str, str | list[str]] = {}
    for key, pattern in FIELD_RES:
        m = pattern.search(block)
        if m:
            val = re.sub(r"\s+", " ", m.group(1)).strip()
            if val:
                fields[key] = val

    for key, pat in [
        ("knacks", re.compile(r"^Knacks?:\s*(.+)$", re.I | re.M)),
        ("flaws", re.compile(r"^Flaws?:\s*(.+)$", re.I | re.M)),
        ("contacts", re.compile(r"^Contacts?:\s*(.+)$", re.I | re.M)),
        ("followers", re.compile(r"^Followers?\s*\d*:\s*(.+)$", re.I | re.M)),
    ]:
        vals = [re.sub(r"\s+", " ", x.group(1)).strip() for x in pat.finditer(block)]
        if vals:
            fields[key] = vals

    return fields


def mechanical_summary(block: str, fields: dict[str, str | list[str]]) -> str:
    parts: list[str] = []
    for key in (
        "tier",
        "drive",
        "primaryPool",
        "secondaryPool",
        "qualities",
        "flairs",
        "defense",
        "health",
        "tags",
        "purviews",
        "motif",
        "sacredSymbol",
        "cultRating",
        "foundation",
        "assetSkills",
        "guideStunt",
        "marvel",
        "special",
        "requirement",
        "tenets",
        "rites",
        "archetype",
    ):
        val = fields.get(key)
        if isinstance(val, str) and val:
            label = re.sub(r"([A-Z])", r" \1", key).strip().title()
            parts.append(f"{label}: {val}")
    for key in ("knacks", "flaws"):
        val = fields.get(key)
        if isinstance(val, list):
            for item in val:
                parts.append(f"{key[:-1].title()}: {item}")
    return " ".join(parts).strip()


def parse_entry(
    block: str,
    name: str,
    point_cost: int | None,
    slug: str,
    page: int,
) -> dict:
    block = normalize_fields(block)
    fields = extract_fields(block)
    entry: dict = {
        "name": name,
        "type": slug,
        "source": {"book": BOOK, "page": page},
        "description": extract_description(block, slug),
        "mechanicalDescription": mechanical_summary(block, fields),
    }
    if point_cost is not None:
        entry["pointCost"] = point_cost
    elif slug in {"covenant", "cults"}:
        entry["pointCost"] = None
    mythic = bool(re.search(r"(?m)^MYTHIC\s*$", block))
    if mythic:
        entry["mythic"] = True

    for key, val in fields.items():
        if key in MULTI_FIELD_KEYS:
            entry[key] = val
        elif isinstance(val, str):
            entry[key] = val
    return entry


def extract_type(
    chapter: str,
    slug: str,
    start: int,
    end: int,
    line_pages: list[int],
    chapter_line_offset: int,
) -> list[dict]:
    section = chapter[start:end]
    section = join_wrapped_headings(section)
    starts = merge_entry_starts(section, slug)
    entries: list[dict] = []

    for i, (pos, name, cost) in enumerate(starts):
        nxt = starts[i + 1][0] if i + 1 < len(starts) else len(section)
        block = section[pos:nxt]
        if i == 0:
            first_dot = DOT_HEADING_RE.search(block)
            first_name = NAME_ONLY_RE.search(block) if slug in {"covenant", "cults"} else None
            first = None
            if first_dot and first_name:
                first = first_dot if first_dot.start() < first_name.start() else first_name
            else:
                first = first_dot or first_name
            if first:
                block = block[first.start() + 1 if block[first.start()] == "\n" else first.start() :]

        rel_line = chapter[: start + pos].count("\n")
        abs_line = chapter_line_offset + rel_line
        page = line_pages[abs_line] if abs_line < len(line_pages) else line_pages[-1]
        entries.append(parse_entry(block, name, cost, slug, page))

    return entries


def extract_all(text: str) -> dict[str, list[dict]]:
    text = normalize_text(text)
    chapter, chapter_offset = slice_birthrights(text)
    lines, line_pages = build_page_index(text)
    chapter_line_offset = text[:chapter_offset].count("\n")

    spans = find_section_spans(chapter)
    by_type: dict[str, list[dict]] = {}
    for pos, slug, _label, end in spans:
        entries = extract_type(
            chapter, slug, pos, end, line_pages, chapter_line_offset
        )
        by_type[slug] = entries
    return by_type


def write_output(by_type: dict[str, list[dict]]) -> dict[str, int]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.json"):
        old.unlink()
    counts: dict[str, int] = {}
    for _anchor, slug, label in SECTION_ORDER:
        entries = by_type.get(slug, [])
        seen: set[str] = set()
        unique: list[dict] = []
        for e in entries:
            key = e["name"].lower()
            if key in seen:
                continue
            seen.add(key)
            unique.append(e)
        unique.sort(key=lambda x: (x.get("pointCost") is None, x.get("pointCost") or 0, x["name"]))
        path = OUT_DIR / f"{slug}.json"
        path.write_text(
            json.dumps(
                {
                    "_meta": {
                        "birthrightType": slug,
                        "birthrightTypeLabel": label,
                        "sourceBook": BOOK,
                        "entryCount": len(unique),
                        "extractedOn": date.today().isoformat(),
                    },
                    "birthrights": unique,
                },
                indent=2,
                ensure_ascii=False,
            )
            + "\n",
            encoding="utf-8",
        )
        counts[slug] = len(unique)
    return counts


def main() -> int:
    if not TEXT_PATH.is_file():
        print(f"Missing extract: {TEXT_PATH}")
        return 1
    counts = write_output(extract_all(TEXT_PATH.read_text(encoding="utf-8")))
    total = sum(counts.values())
    print(f"Extracted {total} birthrights into {len(counts)} files under {OUT_DIR}")
    for slug, n in counts.items():
        print(f"  {slug}.json: {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
