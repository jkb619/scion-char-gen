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
    build_britannia_dragons_knacks()
    build_reconditioned_row()

    print(f"Wrote slices under {BOOKS_OUT}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
