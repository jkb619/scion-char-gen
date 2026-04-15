#!/usr/bin/env python3
"""
Extract plain text from a local Scion: Masks of the Mythos PDF for manual curation.

This does **not** auto-edit pantheons.json / virtues.json (copyright and table fidelity).
Workflow: purchase PDF → run this script → search the output for "Signature", "Virtue",
"Calling", deity names, etc. → transcribe vetted snippets into data/*.json.

Usage:
  pip install pypdf   # or use project venv with requirements.txt
  python scripts/ingest_masks_of_the_mythos_pdf.py /path/to/Masks_of_the_Mythos.pdf
  python scripts/ingest_masks_of_the_mythos_pdf.py ../books/MotM.pdf --out data/_extracted/masks_of_the_mythos.txt
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

from scion_books_dir import find_masks_of_the_mythos_pdf

DEFAULT_OUT = SRC / "data" / "_extracted" / "masks_of_the_mythos.txt"
# Typical Windows install path when running from WSL:
DEFAULT_PDF_WSL = Path("/mnt/c/Users/John/Desktop/Scion/books/Scion_Masks_of_the_Mythos_(Final_Download).pdf")


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract text from Masks of the Mythos PDF")
    parser.add_argument(
        "pdf",
        type=Path,
        nargs="?",
        default=None,
        help="Path to the PDF file (default: SCION_BOOKS_DIR / ./books / ../books / desktop WSL path)",
    )
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Output text file")
    parser.add_argument("--books-dir", type=Path, default=None, help="Directory containing licensed PDF copies")
    args = parser.parse_args()
    pdf: Path | None = args.pdf
    out: Path = args.out
    books = Path(args.books_dir) if args.books_dir else None
    if pdf is None or not str(pdf).strip():
        pdf = find_masks_of_the_mythos_pdf(books)
        if pdf is None and DEFAULT_PDF_WSL.is_file():
            pdf = DEFAULT_PDF_WSL
    if pdf is None or not pdf.is_file():
        print("Pass the path to Scion_Masks_of_the_Mythos_(Final_Download).pdf or place it at:", file=sys.stderr)
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
    # Normalize excessive blank lines for easier grep
    raw = re.sub(r"\n{4,}", "\n\n\n", raw)

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(raw, encoding="utf-8")
    print(f"Wrote {len(raw):,} characters to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
