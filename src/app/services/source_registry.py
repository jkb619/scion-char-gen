"""
Canonical sourcebook registry for the Book Source Filter feature.

Auto-discovers book metadata from ``src/data/books/*.json`` (via ``_meta`` blocks)
and merges with a hardcoded list of core/legacy books that predate the books directory
convention.
"""

from __future__ import annotations

import json
import warnings
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class BookEntry:
    """One known sourcebook in the registry."""

    slug: str
    title: str
    pdf_patterns: list[str] = field(default_factory=list)
    group: str = "third_party"


# Core / legacy books that predate the books/ directory convention.
# These appear only in table fragments and free-text ``source`` strings.
CORE_BOOKS: list[BookEntry] = [
    BookEntry(
        slug="pandoras_box",
        title="Pandora's Box",
        pdf_patterns=["SCION_Pandoras_Box_(Revised_Download).pdf"],
        group="official",
    ),
    BookEntry(
        slug="scion_origin",
        title="Scion: Origin",
        pdf_patterns=["Scion_Origin_(Revised_Download).pdf"],
        group="core",
    ),
    BookEntry(
        slug="scion_hero",
        title="Scion: Hero",
        pdf_patterns=["Scion_Hero_(Final_Download).pdf"],
        group="core",
    ),
    BookEntry(
        slug="scion_demigod",
        title="Scion: Demigod",
        pdf_patterns=["Scion_Demigod_Second_Edition_(Final_Download).pdf"],
        group="core",
    ),
    BookEntry(
        slug="scion_god",
        title="Scion: God",
        pdf_patterns=["Scion_God_Second_Edition_(Final_Download).pdf"],
        group="core",
    ),
    BookEntry(
        slug="scion_dragon",
        title="Scion: Dragon",
        pdf_patterns=["Scion_Dragon_(Final_Download).pdf"],
        group="core_plus",
    ),
    BookEntry(
        slug="dragon_companion",
        title="Scion: Dragon Companion",
        pdf_patterns=["Scion_Dragon_Companion_(Final_Download).pdf"],
        group="official",
    ),
    BookEntry(
        slug="mysteries_of_the_world",
        title="Mysteries of the World",
        pdf_patterns=["Mysteries_of_the_World_-_Scion_Companion_(Final_Download).pdf"],
        group="official",
    ),
    BookEntry(
        slug="masks_of_the_mythos",
        title="Masks of the Mythos",
        pdf_patterns=["Scion_Masks_of_the_Mythos_(Final_Download).pdf"],
        group="core_plus",
    ),
    BookEntry(
        slug="saints_monsters",
        title="Saints & Monsters",
        pdf_patterns=["Scion_Players_Guide__Saints__Monsters_(Final_Download).pdf"],
        group="official",
    ),
    BookEntry(
        slug="titans_rising",
        title="Titans Rising",
        pdf_patterns=[
            "TItans_Rising_(Final_Download).pdf",
            "Titans_Rising_(Final_Download).pdf",
        ],
        group="core_plus",
    ),
    BookEntry(
        slug="once_and_future",
        title="Once and Future",
        pdf_patterns=[],
        group="official",
    ),
    BookEntry(
        slug="divine_armory",
        title="Divine Armory",
        pdf_patterns=["7711-Divine_Armory.pdf"],
        group="third_party",
    ),
    BookEntry(
        slug="divine_garage",
        title="Divine Garage",
        pdf_patterns=["7711-Divine_Garage.pdf"],
        group="third_party",
    ),
    BookEntry(
        slug="divine_menagerie",
        title="Divine Menagerie",
        pdf_patterns=["7711-Divine_Menagerie.pdf"],
        group="third_party",
    ),
    BookEntry(
        slug="divine_reliquary",
        title="Divine Reliquary",
        pdf_patterns=[],
        group="third_party",
    ),
    BookEntry(
        slug="divine_arenas",
        title="Divine Arenas",
        pdf_patterns=["7711-Divine_Arenas.pdf"],
        group="third_party",
    ),
    BookEntry(
        slug="divine_identities",
        title="Divine Identities",
        pdf_patterns=["7711-Divine_Identities.pdf"],
        group="third_party",
    ),
    BookEntry(
        slug="reconditioned",
        title="Reconditioned",
        pdf_patterns=["255389-RECONDITIONED_2.pdf"],
        group="third_party",
    ),
    BookEntry(
        slug="scion_britannias_dragons",
        title="Scion: Britannia's Dragons",
        pdf_patterns=["248670-Scion_Britannias_Dragons.pdf"],
        group="official",
    ),
]


# Group overrides for auto-discovered books (from build_book_bundle_slices.py generic parser).
# Maps slug → group for books that shouldn't be "third_party".
GROUP_OVERRIDES: dict[str, str] = {
    "scion_demigod_companion": "official",
    "scion_tasty_bit_compilation": "official",
    "scion_dragon_tasty_bit_compilation": "official",
    "scion_god_players_guide": "official",
    "scion_mythical_denizens": "official",
    "scion_titanomachy": "official",
    "rock_gods_and_road_trips": "official",
    "realms_of_mystery_magic": "official",
    "pandoras_box_finale": "official",
    "once_and_future": "official",  # already official in CORE_BOOKS but listing for completeness
    "scion_wild_hunt": "official",
    "scion_cc": "third_party",
}


