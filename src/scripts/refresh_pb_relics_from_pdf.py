#!/usr/bin/env python3
"""
Fill pb_relic_* (and god_relic_mjolnir) description / mechanicalEffects / relicDetails hints
from local PDFs. Summaries are derived from the books (short narrative + condensed mechanics).

Requires: pymupdf (fitz). PDF paths: workspace rules (WSL).
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))
from app.services.data_tables import primary_write_path

DATA = SRC / "data"
BR_PATH = DATA / "birthrights.json"
PV_PATH = primary_write_path("purviews")
PB_PDF = Path("/mnt/c/Users/John/Desktop/Scion/books/SCION_Pandoras_Box_(Revised_Download).pdf")
GOD_PDF = Path("/mnt/c/Users/John/Desktop/Scion/books/Scion_God_Second_Edition_(Final_Download).pdf")

JUNK_LINE = re.compile(
    r"^(PANDORA\u2019S BOX|CHAPTER [^\n]+|Birthrights)\s+\d+\s*$|^\d{1,3}\s*$",
    re.I,
)

# PDF quirks / TOC typos not matched by token flex search
TITLE_REGEX_OVERRIDES: dict[str, str] = {
    "pb_relic_xiuhcoatl_the_flaming_serpent": r"Xiuhcoatl,\s*T\s*he\s+Flaming\s+Serpent\s*\(\u2022{5}\)",
    "pb_relic_owlpedia": r"Owlpedia\s*5\s*\(\u2022{3}\)",
}


def load_purview_name_to_id() -> dict[str, str]:
    pv = json.loads(PV_PATH.read_text(encoding="utf-8"))
    m: dict[str, str] = {}
    for _k, v in pv.items():
        if _k.startswith("_") or not isinstance(v, dict):
            continue
        name = (v.get("name") or "").strip()
        pid = (v.get("id") or "").strip()
        if name and pid:
            m[name.casefold()] = pid
    return m


def pdf_blob(path: Path) -> str:
    import fitz

    doc = fitz.open(path)
    parts: list[str] = []
    for i in range(len(doc)):
        parts.append(f"\n__P{i + 1}__\n{doc[i].get_text()}")
    return "".join(parts)


def soft_join(s: str) -> str:
    s = s.replace("\u00ad", "")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def pages_in_chunk(chunk: str) -> tuple[int | None, int | None]:
    pages = [int(m.group(1)) for m in re.finditer(r"__P(\d+)__", chunk)]
    if not pages:
        return None, None
    return pages[0], pages[-1]


def strip_page_markers(chunk: str) -> str:
    return re.sub(r"__P\d+__\s*", " ", chunk)


def esc_word(tok: str) -> str:
    parts = re.split(r"(['\u2019])", tok)
    bits: list[str] = []
    for p in parts:
        if p in ("'", "\u2019"):
            bits.append(r"['\u2019]")
        else:
            bits.append(re.escape(p))
    return "".join(bits)


def title_flex_pattern(title_core: str) -> str:
    """Allow optional comma/newlines between comma-separated title parts (e.g. EXCALIBUR, THE SWORD…)."""
    title_core = title_core.replace(" (PB catalog)", "").strip()
    segs = [s.strip() for s in title_core.split(",") if s.strip()]
    if not segs:
        return ""
    seg_pats: list[str] = []
    for seg in segs:
        toks = [w for w in seg.split() if w]
        if not toks:
            continue
        seg_pats.append(r"\s+".join(esc_word(t) for t in toks))
    return r",?\s*".join(seg_pats)


def find_section(blob: str, key: str, title_core: str, dot_count: int) -> str | None:
    bullets = "\u2022" * dot_count
    if key in TITLE_REGEX_OVERRIDES:
        pat = re.compile(TITLE_REGEX_OVERRIDES[key], re.I | re.S)
        candidates = list(pat.finditer(blob))
    else:
        flex = title_flex_pattern(title_core)
        if not flex:
            return None
        pat = re.compile(r"(?is)" + flex + r"\s*\(\s*" + re.escape(bullets) + r"\s*\)")
        candidates = list(pat.finditer(blob))
    m = None
    for cand in candidates:
        window = blob[cand.end() : cand.end() + 900]
        if (
            re.search(r"(?i)\nPurviews:\s", window)
            or re.search(r"(?i)\nMythic\s*\n", window[:400])
            or re.search(r"(?i)\nKnack:\s", window[:500])
        ):
            m = cand
            break
    if m is None and candidates:
        m = candidates[-1]
    if m is None:
        needles = [
            f"{title_core} ({bullets})",
            f"{title_core.replace(chr(39), chr(0x2019))} ({bullets})",
        ]
        idx = -1
        for n in needles:
            idx = blob.find(n)
            if idx != -1:
                break
        if idx == -1:
            return None
    else:
        idx = m.start()
    rest = blob[idx : idx + 22000]
    m2 = re.search(
        r"\n([A-Z0-9][A-Za-z0-9 \u2019'\-,\.]{2,95})\(([\u2022]{1,6})\)\s*\n",
        rest[35:],
    )
    end_off = 35 + m2.start() if m2 else min(len(rest), 14000)
    return rest[: max(end_off, 200)]


def strip_leading_title_block(t: str) -> str:
    """Remove relic title block (one or more lines) ending in (•…)."""
    m = re.match(r"(?is)^(?:[^\n]+\n)*[^\n]+\(\s*\u2022{1,6}\s*\)\s*\n?", t)
    if m:
        return t[m.end() :]
    m = re.match(r"(?is)^(?:[^\n]+\n)+\(\s*\u2022{1,6}\s*\)\s*\n?", t)
    if m:
        return t[m.end() :]
    m = re.match(r"(?is)^[^\n]+\(\s*\u2022{1,6}\s*\)\s*\n?", t)
    if m:
        return t[m.end() :]
    return t


def peel_purviews_line(ft: str) -> tuple[str, str]:
    m = re.match(r"(?is)^(Purviews:\s*[^\n]+)", ft)
    if not m:
        return "", ft
    return m.group(1).strip(), ft[m.end() :].lstrip("\n")


def peel_motif_block(ft: str) -> tuple[str, str]:
    """Motif can span multiple lines before narrative (e.g. '…become' + 'the beast.')."""
    if not re.match(r"(?i)^Motif:", ft):
        return "", ft
    lines = ft.splitlines()
    block_lines = [lines[0]]
    i = 1
    while i < len(lines):
        st = lines[i].strip()
        if not st:
            block_lines.append(lines[i])
            i += 1
            continue
        if i > 0 and st and st[0].isupper() and not re.match(
            r"(?i)^(Purviews|Knack|Flaws?|Enhancement|Tags|Marvel|Special|Requirement|Qualities)\s*:",
            st,
        ):
            return "\n".join(block_lines).strip(), "\n".join(lines[i:]).lstrip("\n")
        if re.match(
            r"(?i)^(Purviews|Knack|Flaws?|Enhancement|Tags|Marvel|Special|Requirement|Qualities)\s*:",
            st,
        ):
            return "\n".join(block_lines).strip(), "\n".join(lines[i:]).lstrip("\n")
        block_lines.append(lines[i])
        if st.endswith("."):
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines):
                nxt = lines[j].strip()
                if re.match(r"^[A-Z][a-z]{3,}\s", nxt):
                    return "\n".join(block_lines).strip(), "\n".join(lines[j:]).lstrip("\n")
        i += 1
    return "\n".join(block_lines).strip(), "\n".join(lines[i + 1 :]).lstrip("\n")


def split_narrative_and_mechanics(section: str) -> tuple[str, str, str, str]:
    """
    Returns (narrative, purviews_line, motif_line, rest_mech).
    """
    t = strip_page_markers(section)
    t = t.replace("\u00ad", " ")
    lines_out: list[str] = []
    for ln in t.splitlines():
        s = ln.strip()
        if JUNK_LINE.match(s):
            continue
        lines_out.append(ln)
    t = "\n".join(lines_out)
    t = strip_leading_title_block(t)
    t = re.sub(r"(?is)^Birthrights\s*\n\s*\d+\s*\n?", "", t)
    t = re.sub(r"(?i)\bBirthrights\s+\d+\s+", "", t)
    t = re.sub(r"^Mythic\s*\n?", "", t, flags=re.I)
    if re.match(r"(?i)^Motif:", t):
        mot, ft = peel_motif_block(t)
        pur, ft = peel_purviews_line(ft)
    elif re.match(r"(?i)^Purviews:", t):
        pur, ft = peel_purviews_line(t)
        mot, ft = peel_motif_block(ft)
    else:
        pur, mot = "", ""
        ft = t
    ft = re.sub(r"(?i)^\s*Birthrights\s+", "", ft.strip())
    m = re.search(
        r"(?im)^(Knack:|Flaws?:|Enhancement:|Tags:|Marvel:|Special:|Requirement:|Qualities:)",
        ft,
    )
    if m:
        narr = ft[: m.start()].strip()
        rest = ft[m.start() :].strip()
    else:
        narr = ft.strip()
        rest = ""
    narr = re.sub(r"(?i)PANDORA\u2019S BOX\s*\d*", " ", narr)
    narr = soft_join(narr)
    rest = re.sub(r"(?i)\s*birthrights\s*\n?\s*\d*\s*", " ", rest)
    return narr, pur, mot, rest


def sentences_from_text(text: str, max_chars: int) -> str:
    if not text:
        return ""
    parts = re.split(r"(?<=[.!?])\s+", text)
    out: list[str] = []
    n = 0
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if n + len(p) + 1 > max_chars and out:
            break
        out.append(p)
        n += len(p) + 1
        if n >= int(max_chars * 0.88):
            break
    return " ".join(out).strip()


def truncate(s: str, n: int) -> str:
    s = s.strip()
    if len(s) <= n:
        return s
    cut = s[: n - 1]
    if " " in cut:
        cut = cut.rsplit(" ", 1)[0]
    return cut + "…"


def first_purview_id(purviews_line: str, name_to_id: dict[str, str]) -> str:
    m = re.search(r"Purviews?\s*:\s*(.+)", purviews_line, re.I)
    if not m:
        return ""
    rest = m.group(1)
    first = rest.split(",")[0].strip()
    first = re.sub(r"\s*\([^)]*\)\s*$", "", first)
    first = re.sub(r"\s+", " ", first)
    return name_to_id.get(first.casefold(), "")


def motif_plain(motif_line: str) -> str:
    if not motif_line:
        return ""
    return re.sub(r"(?i)^Motif:\s*", "", motif_line).strip()


def build_mechanical_effects(pur: str, mot: str, rest: str, p_lo: int | None, p_hi: int | None) -> str:
    parts: list[str] = []
    if pur:
        parts.append(truncate(pur, 520))
    mplain = motif_plain(mot)
    if mplain:
        parts.append(truncate(f"Motif: {mplain}", 360))
    if rest:
        parts.append(truncate(rest, 720))
    body = " ".join(parts)
    pg = ""
    if p_lo is not None and p_hi is not None and p_lo != p_hi:
        pg = f" Condensed from printed Relics pp. {p_lo}–{p_hi}."
    elif p_lo is not None:
        pg = f" Condensed from printed Relics p. {p_lo}."
    return truncate(body + pg, 1150).strip()


def process_relic(
    blob: str,
    key: str,
    title_core: str,
    rating: int,
    name_to_id: dict[str, str],
) -> dict | None:
    chunk = find_section(blob, key, title_core, rating)
    if not chunk:
        return None
    p_lo, p_hi = pages_in_chunk(chunk)
    narr, pur, mot, rest = split_narrative_and_mechanics(chunk)
    desc = soft_join(sentences_from_text(narr, 520).replace("\n", " "))
    if not desc.strip() and rest.strip():
        desc = soft_join(sentences_from_text(rest, 420).replace("\n", " "))
    pid = first_purview_id(pur, name_to_id)
    meff = soft_join(build_mechanical_effects(pur, mot, rest, p_lo, p_hi))
    if not desc and not meff:
        return None
    return {
        "description": desc,
        "mechanicalEffects": meff,
        "purviewId": pid,
        "motifsAndTags": motif_plain(mot),
        "printedPages": [p_lo, p_hi],
    }


def main() -> None:
    if not PB_PDF.is_file():
        raise SystemExit(f"Missing PDF: {PB_PDF}")
    name_to_id = load_purview_name_to_id()
    print("Indexing Pandora’s Box PDF…")
    pb_blob = pdf_blob(PB_PDF)
    br = json.loads(BR_PATH.read_text(encoding="utf-8"))
    misses: list[str] = []

    for key, row in list(br.items()):
        if not key.startswith("pb_relic_"):
            continue
        title_core = (row.get("name") or "").replace(" (PB catalog)", "").strip()
        rd = row.get("relicDetails") or {}
        rating = int(rd.get("rating") or row.get("pointCost") or 1)
        info = process_relic(pb_blob, key, title_core, rating, name_to_id)
        if not info:
            misses.append(key)
            continue
        p_lo, p_hi = info.pop("printedPages", (None, None))
        br[key]["description"] = info["description"]
        br[key]["mechanicalEffects"] = info["mechanicalEffects"]
        if not isinstance(br[key].get("relicDetails"), dict):
            br[key]["relicDetails"] = {}
        br[key]["relicDetails"]["purviewId"] = info.get("purviewId") or ""
        br[key]["relicDetails"]["motifsAndTags"] = info.get("motifsAndTags") or ""
        br[key]["relicDetails"]["rating"] = rating
        base_src = "SCION_Pandoras_Box_(Revised_Download).pdf"
        note = (
            f"PB (Rev.) Relics pp. {p_lo}–{p_hi}"
            if p_lo and p_hi and p_lo != p_hi
            else f"PB (Rev.) Relics p. {p_lo}"
            if p_lo
            else ""
        )
        br[key]["source"] = f"{base_src}; {note}" if note else base_src

    if GOD_PDF.is_file() and "god_relic_mjolnir" in br:
        print("Indexing God (2e) PDF for Mjolnir…")
        god_blob = pdf_blob(GOD_PDF)
        row = br["god_relic_mjolnir"]
        raw_name = (row.get("name") or "").strip()
        title_core = re.sub(r"\s*\([^)]*\)\s*$", "", raw_name).strip()
        rating = int((row.get("relicDetails") or {}).get("rating") or 4)
        info = process_relic(god_blob, "god_relic_mjolnir", title_core, rating, name_to_id)
        if info:
            info.pop("printedPages", None)
            br["god_relic_mjolnir"]["description"] = info["description"]
            br["god_relic_mjolnir"]["mechanicalEffects"] = info["mechanicalEffects"]
            br["god_relic_mjolnir"]["relicDetails"]["purviewId"] = info.get("purviewId") or ""
            br["god_relic_mjolnir"]["relicDetails"]["motifsAndTags"] = info.get("motifsAndTags") or ""
            br["god_relic_mjolnir"]["source"] = "Scion_God_Second_Edition_(Final_Download).pdf; God (2e) Birthrights pp. 175–176"
        else:
            misses.append("god_relic_mjolnir")

    BR_PATH.write_text(json.dumps(br, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Wrote", BR_PATH)
    if misses:
        print("MISSED", len(misses), ":", ", ".join(misses[:40]))


if __name__ == "__main__":
    main()
