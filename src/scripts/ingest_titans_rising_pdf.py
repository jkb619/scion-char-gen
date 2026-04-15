#!/usr/bin/env python3
"""
Extract plain text from Scion: Titans Rising PDF for grep / verification.

Usage:
  pip install pypdf
  python3 src/scripts/ingest_titans_rising_pdf.py --books-dir ./books
"""

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

from scion_books_dir import find_titans_rising_pdf

DEFAULT_OUT = SRC / "data" / "_extracted" / "titans_rising.txt"
DEFAULT_PDF_WSL = Path("/mnt/c/Users/John/Desktop/Scion/books/TItans_Rising_(Final_Download).pdf")


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract text from Titans Rising PDF")
    parser.add_argument(
        "pdf",
        type=Path,
        nargs="?",
        default=None,
        help="Path to PDF (default: discover via SCION_BOOKS_DIR / ./books / …)",
    )
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Output text file")
    parser.add_argument("--books-dir", type=Path, default=None, help="Directory containing licensed PDF copies")
    args = parser.parse_args()
    pdf: Path | None = args.pdf
    out: Path = args.out
    books = Path(args.books_dir) if args.books_dir else None
    if pdf is None or not str(pdf).strip():
        pdf = find_titans_rising_pdf(books)
        if pdf is None and DEFAULT_PDF_WSL.is_file():
            pdf = DEFAULT_PDF_WSL
    if pdf is None or not pdf.is_file():
        print(
            "Pass the path to TItans_Rising_(Final_Download).pdf or place it under books/.",
            file=sys.stderr,
        )
        print(f"  Tried: {DEFAULT_PDF_WSL}", file=sys.stderr)
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
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(raw, encoding="utf-8")
    print(f"Wrote {len(raw):,} characters to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