# Slugs that are duplicates or alternate editions of books already in CORE_BOOKS.
# The generic parser may discover these but they should be merged into the canonical entry.
SKIP_SLUGS: frozenset[str] = frozenset({
    "pandoras_box_finale",  # Same content as pandoras_box
})


class SourceRegistry:
    """Auto-discovered from src/data/books/*.json _meta blocks + hardcoded core books."""

    def __init__(
        self,
        books_dir: Path,
        core_books: list[BookEntry] | None = None,
    ) -> None:
        self._entries: dict[str, BookEntry] = {}

        # Seed with core books (or caller-supplied override for testing).
        for entry in core_books if core_books is not None else CORE_BOOKS:
            self._entries[entry.slug] = entry

        # Auto-discover books from the directory.
        if books_dir.is_dir():
            for path in sorted(books_dir.glob("*.json")):
                if not path.is_file() or path.name.startswith("_"):
                    continue
                self._load_book_file(path)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def entries(self) -> dict[str, BookEntry]:
        """slug → BookEntry, including core + discovered books."""
        return dict(self._entries)

    def slug_for_pdf(self, pdf_filename: str) -> str | None:
        """Return the registry slug whose pdf_patterns match *pdf_filename* (case-insensitive)."""
        lower = pdf_filename.lower()
        for entry in self._entries.values():
            for pattern in entry.pdf_patterns:
                if pattern.lower() == lower:
                    return entry.slug
        return None

    def slug_for_title_substring(self, text: str) -> str | None:
        """Return the slug whose title is a case-insensitive substring of *text*.

        When multiple titles match, the longest title wins (most specific match).
        """
        text_lower = text.lower()
        best_slug: str | None = None
        best_len = 0
        for entry in self._entries.values():
            title_lower = entry.title.lower()
            if title_lower in text_lower and len(title_lower) > best_len:
                best_slug = entry.slug
                best_len = len(title_lower)
        return best_slug

    def titles_sorted(self) -> list[tuple[str, str]]:
        """Return (slug, title) pairs sorted alphabetically by title."""
        return sorted(
            ((e.slug, e.title) for e in self._entries.values()),
            key=lambda pair: pair[1].lower(),
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _load_book_file(self, path: Path) -> None:
        """Load a single book JSON file, merging its _meta into the registry."""
        try:
            with path.open(encoding="utf-8") as f:
                raw: Any = json.load(f)
        except (json.JSONDecodeError, OSError) as exc:
            warnings.warn(
                f"Skipping malformed book file {path.name}: {exc}",
                stacklevel=2,
            )
            return

        if not isinstance(raw, dict):
            warnings.warn(
                f"Skipping book file {path.name}: top-level value is not an object",
                stacklevel=2,
            )
            return

        meta = raw.get("_meta")
        if not isinstance(meta, dict):
            warnings.warn(
                f"Skipping book file {path.name}: missing or invalid _meta block",
                stacklevel=2,
            )
            return

        slug = meta.get("slug")
        title = meta.get("title")
        if not slug or not isinstance(slug, str):
            warnings.warn(
                f"Skipping book file {path.name}: _meta.slug missing or not a string",
                stacklevel=2,
            )
            return
        if not title or not isinstance(title, str):
            warnings.warn(
                f"Skipping book file {path.name}: _meta.title missing or not a string",
                stacklevel=2,
            )
            return

        slug = slug.strip()
        title = title.strip()

        if slug in SKIP_SLUGS:
            return

        # Build pdf_patterns from sourcePdf field (string or list).
        pdf_patterns: list[str] = []
        source_pdf = meta.get("sourcePdf")
        if isinstance(source_pdf, str) and source_pdf.strip():
            pdf_patterns = [source_pdf.strip()]
        elif isinstance(source_pdf, list):
            pdf_patterns = [p.strip() for p in source_pdf if isinstance(p, str) and p.strip()]

        # If the slug already exists from core books, merge pdf_patterns intelligently.
        if slug in self._entries:
            existing = self._entries[slug]
            # Merge any new PDF patterns from the discovered file.
            merged_patterns = list(existing.pdf_patterns)
            for p in pdf_patterns:
                if p not in merged_patterns:
                    merged_patterns.append(p)
            self._entries[slug] = BookEntry(
                slug=slug,
                title=existing.title,  # Prefer core book title for consistency.
                pdf_patterns=merged_patterns,
                group=existing.group,
            )
        else:
            group = GROUP_OVERRIDES.get(slug, "third_party")
            self._entries[slug] = BookEntry(
                slug=slug,
                title=title,
                pdf_patterns=pdf_patterns,
                group=group,
            )
