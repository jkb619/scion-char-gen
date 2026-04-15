#!/usr/bin/env python3
"""
Scan SCION_Pandoras_Box_(Revised_Download).pdf for Boon headings (TITLE\\nCost: …)
and build data/boonPbMechanics.json keyed by catalog id ({purview}_dot_NN).

Run from repo root (requires pymupdf):
  python3 scripts/extract_pb_boon_mechanics.py

Manual review: some titles differ from purviews.json (apostrophes, “Of” casing).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from app.services.data_tables import primary_write_path
from scion_books_dir import find_pandoras_box_revised_pdf

PUR = primary_write_path("purviews")
DEFAULT_PDF_WSL = Path("/mnt/c/Users/John/Desktop/Scion/books/SCION_Pandoras_Box_(Revised_Download).pdf")
OUT = SRC / "data" / "boonPbMechanics.json"


def norm_heading(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = s.replace("\u00ad", "").replace("–", "-")
    s = s.replace("\u2019", "'").replace("\u2018", "'")
    s = " ".join(s.upper().split())
    return s.strip()


def pdf_text(path: Path) -> str:
    import fitz  # type: ignore

    doc = fitz.open(str(path))
    parts = []
    for p in doc:
        parts.append(p.get_text())
    t = "\n".join(parts)
    t = t.replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"')
    return t


def extract_mechanicals(block: str) -> str:
    lines = []
    for label in ("Cost", "Duration", "Subject", "Range", "Action", "Clash"):
        pat = re.compile(rf"^{label}\s*:\s*(.+)$", re.I | re.M)
        mm = pat.search(block)
        if mm:
            val = re.sub(r"\s+", " ", mm.group(1).strip())
            lines.append(f"{label}: {val}")
    return "\n".join(lines)


def effect_body(block: str) -> str:
    """Text after the Cost/Duration/… header block, before judge/creator specific (heuristic)."""
    cut = 0
    for lab in ("Cost", "Duration", "Subject", "Range", "Clash", "Action"):
        pat = re.compile(rf"^{lab}\s*:\s*.+$", re.I | re.M)
        for mm in pat.finditer(block):
            cut = max(cut, mm.end())
    if cut == 0:
        return ""
    body = block[cut:].strip()
    body = re.split(r"\n(?:[A-Z][a-z].* Specific:)", body)[0]
    body = re.sub(r"\s+", " ", body).strip()
    body = re.sub(r"^Boons\s+\d+\s+", "", body, flags=re.I)
    if len(body) > 420:
        body = body[:417].rsplit(" ", 1)[0] + "…"
    return body


def find_block(full: str, title: str) -> str | None:
    h = norm_heading(title)
    # Headings may have trailing spaces before newline (PDF extraction).
    m = re.search(rf"(?m)^\s*{re.escape(h)}\s*\n", full)
    if not m:
        return None
    start = m.start()
    tail = full[start:]
    # Next Boon in PB is another ALL CAPS line followed by "Cost:" (not page headers like "Boons 239").
    skip = min(len(tail), max(len(h), 1) + 5)
    m2 = re.search(r"\n[A-Z][A-Z0-9 '\-]{5,70}\s*\nCost:", tail[skip:])
    if m2:
        block = tail[: skip + m2.start()]
    else:
        block = tail[:4500]
    return block


def main() -> None:
    ap = argparse.ArgumentParser(description="Extract Cost/Duration/… lines from Pandora’s Box into boonPbMechanics.json")
    ap.add_argument("--pdf", type=Path, default=None, help="Path to Pandora’s Box Revised PDF")
    ap.add_argument("--books-dir", type=Path, default=None, help="Directory containing licensed PDF copies")
    args = ap.parse_args()
    books = Path(args.books_dir) if args.books_dir else None
    pdf = Path(args.pdf) if args.pdf else find_pandoras_box_revised_pdf(books)
    if pdf is None and DEFAULT_PDF_WSL.is_file():
        pdf = DEFAULT_PDF_WSL
    if pdf is None or not pdf.is_file():
        print("Missing Pandora’s Box PDF. Set --pdf, --books-dir, SCION_BOOKS_DIR, or place the file under ./books", file=sys.stderr)
        raise SystemExit(1)
    pur = json.loads(PUR.read_text(encoding="utf-8"))
    full = pdf_text(pdf)
    out: dict[str, dict[str, str]] = {"_meta": {"note": "PB Revised Boon Cost/Duration lines + short effect blurbs for sheet parser; regenerate with scripts/extract_pb_boon_mechanics.py"}}
    for pid, row in pur.items():
        if str(pid).startswith("_") or not isinstance(row, dict):
            continue
        ladder = row.get("boonLadderNames")
        if not isinstance(ladder, list):
            continue
        disp = str(row.get("name") or pid)
        for n, raw in enumerate(ladder, start=1):
            name = str(raw or "").strip()
            if not name:
                continue
            bid = f"{pid}_dot_{n:02d}"
            block = find_block(full, name)
            if not block:
                print("MISS", bid, repr(name))
                continue
            head = "\n".join(block.split("\n")[:8])
            if not re.search(r"^\s*Cost\s*:", head, re.I | re.M):
                print("NOHEAD", bid, repr(name))
                continue
            mech = extract_mechanicals(block)
            if not mech:
                print("NOMECH", bid, repr(name))
                continue
            desc = effect_body(block)
            if not desc:
                desc = f"“{name}” ({disp} Purview): see Pandora’s Box (Revised) for full text, tags, and judge-specific riders."
            out[bid] = {"description": desc, "mechanicalEffects": mech}
            print("OK", bid)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(out) - 1} entries to {OUT}")


if __name__ == "__main__":
    main()
