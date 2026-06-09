#!/usr/bin/env python3
"""
Build ``src/data/books/<slug>.json`` from local PDFs (``pdftotext``).

Each file is one book. Rows include ``source`` = ``<pdf> p.<n>`` (pdftotext page index,
usually matches PDF viewer page). Summaries truncate long stat blocks.

  python3 src/scripts/build_book_bundle_slices.py
  SCION_BOOKS_DIR=/path/to/pdfs python3 src/scripts/build_book_bundle_slices.py
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
BOOKS_OUT = SRC / "data" / "books"
SCRIPTS = Path(__file__).resolve().parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from scion_books_dir import books_search_dirs, find_pdf_in_books  # noqa: E402

DESC_MAX = 720
MECH_MAX = 720
BLOCK_MAX = 3200

# ---------------------------------------------------------------------------
# PDFs handled by explicit builders in this script (skip in generic sweep)
# ---------------------------------------------------------------------------
KNOWN_PDFS = {
    "7711-Divine_Garage.pdf",
    "7711-Divine_Menagerie.pdf",
    "7711-Divine_Menagerie_2.pdf",
    "7711-Divine_Menagerie_3.pdf",
    "7711-Divine_Menagerie_4_-_pages.pdf",
    "7711-Divine_Reliquary_v2.pdf",
    "7711-Divine_Arenas.pdf",
    "7711-Divine_Identities.pdf",
    "7711-Divine_Armory.pdf",
    "248670-Scion_Britannias_Dragons.pdf",
    "255389-RECONDITIONED_2.pdf",
    # Duplicate / alternate editions (content merged into canonical entries)
    "Pandoras_Box_Finale.pdf",
    # Companion list PDFs (not standalone books)
    "7711-Divine_Garage_-_List_of_Vehicles.pdf",
    "7711-Divine_Menagerie_-_List_of_Antagonists.pdf",
    "7711-Divine_Menagerie_2_-_List_of_Antagonists.pdf",
    "7711-Divine_Menagerie_3_-_List_of_Antagonists.pdf",
    "7711-Divine_Reliquary_v2_-_List_of_Relics.pdf",
    "7711-Divine_Armory_-_List_of_Weapons.pdf",
}

# Core PDFs handled by the main parser framework (parse.py), not this script
CORE_PDFS = {
    "SCION_Pandoras_Box_(Revised_Download).pdf",
    "Scion_Origin_(Revised_Download).pdf",
    "Scion_Hero_(Final_Download).pdf",
    "Scion_Demigod_Second_Edition_(Final_Download).pdf",
    "Scion_God_Second_Edition_(Final_Download).pdf",
    "Scion_Dragon_(Final_Download).pdf",
    "Scion_Dragon_Companion_(Final_Download).pdf",
    "Mysteries_of_the_World_-_Scion_Companion_(Final_Download).pdf",
    "Scion_Masks_of_the_Mythos_(Final_Download).pdf",
    "Scion_Players_Guide__Saints__Monsters_(Final_Download).pdf",
    "TItans_Rising_(Final_Download).pdf",
    "Titans_Rising_(Final_Download).pdf",
}

# Slugs to skip — duplicates of canonical CORE_BOOKS entries
_SKIP_GENERIC_SLUGS = {"pandoras_box_finale"}


def _run_pdftotext(pdf: Path) -> str:
    try:
        r = subprocess.run(
            ["pdftotext", str(pdf), "-"],
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )
    except FileNotFoundError:
        return ""
    return r.stdout or ""


def pdf_pages(pdf: Path) -> list[str]:
    return _run_pdftotext(pdf).split("\f")


def _squish(s: str, max_len: int) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) <= max_len:
        return s
    cut = s[: max_len - 3].rsplit(" ", 1)[0]
    return cut + "…"


def _needle_regex_for_title(title: str) -> re.Pattern[str]:
    core = re.sub(r"\s*\(.*?\)\s*", "", title).strip()
    parts = [re.escape(p) for p in core.split() if p]
    if not parts:
        parts = [re.escape(core)]
    inner = r"\s+".join(parts)
    return re.compile(rf"■\s*{inner}\b", re.IGNORECASE)


def extract_bullet_block(pages: list[str], title: str) -> tuple[int, str] | None:
    pat = _needle_regex_for_title(title)
    for i, pg in enumerate(pages):
        m = pat.search(pg)
        if not m:
            continue
        tail = pg[m.start() : m.start() + BLOCK_MAX]
        nxt = re.search(r"(?=\s■\s)", tail[25:])
        block = tail[: 25 + nxt.start()] if nxt else tail
        return i + 1, block.strip()
    return None


def split_description_mechanical(block: str) -> tuple[str, str]:
    flat = re.sub(r"\s+", " ", block).strip()
    if not flat:
        return "", ""
    for sep in (" Primary Pool", " Flairs:", " Scale:", " Desperation Pool:", " Health:"):
        idx = flat.find(sep)
        if 80 < idx < len(flat) - 120:
            a, b = flat[:idx].strip(), flat[idx:].strip()
            return _squish(a, DESC_MAX), _squish(b, MECH_MAX)
    half = len(flat) // 2
    return _squish(flat[:half], DESC_MAX), _squish(flat[half:], MECH_MAX)


def pascal_body(display: str) -> str:
    s = re.sub(r"\s*\(.*?\)\s*", "", display)
    s = re.sub(r"[●◆◇]+", "", s)
    parts = re.findall(r"[A-Za-z0-9]+", s)
    if not parts:
        return "Unknown"
    return "".join(p[:1].upper() + p[1:].lower() for p in parts)


def pascal_id(prefix: str, display: str) -> str:
    return prefix + pascal_body(display)


def antagonist_name_lines_from_blob(blob: str, *, strict: bool = False) -> list[str]:
    skip = {
        "list of antagonists",
        "appendix i",
        "appendix ii",
        "appendix",
        "list of all the antagonist",
        "alphabetically",
        "according to chapters",
        "variations of the same entry",
    }
    bad_short = {
        "the",
        "they",
        "when",
        "this",
        "that",
        "each",
        "some",
        "all",
        "one",
        "their",
        "there",
        "here",
        "your",
        "use",
        "any",
        "not",
        "for",
        "keep",
        "drive",
        "tactics",
    }
    out: list[str] = []
    for ln in blob.splitlines():
        s = ln.strip()
        if not s:
            continue
        for piece in re.split(r"\s{2,}", s):
            p = piece.strip()
            if not p or len(p) > 42 or len(p) < 5:
                continue
            if p.lower() in skip:
                continue
            if re.match(r"^[A-Z][a-zA-Z ,\-]{2,65}$", p):
                if "," not in p and " " not in p and p.lower() in bad_short:
                    continue
                if "," not in p and " " not in p and len(p) < 8:
                    continue
                if p.count(" ") > 5:
                    continue
                low = p.lower()
                if any(bad in low for bad in (" is ", " are ", " that ", "sourcebook", "scion", "mystery")):
                    continue
                if strict and sum(1 for c in p if c.islower()) > 10:
                    continue
                out.append(p)
    return out


def menagerie_names_layout_list(list_pdf: Path) -> list[str]:
    try:
        r = subprocess.run(
            ["pdftotext", "-layout", str(list_pdf), "-"],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except FileNotFoundError:
        return []
    return sorted(set(antagonist_name_lines_from_blob(r.stdout or "", strict=False)))


def extract_plain_title_block(pages: list[str], title: str) -> tuple[int, str] | None:
    key = title.strip()[:60]
    if len(key) < 3:
        return None
    pat = re.compile(re.escape(key), re.IGNORECASE)
    for i, pg in enumerate(pages):
        m = pat.search(pg)
        if not m:
            continue
        chunk = pg[m.start() : m.start() + BLOCK_MAX]
        return i + 1, chunk.strip()
    return None


def bullet_names_list_pdf(text: str) -> list[str]:
    found: set[str] = set()
    for m in re.finditer(r"■\s*([^\n]+)", text):
        s = m.group(1).strip()
        if not s or len(s) > 100 or s.endswith(":"):
            continue
        low = s.lower()
        if any(x in low for x in ("appendix", "chapter", "list", "handy list", "here ")):
            continue
        found.add(s)
    return sorted(found)


def _write(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _meta(slug: str, title: str, source_pdf: str, kind: str, **extra: Any) -> dict[str, Any]:
    m: dict[str, Any] = {
        "slug": slug,
        "title": title,
        "sourcePdf": source_pdf,
        "kind": kind,
        "note": "Personal bundle slice — merged at load; delete file to remove book.",
    }
    m.update(extra)
    return m


def build_divine_garage() -> None:
    main = find_pdf_in_books(("7711-Divine_Garage.pdf",), None)
    lst = find_pdf_in_books(("7711-Divine_Garage_-_List_of_Vehicles.pdf",), None)
    if not main or not lst:
        return
    pages = pdf_pages(main)
    names = bullet_names_list_pdf(_run_pdftotext(lst))
    pdf_name = "7711-Divine_Garage.pdf"
    equipment: dict[str, Any] = {}
    for raw in names:
        loc = extract_bullet_block(pages, raw)
        if not loc:
            desc = f"Vehicle «{raw}» — stat block not auto-located; search PDF body."
            mech = ""
            page = None
        else:
            page, block = loc
            desc, mech = split_description_mechanical(block)
            desc = re.sub(r"^■\s*\S+[^\n]*\s*", "", desc).strip()
            desc, mech = _squish(desc, 620), _squish(mech, 620)
        eq_id = pascal_id("eqDg", raw)
        src = f"{pdf_name} p.{page}" if page else f"{pdf_name} (appendix list; page n/a)"
        equipment[eq_id] = {
            "id": eq_id,
            "name": re.sub(r"\s*\(.*?\)\s*$", "", raw).strip() or raw,
            "equipmentType": "vehicle",
            "tagIds": [],
            "description": desc or f"Vehicle from Divine Garage — {raw}.",
            "mechanicalEffects": mech or "Pools, Qualities, Flairs, and Scale in PDF.",
            "source": src,
        }
    _write(
        BOOKS_OUT / "divine_garage.json",
        {"_meta": _meta("divine_garage", "Divine Garage", pdf_name, "storypath_nexus", related=["7711-Divine_Garage_-_List_of_Vehicles.pdf"]), "equipment": equipment},
    )


def build_menagerie(
    slug: str,
    title: str,
    main_name: str,
    list_name: str | None,
    br_prefix: str,
    *,
    layout_list: bool = False,
    appendix_in_main: bool = False,
) -> None:
    main = find_pdf_in_books((main_name,), None)
    if not main:
        return
    pages = pdf_pages(main)
    names: list[str] = []
    if list_name:
        lp = find_pdf_in_books((list_name,), None)
        if lp:
            if layout_list:
                names = menagerie_names_layout_list(lp)
            else:
                names = bullet_names_list_pdf(_run_pdftotext(lp))
    if not names:
        joined = "\f".join(pages)
        for m in re.finditer(r"■\s*([^\n]+)", joined):
            s = m.group(1).strip()
            if 3 < len(s) < 90 and "Creature" not in s[:25]:
                names.append(s)
        names = sorted(set(names))[:120]
    if appendix_in_main and not names:
        joined = "\f".join(pages)
        parts = re.split(r"(?i)List of Antagonists", joined)
        if len(parts) > 1:
            names.extend(antagonist_name_lines_from_blob(parts[-1], strict=True))
        names = sorted(set(names))[:160]
    birthrights: dict[str, Any] = {}
    pdf_name = main_name
    for raw in names:
        loc = extract_bullet_block(pages, raw)
        if not loc:
            loc = extract_plain_title_block(pages, raw.split(",")[0].strip())
        if not loc:
            continue
        page, block = loc
        desc, mech = split_description_mechanical(block)
        desc = re.sub(r"^■\s*\S+[^\n]*\s*", "", desc).strip()
        desc, mech = _squish(desc, 620), _squish(mech, 620)
        bid = br_prefix + pascal_body(raw)
        birthrights[bid] = {
            "id": bid,
            "name": re.sub(r"\s*\(.*?\)\s*$", "", raw).strip() or raw,
            "birthrightType": "creature",
            "pointCost": 1,
            "description": desc,
            "mechanicalEffects": mech or "Antagonist / creature pools in PDF.",
            "source": f"{pdf_name} p.{page}",
            "creatureDetails": {"tagIds": []},
        }
    _write(BOOKS_OUT / f"{slug}.json", {"_meta": _meta(slug, title, pdf_name, "storypath_nexus"), "birthrights": birthrights})


def reliquary_relic_names(list_pdf: Path) -> list[str]:
    text = _run_pdftotext(list_pdf)
    names: list[str] = []
    skip = {
        "talismans",
        "of",
        "and",
        "then",
        "rating",
        "chapters",
        "individually",
        "example",
        "trap additional entity types by adding",
    }
    for ln in text.splitlines():
        s = ln.strip()
        if not s or len(s) > 70 or ":" in s:
            continue
        if s.lower() in skip or s.lower().startswith("number "):
            continue
        if not re.match(r"^[A-Z]", s):
            continue
        if s in ("Charms and", "0-dot Relics", "1-dot Relics", "2-dot Relics", "3-dot Relics", "4-dot Relics"):
            continue
        if re.match(r"^(Motif|Knack|Purview|Tags|Flaw|Enhancements)\b", s, re.I):
            continue
        if len(s) >= 3:
            names.append(s)
    out: list[str] = []
    seen: set[str] = set()
    for n in names:
        k = n.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(n)
    return out


def build_divine_reliquary() -> None:
    main = find_pdf_in_books(("7711-Divine_Reliquary_v2.pdf",), None)
    lst = find_pdf_in_books(("7711-Divine_Reliquary_v2_-_List_of_Relics.pdf",), None)
    if not main or not lst:
        return
    pages = pdf_pages(main)
    pdf_name = "7711-Divine_Reliquary_v2.pdf"
    birthrights: dict[str, Any] = {}
    for name in reliquary_relic_names(lst):
        if len(name) < 3:
            continue
        pat = re.compile(re.escape(name.split("(")[0].strip())[:42], re.I)
        page_num = None
        block = ""
        for i, pg in enumerate(pages):
            if pat.search(pg):
                page_num = i + 1
                m = pat.search(pg)
                block = pg[m.start() : m.start() + BLOCK_MAX] if m else ""
                break
        desc, mech = split_description_mechanical(block) if block else ("", "")
        if not desc:
            desc = f"Relic «{name}» — confirm milestone cost and text in PDF."
        desc, mech = _squish(desc, 620), _squish(mech, 620)
        bid = "brRel" + pascal_body(re.sub(r"[()●]", " ", name))
        ms = re.search(r"Number of Milestones:\s*(\d+)", block)
        rating = min(5, max(1, int(ms.group(1)))) if ms else 1
        src = f"{pdf_name} p.{page_num}" if page_num else f"{pdf_name} (see list PDF)"
        birthrights[bid] = {
            "id": bid,
            "name": name,
            "birthrightType": "relic",
            "pointCost": 1,
            "description": desc,
            "mechanicalEffects": mech or f"Milestones / Motifs per {pdf_name}.",
            "source": src,
            "relicDetails": {"rating": rating, "tagIds": [], "purviewId": "", "purviewRating": 1, "evocation": "", "motifsAndTags": ""},
        }
    _write(
        BOOKS_OUT / "divine_reliquary_v2.json",
        {"_meta": _meta("divine_reliquary_v2", "Divine Reliquary v2", pdf_name, "storypath_nexus"), "birthrights": birthrights},
    )


def build_divine_arenas_tags() -> None:
    pdf = find_pdf_in_books(("7711-Divine_Arenas.pdf",), None)
    if not pdf:
        return
    pages = pdf_pages(pdf)
    pdf_name = "7711-Divine_Arenas.pdf"
    tags: dict[str, Any] = {}
    n = 0
    for i, pg in enumerate(pages):
        for para in re.split(r"\n\s*\n+", pg):
            chunk = re.sub(r"\s+", " ", para).strip()
            if len(chunk) < 55 or len(chunk) > 520:
                continue
            if not any(k in chunk for k in ("Field", "Atmosphere", "Complication", "Enhancement", "scene", "Attitude")):
                continue
            n += 1
            tid = f"tagDaArena{n:03d}"
            tags[tid] = {
                "id": tid,
                "name": _squish(chunk[:52], 52) + ("…" if len(chunk) > 52 else ""),
                "tagType": "general",
                "category": "narrative",
                "appliesTo": ["equipment", "relic", "creature", "general"],
                "description": _squish(chunk, 480),
                "source": f"{pdf_name} p.{i + 1}",
            }
            if n >= 28:
                break
        if n >= 28:
            break
    _write(BOOKS_OUT / "divine_arenas.json", {"_meta": _meta("divine_arenas", "Divine Arenas", pdf_name, "storypath_nexus"), "tags": tags})


def build_divine_identities_paths() -> None:
    pdf = find_pdf_in_books(("7711-Divine_Identities.pdf",), None)
    if not pdf:
        return
    pages = pdf_pages(pdf)
    pdf_name = "7711-Divine_Identities.pdf"
    full = "\f".join(pages)
    paths: dict[str, Any] = {}
    seen: set[str] = set()
    title_re = re.compile(r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4})$")
    skip_titles = {"Introduction", "Appendix", "Contents", "Credits", "Origin", "Role", "Supernatural"}

    for m in re.finditer(r"Sample connections:", full):
        page = 1 + full[: m.start()].count("\f")
        prev = full[max(0, m.start() - 1600) : m.start()]
        ls = prev.rfind("Skills:")
        if ls < 0:
            continue
        before_skills = prev[:ls].strip()
        lines = [ln.strip() for ln in before_skills.splitlines() if ln.strip()]
        if not lines:
            continue
        title = lines[-1]
        if not title_re.match(title) or len(title) >= 48:
            continue
        if any(x in title for x in ("/", "Chapter", "Paths", "Appendix", "List of")):
            continue
        if title in seen or title in skip_titles:
            continue
        seen.add(title)
        tail = full[max(0, m.start() - 400) : m.start() + 1400]
        desc, mech = split_description_mechanical(tail)
        pid = "pathDi" + pascal_body(title)
        paths[pid] = {
            "id": pid,
            "name": f"{title} (Divine Identities)",
            "pathKind": "role",
            "description": desc or f"Path «{title}» — see PDF for Skills and connections.",
            "suggestedSkills": [],
            "mechanicalEffects": mech or "Divine Identities Path — confirm Skills with PDF.",
            "source": f"{pdf_name} p.{page}",
        }
    _write(BOOKS_OUT / "divine_identities.json", {"_meta": _meta("divine_identities", "Divine Identities", pdf_name, "storypath_nexus"), "paths": paths})


def build_britannia_dragons_knacks() -> None:
    pdf = find_pdf_in_books(("248670-Scion_Britannias_Dragons.pdf",), None)
    if not pdf:
        return
    pages = pdf_pages(pdf)
    pdf_name = "248670-Scion_Britannias_Dragons.pdf"
    full = "\f".join(pages)
    knacks: dict[str, Any] = {}
    seen: set[str] = set()
    for m in re.finditer(r"Transformation Knacks:\s*([^\.\n]{10,400})", full):
        chunk = m.group(1)
        page_guess = 1 + full[: m.start()].count("\f")
        for part in re.split(r",|\band\b", chunk):
            name = part.strip()
            name = re.sub(r"\s+", " ", name)
            if len(name) < 4 or len(name) > 60:
                continue
            low = name.lower()
            if low in seen:
                continue
            seen.add(low)
            kid = "knkBrit" + pascal_body(name)
            knacks[kid] = {
                "id": kid,
                "name": name,
                "callingsAny": True,
                "tierMin": "mortal",
                "knackKind": "mortal",
                "description": _squish(
                    f"Lindwurm / dragon Transformation option from Britannia's Dragons — see PDF for full rules, costs, and limits. Appears near Transformation Knacks listings.",
                    DESC_MAX,
                ),
                "mechanicalEffects": "Confirm with 248670-Scion_Britannias_Dragons.pdf (Dragon Heir / Lindwurm context).",
                "source": f"{pdf_name} p.{page_guess} (approx. from text offset)",
            }
    _write(
        BOOKS_OUT / "scion_britannias_dragons.json",
        {"_meta": _meta("scion_britannias_dragons", "Britannia's Dragons", pdf_name, "onyx_path"), "knacks": knacks},
    )


def build_divine_armory() -> None:
    main = find_pdf_in_books(("7711-Divine_Armory.pdf",), None)
    lst = find_pdf_in_books(("7711-Divine_Armory_-_List_of_Weapons.pdf",), None)
    if not main:
        return
    pages = pdf_pages(main)
    pdf_name = "7711-Divine_Armory.pdf"
    equipment: dict[str, Any] = {}

    # Parse weapon names from the list PDF (format: "Name\nTags: ...\nTotal: N")
    names: list[str] = []
    if lst:
        text = _run_pdftotext(lst)
        # Each weapon entry: Title Case name on its own line, followed by "Tags:" line
        for m in re.finditer(r"^([A-Z][A-Za-z \-']+)$\s*Tags:", text, re.MULTILINE):
            name = m.group(1).strip()
            if 3 <= len(name) <= 50 and name not in ("Unarmed", "Melee Weapons", "Ranged Weapons", "Tactical Weapons", "Armor"):
                names.append(name)
        names = sorted(set(names))

    for raw in names:
        loc = extract_bullet_block(pages, raw) or extract_plain_title_block(pages, raw)
        page = loc[0] if loc else None
        block = loc[1] if loc else ""
        desc, mech = split_description_mechanical(block) if block else ("", "")
        desc = re.sub(r"^■\s*\S+[^\n]*\s*", "", desc).strip()
        desc, mech = _squish(desc, 620), _squish(mech, 620)
        eq_id = pascal_id("eqDa", raw)
        src = f"{pdf_name} p.{page}" if page else f"{pdf_name} (see list)"
        equipment[eq_id] = {
            "id": eq_id,
            "name": raw,
            "equipmentType": "weapon",
            "tagIds": [],
            "description": desc or f"Weapon/armor from Divine Armory — {raw}.",
            "mechanicalEffects": mech or "Tags and Enhancement in PDF.",
            "source": src,
        }
    _write(
        BOOKS_OUT / "divine_armory.json",
        {"_meta": _meta("divine_armory", "Divine Armory", pdf_name, "storypath_nexus"), "equipment": equipment},
    )


def build_reconditioned_row() -> None:
    p1 = find_pdf_in_books(("255389-RECONDITIONED_2.pdf", "255389-reconditioned.pdf"), None)
    if not p1:
        return
    pages = pdf_pages(p1)
    pdf_name = p1.name
    blob = _squish(re.sub(r"\s+", " ", pages[0] if pages else ""), 900)
    equipment = {
        "eqReconditionedComic": {
            "id": "eqReconditionedComic",
            "name": "Reconditioned (comic)",
            "equipmentType": "general",
            "tagIds": [],
            "description": blob or "Comic volume in local library — no Scion stat blocks indexed.",
            "mechanicalEffects": "N/a — personal reference entry.",
            "source": f"{pdf_name} p.1",
        }
    }
    _write(BOOKS_OUT / "reconditioned.json", {"_meta": _meta("reconditioned", "Reconditioned", pdf_name, "other"), "equipment": equipment})


# ---------------------------------------------------------------------------
# Generic fallback parser for unknown / new PDFs
# ---------------------------------------------------------------------------

def _slug_from_filename(filename: str) -> str:
    """Derive a snake_case slug from a PDF filename.

    Strips numeric prefix (e.g. '7711-', '248670-'), common download suffixes,
    extension, and converts to lower snake_case.
    """
    stem = Path(filename).stem
    # Strip leading numeric prefix like "7711-" or "248670-"
    stem = re.sub(r"^\d+[-_]", "", stem)
    # Strip common download suffixes
    stem = re.sub(r"[_\s]*\((?:Final_?Download|Revised_?Download|Download)\)", "", stem, flags=re.I)
    # Strip version suffixes like "_v3"
    stem = re.sub(r"_v\d+$", "", stem, flags=re.I)
    # Replace separators with underscores
    stem = re.sub(r"[-\s]+", "_", stem)
    # CamelCase → snake_case
    stem = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", stem)
    # Collapse multiple underscores, strip edges, lowercase
    stem = re.sub(r"_+", "_", stem).strip("_").lower()
    return stem


def _detect_title(pages: list[str]) -> str:
    """Try to detect the book title from the first page or two."""
    # Common words that indicate credits/authors, not titles
    skip_words = {"by", "written", "author", "design", "layout", "editing", "art", "illustration", "cover"}
    for pg in pages[:2]:
        lines = [ln.strip() for ln in pg.splitlines() if ln.strip()]
        for ln in lines[:12]:
            # Skip very short or very long lines
            if len(ln) < 4 or len(ln) > 80:
                continue
            # Skip lines that are clearly not titles
            if ln.startswith("©") or ln.startswith("http") or "@" in ln:
                continue
            # Skip author/credits lines (contain commas with many proper names)
            if ln.count(",") >= 2:
                continue
            low = ln.lower()
            if any(w in low for w in skip_words):
                continue
            # Look for "Scion" in the line — strong signal it's a title
            if "scion" in low or "divine" in low:
                title = ln.rstrip(".!:;,")
                # Normalize case if ALL CAPS
                if title.isupper():
                    title = title.title()
                if len(title) >= 4:
                    return title
            # Fall back to Title Case or ALL CAPS lines
            if ln.istitle() or (ln.isupper() and len(ln) > 5):
                title = ln.rstrip(".!:;,")
                if title.isupper():
                    title = title.title()
                if len(title) >= 4:
                    return title
    return ""


# --- Title overrides for PDFs whose auto-detection picks up wrong text ---
_TITLE_OVERRIDES: dict[str, str] = {
    "Scion_God_Players_Guide_(Final_Download).pdf": "Scion: God Players Guide",
    "Scion_-_Titanomachy_(Final_Download).pdf": "Scion: Titanomachy",
    "Scion_Mythical_Denizens_(Final_Download).pdf": "Scion: Mythical Denizens",
    "Scion_Wild_Hunt_(Final_Download).pdf": "Scion: Wild Hunt",
    "Realms_of_Mystery__Magic_(Final_Download).pdf": "Realms of Mystery & Magic",
    "Rock_Gods_and_Road_Trips_(Final_Download).pdf": "Rock Gods and Road Trips",
    "Pandoras_Box_Finale.pdf": "Pandora's Box (Finale)",
    "248484-ScionCC_v3.pdf": "Scion Community Compilation",
    "7711-Divine_Armory.pdf": "Divine Armory",
}

_RE_EQUIPMENT_TAGS = re.compile(
    r"\b(Ranged|Melee|Bashing|Lethal|Aggravated|Piercing|Grapple|Thrown|"
    r"Concealable|Two-[Hh]anded|Reach|Pushing|Stun|Deadly|Loud|"
    r"Hard Armor|Soft Armor|Ballistic|Firearm)\b"
)
_RE_CREATURE_STATS = re.compile(
    r"(Primary Pool|Attack|Defense|Health|Willpower|Desperation Pool)", re.I
)
_RE_KNACK_HEADING = re.compile(r"\b[Kk]nacks?\b")
_RE_BOON_DOTS = re.compile(r"[●◆]{1,5}|(?:Innate|●{1,5})")
_RE_PATH_SECTION = re.compile(r"\bPath\b.*Skills:", re.I | re.DOTALL)
_RE_BULLET_ENTRY = re.compile(r"■\s*([^\n]{4,100})")
_RE_HEADING_LINE = re.compile(r"^[A-Z][A-Z ]{3,60}$|^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,5}$")


def _extract_equipment_entries(pages: list[str], slug: str, pdf_name: str) -> dict[str, Any]:
    """Extract equipment entries: bullet items with weapon/armor tags."""
    entries: dict[str, Any] = {}
    n = 0
    for i, pg in enumerate(pages):
        for m in _RE_BULLET_ENTRY.finditer(pg):
            name_raw = m.group(1).strip()
            # Look at surrounding context for equipment tags
            context_start = max(0, m.start() - 20)
            context_end = min(len(pg), m.end() + 600)
            context = pg[context_start:context_end]
            tag_hits = _RE_EQUIPMENT_TAGS.findall(context)
            if len(tag_hits) < 2:
                continue
            n += 1
            eid = f"eq{pascal_body(slug[:8])}{n:03d}"
            block = pg[m.start():min(len(pg), m.start() + BLOCK_MAX)]
            # Trim at next bullet
            nxt = re.search(r"(?=\s■\s)", block[25:])
            if nxt:
                block = block[:25 + nxt.start()]
            desc, mech = split_description_mechanical(block)
            desc = re.sub(r"^■\s*\S+[^\n]*\s*", "", desc).strip()
            entries[eid] = {
                "id": eid,
                "name": re.sub(r"\s*\(.*?\)\s*$", "", name_raw).strip() or name_raw,
                "equipmentType": "weapon" if any(t in tag_hits for t in ("Melee", "Ranged", "Firearm")) else "armor" if any(t in tag_hits for t in ("Hard Armor", "Soft Armor", "Ballistic")) else "general",
                "tagIds": [],
                "description": _squish(desc, DESC_MAX) or f"Equipment from {pdf_name}.",
                "mechanicalEffects": _squish(mech, MECH_MAX) or "See PDF for full stats.",
                "source": f"{pdf_name} p.{i + 1}",
            }
    return entries


def _extract_knack_entries(pages: list[str], slug: str, pdf_name: str) -> dict[str, Any]:
    """Extract knack-like entries: Title Case names followed by description paragraphs.

    Skips entries that look like weapons, armor, or equipment items.
    """
    entries: dict[str, Any] = {}
    n = 0
    in_knack_section = False

    # Words that indicate an entry is equipment, not a knack
    _ITEM_WORDS = frozenset({
        "sword", "knife", "dagger", "axe", "mace", "hammer", "spear", "lance",
        "halberd", "staff", "club", "flail", "whip", "blade", "cane", "pike",
        "trident", "javelin", "sling", "bow", "crossbow", "longbow",
        "gun", "pistol", "rifle", "musket", "shotgun", "revolver", "cannon",
        "carbine", "derringer", "submachine", "chaingun", "speargun",
        "armor", "shield", "helm", "helmet", "gauntlet", "breastplate",
        "chainmail", "plate", "buckler", "cuirass", "greaves",
    })

    def _looks_like_item(name: str) -> bool:
        words = set(name.lower().split())
        return bool(words & _ITEM_WORDS)

    def _looks_like_sentence(name: str) -> bool:
        """Reject lines that are sentence fragments, not proper names."""
        words = name.split()
        if len(words) > 6:
            return True
        # Lines starting with "The" are almost always section headings or descriptions, not knack names
        if name.startswith("The "):
            return True
        # If 2+ non-initial words are lowercase function words, it's a sentence
        _FUNCTION_WORDS = {"is", "are", "the", "a", "an", "of", "for", "to", "in",
                           "on", "at", "by", "with", "from", "have", "has", "been",
                           "was", "were", "will", "can", "do", "does", "did",
                           "belong", "appears", "following", "additional", "sometimes"}
        low_hits = sum(1 for w in words[1:] if w.lower() in _FUNCTION_WORDS)
        if low_hits >= 2:
            return True
        # Ends with a verb/preposition/article — likely a sentence fragment
        if words[-1].lower() in {"are", "is", "the", "have", "been", "in", "of", "to", "and", "or", "belong"}:
            return True
        # Long names with "and" are typically organization/description phrases, not knacks
        if len(words) >= 4 and "and" in [w.lower() for w in words]:
            return True
        # Contains a lowercase word that's clearly a verb/connector (not part of a name)
        _VERB_WORDS = {"appears", "belong", "following", "additional", "sometimes",
                       "stereotypical", "organizational", "witness"}
        if any(w.lower() in _VERB_WORDS for w in words):
            return True
        return False

    # If the book is primarily equipment-focused (many equipment tag hits),
    # require stricter knack evidence
    full_text = "\f".join(pages)
    equip_tag_count = len(_RE_EQUIPMENT_TAGS.findall(full_text))
    knack_ref_count = len(re.findall(r"\b[Kk]nacks?\b", full_text))
    # If equipment tags vastly outnumber knack references, this is an equipment book
    is_equipment_book = equip_tag_count > 50 and equip_tag_count > knack_ref_count * 5

    # For equipment books, don't extract knacks at all — the Title Case pattern
    # generates too many false positives from weapon/armor names
    if is_equipment_book:
        return entries

    for i, pg in enumerate(pages):
        if _RE_KNACK_HEADING.search(pg):
            in_knack_section = True
        if not in_knack_section:
            continue

        lines = pg.splitlines()
        j = 0
        while j < len(lines):
            ln = lines[j].strip()
            # Look for a Title Case name on its own line (knack pattern)
            if (
                ln
                and 4 <= len(ln) <= 55
                and re.match(r"^[A-Z][a-z]+(?:\s+[A-Za-z\']+){0,5}$", ln)
                and not ln.startswith("Chapter")
                and not ln.startswith("Appendix")
                and not _looks_like_item(ln)
                and not _looks_like_sentence(ln)
            ):
                # Collect following paragraph(s) as description
                desc_lines: list[str] = []
                k = j + 1
                while k < len(lines) and len(desc_lines) < 15:
                    follow = lines[k].strip()
                    if not follow:
                        if desc_lines:
                            break
                        k += 1
                        continue
                    # Stop if we hit another Title Case heading
                    if re.match(r"^[A-Z][a-z]+(?:\s+[A-Za-z\']+){0,5}$", follow) and len(follow) <= 55:
                        break
                    desc_lines.append(follow)
                    k += 1

                if desc_lines and len(" ".join(desc_lines)) > 30:
                    n += 1
                    kid = f"knk{pascal_body(slug[:8])}{n:03d}"
                    full_desc = " ".join(desc_lines)
                    entries[kid] = {
                        "id": kid,
                        "name": ln,
                        "callingsAny": True,
                        "tierMin": "mortal",
                        "knackKind": "mortal",
                        "description": _squish(full_desc, DESC_MAX),
                        "mechanicalEffects": f"See {pdf_name} for full rules.",
                        "source": f"{pdf_name} p.{i + 1}",
                    }
                    j = k
                    continue
            j += 1
    return entries


def _extract_birthright_entries(pages: list[str], slug: str, pdf_name: str) -> dict[str, Any]:
    """Extract creature/follower stat blocks (Primary Pool / Health / Willpower patterns)."""
    entries: dict[str, Any] = {}
    n = 0
    for i, pg in enumerate(pages):
        # Look for bullet entries near creature stats
        for m in _RE_BULLET_ENTRY.finditer(pg):
            name_raw = m.group(1).strip()
            context_end = min(len(pg), m.end() + 800)
            context = pg[m.start():context_end]
            stat_hits = _RE_CREATURE_STATS.findall(context)
            if len(stat_hits) < 2:
                continue
            # Skip if this looks more like equipment
            if _RE_EQUIPMENT_TAGS.search(context[:200]) and len(_RE_EQUIPMENT_TAGS.findall(context[:200])) >= 2:
                continue
            n += 1
            bid = f"br{pascal_body(slug[:8])}{n:03d}"
            block = pg[m.start():min(len(pg), m.start() + BLOCK_MAX)]
            nxt = re.search(r"(?=\s■\s)", block[25:])
            if nxt:
                block = block[:25 + nxt.start()]
            desc, mech = split_description_mechanical(block)
            desc = re.sub(r"^■\s*\S+[^\n]*\s*", "", desc).strip()
            entries[bid] = {
                "id": bid,
                "name": re.sub(r"\s*\(.*?\)\s*$", "", name_raw).strip() or name_raw,
                "birthrightType": "creature",
                "pointCost": 1,
                "description": _squish(desc, DESC_MAX) or f"Creature/follower from {pdf_name}.",
                "mechanicalEffects": _squish(mech, MECH_MAX) or "See PDF for pools and stats.",
                "source": f"{pdf_name} p.{i + 1}",
                "creatureDetails": {"tagIds": []},
            }
    return entries


def _extract_boon_entries(pages: list[str], slug: str, pdf_name: str) -> dict[str, Any]:
    """Extract boon entries: names with dot ratings (● characters) or near Boon headings."""
    entries: dict[str, Any] = {}
    n = 0
    in_boon_section = False
    boon_re = re.compile(r"^(.{4,50}?)\s*(●{1,5}|[●◆]{1,5})\s*$")

    for i, pg in enumerate(pages):
        if re.search(r"\bBoons?\b", pg):
            in_boon_section = True
        if not in_boon_section:
            continue
        for ln in pg.splitlines():
            s = ln.strip()
            m = boon_re.match(s)
            if not m:
                continue
            name_raw = m.group(1).strip()
            dots = len(m.group(2).replace("◆", "●"))
            if len(name_raw) < 3 or name_raw.lower().startswith("chapter"):
                continue
            n += 1
            boid = f"boon{pascal_body(slug[:8])}{n:03d}"
            entries[boid] = {
                "id": boid,
                "name": name_raw,
                "dotRating": dots,
                "description": f"Boon from {pdf_name} — see PDF for activation and effects.",
                "mechanicalEffects": f"{dots}-dot Boon. Confirm rules in {pdf_name}.",
                "source": f"{pdf_name} p.{i + 1}",
            }
    return entries


def _extract_path_entries(pages: list[str], slug: str, pdf_name: str) -> dict[str, Any]:
    """Extract Path sections with Skills/connections."""
    entries: dict[str, Any] = {}
    n = 0
    full = "\f".join(pages)
    for m in re.finditer(r"Sample [Cc]onnections?:", full):
        page = 1 + full[:m.start()].count("\f")
        prev = full[max(0, m.start() - 1600):m.start()]
        ls = prev.rfind("Skills:")
        if ls < 0:
            continue
        before_skills = prev[:ls].strip()
        lines = [ln.strip() for ln in before_skills.splitlines() if ln.strip()]
        if not lines:
            continue
        title = lines[-1]
        if not re.match(r"^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4}$", title) or len(title) >= 48:
            continue
        if any(x in title for x in ("/", "Chapter", "Paths", "Appendix", "List of")):
            continue
        n += 1
        pid = f"path{pascal_body(slug[:8])}{n:03d}"
        tail = full[max(0, m.start() - 400):m.start() + 1400]
        desc, mech = split_description_mechanical(tail)
        entries[pid] = {
            "id": pid,
            "name": title,
            "pathKind": "role",
            "description": desc or f"Path «{title}» — see PDF for Skills and connections.",
            "suggestedSkills": [],
            "mechanicalEffects": mech or f"Path from {pdf_name} — confirm with PDF.",
            "source": f"{pdf_name} p.{page}",
        }
    return entries


def build_generic_book(pdf_path: Path) -> Path | None:
    """Generic fallback parser for unknown Scion PDFs.

    Extracts whatever structured content can be detected and writes a
    ``src/data/books/<slug>.json`` file. Returns the output path on success,
    or None if the PDF cannot be processed.
    """
    pdf_name = pdf_path.name
    slug = _slug_from_filename(pdf_name)

    if slug in _SKIP_GENERIC_SLUGS:
        return None

    out_path = BOOKS_OUT / f"{slug}.json"

    # Don't overwrite existing curated data
    if out_path.exists():
        return None

    # Run pdftotext
    pages = pdf_pages(pdf_path)
    if not pages or all(not p.strip() for p in pages):
        # Empty or unreadable PDF — write minimal meta-only entry
        payload: dict[str, Any] = {
            "_meta": _meta(slug, slug.replace("_", " ").title(), pdf_name, "unknown",
                           note="Auto-generated stub — PDF was empty or unreadable."),
        }
        _write(out_path, payload)
        return out_path

    # Detect title
    title = _TITLE_OVERRIDES.get(pdf_name) or _detect_title(pages) or slug.replace("_", " ").title()

    # Try extracting each content type
    equipment = _extract_equipment_entries(pages, slug, pdf_name)
    knacks = _extract_knack_entries(pages, slug, pdf_name)
    birthrights = _extract_birthright_entries(pages, slug, pdf_name)
    boons = _extract_boon_entries(pages, slug, pdf_name)
    paths = _extract_path_entries(pages, slug, pdf_name)

    # Build payload with whatever was found
    payload = {
        "_meta": _meta(slug, title, pdf_name, "storypath_nexus",
                       note="Auto-generated by generic fallback parser. Review and curate entries."),
    }
    if equipment:
        payload["equipment"] = equipment
    if knacks:
        payload["knacks"] = knacks
    if birthrights:
        payload["birthrights"] = birthrights
    if boons:
        payload["boons"] = boons
    if paths:
        payload["paths"] = paths

    _write(out_path, payload)
    return out_path


def _discover_unhandled_pdfs() -> list[Path]:
    """Find PDFs in book directories that aren't handled by explicit builders or core parser."""
    skip_names = KNOWN_PDFS | CORE_PDFS
    # Also skip any PDF whose slug already has a JSON output
    existing_slugs = {p.stem for p in BOOKS_OUT.glob("*.json")}

    unhandled: list[Path] = []
    seen_names: set[str] = set()

    for d in books_search_dirs(None):
        for pdf in sorted(d.glob("*.pdf")):
            # Deduplicate by filename (same PDF in multiple search dirs)
            if pdf.name in seen_names:
                continue
            seen_names.add(pdf.name)

            if pdf.name in skip_names:
                continue

            slug = _slug_from_filename(pdf.name)
            if slug in existing_slugs:
                continue

            unhandled.append(pdf)

    return unhandled


