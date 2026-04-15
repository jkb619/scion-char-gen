"""
Resolve the local Scion PDF library directory and common PDF filenames.

Search order (first hit wins for each file name):
  1. Optional CLI / caller override directory
  2. ``SCION_BOOKS_DIR`` (absolute path to a folder containing PDFs)
  3. ``<repo>/books``
  4. ``<repo>/../books`` (sibling directory to the repo)
  5. WSL path ``/mnt/c/Users/John/Desktop/Scion/books`` (legacy desktop layout)

Scripts accept an explicit PDF path; when omitted, these locations are tried
so PDFs do not need to live inside git — you can drop copies under ``books/``.
"""

from __future__ import annotations

import os
from pathlib import Path

# ``src/scripts/`` → parents[2] == repository root (character-creator)
_REPO_ROOT = Path(__file__).resolve().parents[2]

PANDORAS_BOX_FILENAMES = (
    "SCION_Pandoras_Box_(Revised_Download).pdf",
    "SCION_Pandoras_Box_Revised.pdf",
    "Pandoras_Box_Revised.pdf",
)

MYSTERIES_FILENAMES = (
    "Mysteries_of_the_World_-_Scion_Companion_(Final_Download).pdf",
    "Mysteries_of_the_World_-_Scion_Companion.pdf",
)

MASKS_FILENAMES = (
    "Scion_Masks_of_the_Mythos_(Final_Download).pdf",
    "Scion_Masks_of_the_Mythos.pdf",
    "Masks_of_the_Mythos.pdf",
)

SAINTS_FILENAMES = (
    "Scion_Players_Guide__Saints__Monsters_(Final_Download).pdf",
    "Scion_Players_Guide_Saints_Monsters.pdf",
    "Saints_and_Monsters.pdf",
)

# Onyx Path shipped this filename with a capital I in "TItans".
TITANS_RISING_FILENAMES = (
    "TItans_Rising_(Final_Download).pdf",
    "Titans_Rising_(Final_Download).pdf",
    "Scion_TItans_Rising_(Final_Download).pdf",
    "Scion_Titans_Rising_(Final_Download).pdf",
)

DRAGON_CORE_FILENAMES = (
    "Scion_Dragon_(Final_Download).pdf",
    "Scion_Dragon.pdf",
)

ORIGIN_REVISED_FILENAMES = (
    "Scion_Origin_(Revised_Download).pdf",
    "Scion_Origin_Revised.pdf",
)

SCION_HERO_FILENAMES = (
    "Scion_Hero_(Final_Download).pdf",
    "Scion_Hero.pdf",
)


def books_search_dirs(explicit_dir: Path | None = None) -> list[Path]:
    """Return unique existing directories to search for PDFs."""
    seen: set[str] = set()
    out: list[Path] = []

    def push(p: Path) -> None:
        try:
            r = p.resolve()
        except OSError:
            return
        key = str(r)
        if key in seen:
            return
        seen.add(key)
        if r.is_dir():
            out.append(r)

    if explicit_dir is not None and str(explicit_dir).strip():
        push(Path(explicit_dir))

    env = (os.environ.get("SCION_BOOKS_DIR") or "").strip()
    if env:
        push(Path(env).expanduser())

    push(_REPO_ROOT / "books")
    push(_REPO_ROOT.parent / "books")
    push(Path("/mnt/c/Users/John/Desktop/Scion/books"))
    return out


def find_pdf_in_books(filenames: tuple[str, ...], explicit_dir: Path | None = None) -> Path | None:
    for d in books_search_dirs(explicit_dir):
        for name in filenames:
            p = d / name
            if p.is_file():
                return p
    return None


def find_pandoras_box_revised_pdf(explicit_dir: Path | None = None) -> Path | None:
    return find_pdf_in_books(PANDORAS_BOX_FILENAMES, explicit_dir)


def find_mysteries_companion_pdf(explicit_dir: Path | None = None) -> Path | None:
    return find_pdf_in_books(MYSTERIES_FILENAMES, explicit_dir)


def find_masks_of_the_mythos_pdf(explicit_dir: Path | None = None) -> Path | None:
    return find_pdf_in_books(MASKS_FILENAMES, explicit_dir)


def find_saints_monsters_pdf(explicit_dir: Path | None = None) -> Path | None:
    return find_pdf_in_books(SAINTS_FILENAMES, explicit_dir)


def find_titans_rising_pdf(explicit_dir: Path | None = None) -> Path | None:
    return find_pdf_in_books(TITANS_RISING_FILENAMES, explicit_dir)


def find_scion_dragon_core_pdf(explicit_dir: Path | None = None) -> Path | None:
    return find_pdf_in_books(DRAGON_CORE_FILENAMES, explicit_dir)


def find_scion_origin_revised_pdf(explicit_dir: Path | None = None) -> Path | None:
    return find_pdf_in_books(ORIGIN_REVISED_FILENAMES, explicit_dir)


def find_scion_hero_pdf(explicit_dir: Path | None = None) -> Path | None:
    return find_pdf_in_books(SCION_HERO_FILENAMES, explicit_dir)
