#!/usr/bin/env python3
"""
Rebuild Purview Boon ladder names and ``data/boons.json`` from locally installed Scion PDFs.

This is the supported way to pull **everything the extractors can read** from Pandora’s Box (Revised)
into the repo: plain-text ingest → ladder patch → optional mechanics scan → catalog regeneration.

PDF resolution (first match wins):
  ``--books-dir`` / ``SCION_BOOKS_DIR`` / ``<repo>/books`` / ``<repo>/../books`` / WSL desktop path.

Required for a full sync:
  - ``SCION_Pandoras_Box_(Revised_Download).pdf`` (or a listed alias in ``scion_books_dir.py``)

Optional (recommended when present):
  - PyMuPDF (``pip install pymupdf``) for ``extract_pb_boon_mechanics.py``

Usage (from repo root)::

  pip install pypdf pymupdf
  export SCION_BOOKS_DIR=/path/to/your/books
  python3 src/scripts/sync_boon_catalog_from_local_books.py
  python3 src/scripts/sync_boon_catalog_from_local_books.py --books-dir ./books

Supplements (MotW / MotM / Saints) have separate ingest scripts; this orchestrator focuses on the
PB → ``purviews.json`` / ``boons.json`` / ``boonPbMechanics.json`` pipeline documented in
``sync_pandoras_box_data.py``.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
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

PURVIEWS_PATH = primary_write_path("purviews")


def run(cmd: list[str], *, env: dict[str, str] | None = None) -> None:
    print("+", " ".join(cmd))
    r = subprocess.run(cmd, cwd=str(ROOT), env=env)
    if r.returncode != 0:
        raise SystemExit(r.returncode)


def pad_boon_ladder_arrays_to_12() -> None:
    """Keep ``boonLadderNames`` indexable at dots 9–12 for standard Purviews (trailing blanks)."""
    data = json.loads(PURVIEWS_PATH.read_text(encoding="utf-8"))
    changed = False
    for k, v in list(data.items()):
        if str(k).startswith("_") or not isinstance(v, dict):
            continue
        arr = v.get("boonLadderNames")
        if not isinstance(arr, list):
            continue
        if 0 < len(arr) < 12:
            v["boonLadderNames"] = arr + [""] * (12 - len(arr))
            changed = True
    if changed:
        PURVIEWS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print("Padded short boonLadderNames arrays to length 12 in", PURVIEWS_PATH)


def main() -> int:
    ap = argparse.ArgumentParser(description="Sync PB Boon ladders + boons.json from local PDFs")
    ap.add_argument(
        "--books-dir",
        type=Path,
        default=None,
        help="Folder containing SCION_Pandoras_Box_(Revised_Download).pdf (also: SCION_BOOKS_DIR or ./books)",
    )
    ap.add_argument(
        "--skip-mechanics",
        action="store_true",
        help="Skip extract_pb_boon_mechanics.py (needs pymupdf)",
    )
    ap.add_argument("pdf", nargs="?", default=None, help="Explicit path to Pandora’s Box Revised PDF")
    args = ap.parse_args()

    books = Path(args.books_dir) if args.books_dir else None
    pdf = Path(args.pdf) if args.pdf else find_pandoras_box_revised_pdf(books)
    if pdf is None or not pdf.is_file():
        print(
            "Could not find Pandora’s Box (Revised) PDF. Copy it into ./books or set SCION_BOOKS_DIR.",
            file=sys.stderr,
        )
        return 1

    child_env = os.environ.copy()
    if books and str(books).strip():
        child_env["SCION_BOOKS_DIR"] = str(books.resolve())

    ingest = [sys.executable, str(SRC / "scripts" / "ingest_pandoras_box_pdf.py"), str(pdf)]
    if books:
        ingest += ["--books-dir", str(books)]
    run(ingest, env=child_env)

    run([sys.executable, str(SRC / "scripts" / "extract_pb_boon_ladders.py"), "--write-purviews"], env=child_env)

    pad_boon_ladder_arrays_to_12()

    if not args.skip_mechanics:
        mech_cmd = [
            sys.executable,
            str(SRC / "scripts" / "extract_pb_boon_mechanics.py"),
            "--pdf",
            str(pdf),
        ]
        if books:
            mech_cmd += ["--books-dir", str(books)]
        print("+", " ".join(mech_cmd))
        mr = subprocess.run(mech_cmd, cwd=str(ROOT), env=child_env)
        if mr.returncode != 0:
            print(
                "Mechanics extract failed (install pymupdf or pass --skip-mechanics). Continuing to catalog.",
                file=sys.stderr,
            )

    run([sys.executable, str(SRC / "scripts" / "generate_boons_catalog.py")], env=child_env)
    print("Done. Re-run apply_pb_pantheon_bundle.py only when editing pantheon tables (not idempotent).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