def _cleanup_stale_book_slices() -> None:
    """Remove JSON files in src/data/books/ whose source PDF no longer exists.

    Only removes files that were auto-generated by this script (identified by
    having a _meta.sourcePdf field). If the referenced PDF cannot be found in
    any search directory, the JSON is deleted.
    """
    if not BOOKS_OUT.is_dir():
        return

    # Build set of all PDF filenames currently available
    available_pdfs: set[str] = set()
    for d in books_search_dirs(None):
        for pdf in d.glob("*.pdf"):
            available_pdfs.add(pdf.name)

    removed: list[str] = []
    for json_path in sorted(BOOKS_OUT.glob("*.json")):
        if json_path.name.startswith("_"):
            continue
        try:
            with json_path.open(encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue
        meta = data.get("_meta")
        if not isinstance(meta, dict):
            continue
        source_pdf = meta.get("sourcePdf")
        if not source_pdf or not isinstance(source_pdf, str):
            continue
        # Check if the source PDF still exists in any search directory
        if source_pdf.strip() not in available_pdfs:
            json_path.unlink()
            removed.append(json_path.name)

    if removed:
        print(f"\n  Cleanup: removed {len(removed)} stale book slice(s):", flush=True)
        for name in removed:
            print(f"    ✗ {name} (source PDF no longer found)", flush=True)


def main() -> int:
    BOOKS_OUT.mkdir(parents=True, exist_ok=True)
    (BOOKS_OUT / "_README.txt").write_text(
        "One JSON file per book under src/data/books/. Merged into /api/bundle; delete file to remove.\n"
        "Regenerate: python3 src/scripts/build_book_bundle_slices.py\n"
        f"PDF dirs: {', '.join(str(d) for d in books_search_dirs(None))}\n",
        encoding="utf-8",
    )

    build_divine_garage()
    build_menagerie(
        "divine_menagerie",
        "Divine Menagerie",
        "7711-Divine_Menagerie.pdf",
        "7711-Divine_Menagerie_-_List_of_Antagonists.pdf",
        "brDmg1",
    )
    build_menagerie(
        "divine_menagerie_2",
        "Divine Menagerie 2",
        "7711-Divine_Menagerie_2.pdf",
        "7711-Divine_Menagerie_2_-_List_of_Antagonists.pdf",
        "brDmg2",
    )
    build_menagerie(
        "divine_menagerie_3",
        "Divine Menagerie 3",
        "7711-Divine_Menagerie_3.pdf",
        "7711-Divine_Menagerie_3_-_List_of_Antagonists.pdf",
        "brDmg3",
        layout_list=True,
    )
    build_menagerie(
        "divine_menagerie_4",
        "Divine Menagerie 4",
        "7711-Divine_Menagerie_4_-_pages.pdf",
        None,
        "brDmg4",
        appendix_in_main=True,
    )
    build_divine_reliquary()
    build_divine_arenas_tags()
    build_divine_identities_paths()
    build_divine_armory()
    build_britannia_dragons_knacks()
    build_reconditioned_row()

    # --- Generic fallback: sweep for unhandled PDFs ---
    unhandled = _discover_unhandled_pdfs()
    if unhandled:
        print(f"\n  Generic parser: found {len(unhandled)} unhandled PDF(s):", flush=True)
        for pdf_path in unhandled:
            result = build_generic_book(pdf_path)
            if result:
                slug = result.stem
                print(f"    ✓ {pdf_path.name} → {result.name}", flush=True)
            else:
                print(f"    – {pdf_path.name} (skipped — output already exists)", flush=True)

    # --- Cleanup: remove stale JSON files whose source PDF no longer exists ---
    _cleanup_stale_book_slices()

    print(f"\nWrote slices under {BOOKS_OUT}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
