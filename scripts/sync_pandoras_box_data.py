#!/usr/bin/env python3
"""
Refresh Purview Boon ladder *names* from a local Pandora's Box (Revised) PDF, then rebuild boons.json.

This app treats **Pandora’s Box (Revised)** as the **primary** rules source for universal Purview Boon ladders
and related catalog data; this script is the supported path to re-sync those names from your disk PDF.

Requires:
  pip install pypdf

Default PDF path (WSL): /mnt/c/Users/John/Desktop/Scion/books/SCION_Pandoras_Box_(Revised_Download).pdf

Usage (repo root):
  python3 scripts/sync_pandoras_box_data.py
  python3 scripts/sync_pandoras_box_data.py /path/to/SCION_Pandoras_Box_(Revised_Download).pdf

Steps:
  1) scripts/ingest_pandoras_box_pdf.py  → data/_extracted/pandoras_box.txt
  2) scripts/extract_pb_boon_ladders.py --write-purviews  → patches data/purviews.json (standard Purviews)
  3) scripts/generate_boons_catalog.py  → rewrites data/boons.json

Pantheon / Signature Purview rows added beyond Origin are applied with:
  python3 scripts/apply_pb_pantheon_bundle.py

Knacks: Pandora’s Box is the Calling compendium; this repo’s knacks.json is hand-curated.
Full mechanical import would need a dedicated PDF parser—not run here.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd))
    r = subprocess.run(cmd, cwd=str(ROOT))
    if r.returncode != 0:
        raise SystemExit(r.returncode)


def main() -> int:
    ap = argparse.ArgumentParser(description="Ingest PB PDF, merge ladder names, regenerate boons.json")
    ap.add_argument("pdf", nargs="?", default=None, help="Path to Pandora's Box Revised PDF")
    args = ap.parse_args()
    ingest = [sys.executable, str(ROOT / "scripts" / "ingest_pandoras_box_pdf.py")]
    if args.pdf:
        ingest.append(args.pdf)
    run(ingest)
    run([sys.executable, str(ROOT / "scripts" / "extract_pb_boon_ladders.py"), "--write-purviews"])
    run([sys.executable, str(ROOT / "scripts" / "generate_boons_catalog.py")])
    print("Done. Re-run apply_pb_pantheon_bundle.py only when changing pantheon tables (it is not idempotent).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
