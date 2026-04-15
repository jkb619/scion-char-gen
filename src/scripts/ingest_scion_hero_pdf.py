#!/usr/bin/env python3
"""Extract plain text from Scion: Hero PDF (Wyrd Signature, cross-references)."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from scion_books_dir import find_scion_hero_pdf

DEFAULT_OUT = SRC / "data" / "_extracted" / "scion_hero.txt"
DEFAULT_PDF_WSL = Path("/mnt/c/Users/John/Desktop/Scion/books/Scion_Hero_(Final_Download).pdf")


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract text from Scion: Hero PDF")
    parser.add_argument("pdf", type=Path, nargs="?", default=None)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--books-dir", type=Path, default=None)
    args = parser.parse_args()
    pdf: Path | None = args.pdf
    books = Path(args.books_dir) if args.books_dir else None
    if pdf is None or not str(pdf).strip():
        pdf = find_scion_hero_pdf(books)
        if pdf is None and DEFAULT_PDF_WSL.is_file():
            pdf = DEFAULT_PDF_WSL
    if pdf is None or not pdf.is_file():
        print("Pass Scion_Hero_(Final_Download).pdf or place it under books/.", file=sys.stderr)
        return 1
    try:
        from pypdf import PdfReader
    except ImportError:
        print("Install pypdf:  pip install pypdf", file=sys.stderr)
        return 1
    reader = PdfReader(str(pdf))
    parts: list[str] = []
    for i, page in enumerate(reader.pages):
        try:
            t = page.extract_text() or ""
        except Exception as e:  # noqa: BLE001
            t = f"\n[page {i + 1}: extract error: {e}]\n"
        parts.append(f"\n\n===== Page {i + 1} / {len(reader.pages)} =====\n\n")
        parts.append(t)
    raw = "".join(parts)
    raw = re.sub(r"\n{4,}", "\n\n\n", raw)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(raw, encoding="utf-8")
    print(f"Wrote {len(raw):,} characters to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
