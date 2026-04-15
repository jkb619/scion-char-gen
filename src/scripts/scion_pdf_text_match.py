"""
Shared PDF text extract normalization and substring / word-boundary matching
for verify_*_against_extracts.py scripts.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
SCRIPTS = SRC / "scripts"
EXTRACTED = SRC / "data" / "_extracted"

INGESTS: tuple[tuple[str, Path], ...] = (
    ("ingest_pandoras_box_pdf.py", EXTRACTED / "pandoras_box.txt"),
    ("ingest_scion_origin_pdf.py", EXTRACTED / "scion_origin_revised.txt"),
    ("ingest_scion_hero_pdf.py", EXTRACTED / "scion_hero.txt"),
    ("ingest_mysteries_of_the_world_pdf.py", EXTRACTED / "mysteries_of_the_world.txt"),
    ("ingest_masks_of_the_mythos_pdf.py", EXTRACTED / "masks_of_the_mythos.txt"),
    ("ingest_saints_monsters_pdf.py", EXTRACTED / "saints_monsters.txt"),
    ("ingest_titans_rising_pdf.py", EXTRACTED / "titans_rising.txt"),
    ("ingest_scion_dragon_pdf.py", EXTRACTED / "scion_dragon.txt"),
)


def fold_unicode(s: str) -> str:
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def nordic_latin_fold(s: str) -> str:
    s = s.lower()
    return (
        s.replace("æ", "ae")
        .replace("ø", "o")
        .replace("å", "a")
        .replace("ð", "d")
        .replace("þ", "th")
    )


def normalize_for_search(s: str) -> str:
    s = fold_unicode(s)
    s = (
        s.replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )
    s = nordic_latin_fold(s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r" +", " ", s).strip()


def nospace_norm(s: str) -> str:
    s = fold_unicode(s)
    s = (
        s.replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )
    s = nordic_latin_fold(s)
    return re.sub(r"[^a-z0-9]+", "", s)


def name_variants(name: str) -> list[str]:
    n = (name or "").strip()
    if not n:
        return []
    out: list[str] = []

    def push(s: str) -> None:
        s = s.strip()
        if s and s not in out:
            out.append(s)

    push(n)
    no_paren = re.sub(r"\([^)]*\)", " ", n)
    no_paren = re.sub(r"\s+", " ", no_paren).strip()
    if no_paren != n:
        push(no_paren)
    if ":" in n:
        push(n.split(":", 1)[0].strip())
    return out


def matches(hay_norm: str, hay_nospace: str, name: str) -> bool:
    for v in name_variants(name):
        nv = normalize_for_search(v)
        if len(nv) >= 2 and nv in hay_norm:
            return True
        nn = nospace_norm(v)
        if len(nn) >= 10 and nn in hay_nospace:
            return True
    return False


def matches_smart(hay_norm: str, hay_nospace: str, text: str) -> bool:
    """Prefer word boundaries for short single-token labels (Callings, Purview names)."""
    nv = normalize_for_search(text)
    if len(nv) < 2:
        return False
    if " " in nv or len(nv) >= 10:
        return matches(hay_norm, hay_nospace, text)
    if re.search(rf"(?<![a-z0-9]){re.escape(nv)}(?![a-z0-9])", hay_norm):
        return True
    nn = nospace_norm(text)
    if len(nn) >= 10 and nn in hay_nospace:
        return True
    return False


def load_hay(path: Path) -> tuple[str | None, str | None]:
    if not path.is_file():
        return None, None
    raw = path.read_text(encoding="utf-8", errors="replace")
    return normalize_for_search(raw), nospace_norm(raw)


def merge_hays(
    parts_n: list[str | None], parts_ns: list[str | None], label: str
) -> tuple[str | None, str | None, str]:
    nn = [x for x in parts_n if x]
    ns_ = [x for x in parts_ns if x]
    if not nn or not ns_:
        return None, None, label
    return " ".join(nn), "".join(ns_), label


def run_ingests(books_dir: Path | None) -> None:
    py = sys.executable
    for script, _out in INGESTS:
        sp = SCRIPTS / script
        if not sp.is_file():
            continue
        cmd = [py, str(sp)]
        if books_dir is not None:
            cmd.extend(["--books-dir", str(books_dir)])
        print("Running:", " ".join(cmd), flush=True)
        subprocess.run(cmd, cwd=str(ROOT), check=False)


def verify_file_by_name_field(
    rel: str,
    data_path: Path,
    hay_norm: str | None,
    hay_nospace: str | None,
    hay_label: str,
    *,
    use_smart: bool = False,
) -> list[tuple[str, str, str]]:
    raw = json.loads(data_path.read_text(encoding="utf-8"))
    bad: list[tuple[str, str, str]] = []
    fn = matches_smart if use_smart else matches
    for kid, val in raw.items():
        if kid.startswith("_") or not isinstance(val, dict):
            continue
        name = val.get("name") or ""
        if not name.strip():
            bad.append((kid, name, "empty name"))
            continue
        if hay_norm is None or hay_nospace is None:
            bad.append((kid, name, f"missing {hay_label}"))
            continue
        if not fn(hay_norm, hay_nospace, name):
            bad.append((kid, name, f"not in {hay_label}"))
    return bad
