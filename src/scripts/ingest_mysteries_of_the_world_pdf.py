#!/usr/bin/env python3
"""
Extract plain text from a local Mysteries of the World (Scion Companion) PDF.

Usage:
  python scripts/ingest_mysteries_of_the_world_pdf.py /path/to/Mysteries_of_the_World.pdf
  python scripts/ingest_mysteries_of_the_world_pdf.py --out data/_extracted/mysteries_of_the_world.txt
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
DEFAULT_OUT = SRC / "data" / "_extracted" / "mysteries_of_the_world.txt"
DEFAULT_PDF_WSL = Path(
    "/mnt/c/Users/John/Desktop/Scion/books/Mysteries_of_the_World_-_Scion_Companion_(Final_Download).pdf"
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract text from Mysteries of the World PDF")
    parser.add_argument(
        "pdf",
        type=Path,
        nargs="?",
        default=None,
        help=f"Path to the PDF (default: {DEFAULT_PDF_WSL} if that file exists)",
    )
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Output text file")
    args = parser.parse_args()
    pdf: Path | None = args.pdf
    out: Path = args.out
    if pdf is None or not str(pdf).strip():
        pdf = DEFAULT_PDF_WSL if DEFAULT_PDF_WSL.is_file() else None
    if pdf is None or not pdf.is_file():
        print("Pass the path to Mysteries_of_the_World_-_Scion_Companion_(Final_Download).pdf or place it at:", file=sys.stderr)
        print(f"  {DEFAULT_PDF_WSL}", file=sys.stderr)
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
