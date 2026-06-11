#!/usr/bin/env python3
"""Extract Dominion Stunts from Scion: Demigod into data/dominionStunts.json."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "src" / "data"
PDF = Path("/mnt/c/Users/John/Desktop/Scion/books/Scion_Demigod_Second_Edition_(Final_Download).pdf")
OUT = DATA / "dominionStunts.json"

# Authoritative stunt → purview id (PDF column layout mis-orders some blocks).
STUNT_PURVIEW: dict[str, str] = {
    "Gift of Power": "_general",
    "Lasting Record": "artistry",
    "Swelling Crescendo": "artistry",
    "Visible Choir": "artistry",
    "The World's Army": "beasts",
    "Fluid Form": "beasts",
    "Wild Whispers": "beasts",
    "Enthralling Appearance": "beauty",
    "Fast Friends": "beauty",
    "Skin Deep": "beauty",
    "Bacchanal": "chaos",
    "Chaotic Revelry": "chaos",
    "Endless Vexation": "chaos",
    "Ruinous Wake": "chaos",
    "From the Weft of Dreams": "darkness",
    "Shadow Puppets": "darkness",
    "Dream Thief": "darkness",
    "Dreamlike Atmosphere": "darkness",
    "Bring Them All Back to Life": "death",
    "Chains of Damnation": "death",
    "Enervating Aura": "death",
    "The Reaper Smiles": "death",
    "Decoy": "deception",
    "Liar's Eye": "deception",
    "Many-Faced Deceiver": "deception",
    "That Was Never Always Me": "deception",
    "Lingering Footsteps": "earth",
    "People Made of Stone": "earth",
    "Raise the Earthen Barrier": "earth",
    "Shaped from Clay": "earth",
    "Appealing Grace": "epicDexterity",
    "Faster Than Yourself": "epicDexterity",
    "Untouchable Opponent": "epicDexterity",
    "Adamantine Flesh": "epicStamina",
    "Impossible Vitality": "epicStamina",
    "Untiring": "epicStamina",
    "Unstoppable Chatter": "epicStamina",
    "Applied Force": "epicStrength",
    "Outta Here": "epicStrength",
    "Fastball Special": "epicStrength",
    "Wrestle the Truth": "epicStrength",
    "Blossoming Connection": "fertility",
    "The Ripe and Ruin": "fertility",
    "Withering Curse": "fertility",
    "Blazing Trail": "fire",
    "Burnout": "fire",
    "Excessive Heat": "fire",
    "Instant Armory": "forge",
    "Incomparable Gift": "forge",
    "Precise Calculations": "forge",
    "Fool's Gambit": "fortune",
    "Swimming Uphill": "fortune",
    "Frozen Path": "fortune",
    "Theft of Luck": "fortune",
    "Cold as Ice": "health",
    "Girded in Winter": "health",
    "Blood and Sweat": "health",
    "Shared Vitality": "health",
    "Soothing Words": "health",
    "Calling Shotgun": "journeys",
    "Rendezvous": "journeys",
    "Take the Wheel": "journeys",
    "Full and Bright": "moon",
    "Lunar Revelation": "moon",
    "Penumbral Shift": "moon",
    "Cooler Heads": "order",
    "Controlled Chaos": "order",
    "Hierarchy of Need": "order",
    "Speed Limit": "order",
    "Distracting Provocation": "passion",
    "Rousing Passion": "passion",
    "The Root of Fury": "passion",
    "Free Shipping!": "prosperity",
    "Payday!": "prosperity",
    "Solve the Problem with Money": "prosperity",
    "Defying Gravity": "sky",
    "Loosed Thunderbolts": "sky",
    "Ominous Horizon": "sky",
    "Postcognition": "stars",
    "Sidereal Revelation": "stars",
    "The Stars Align": "stars",
    "Midday Heat": "sun",
    "Noonday Glare": "sun",
    "Solar Retrocognition": "sun",
    "Only War": "war",
    "Peacekeeping": "war",
    "Violent Opportunist": "war",
    "Dowse for Secrets": "water",
    "Inexorable Tide": "water",
    "Washed Out": "water",
    "Base Instinct": "wild",
    "Dandelion Banquet": "wild",
    "Lower Thought": "wild",
}

APOSTROPHE = re.compile(r"[\u2018\u2019\u201b`]")

STUNT_RE = re.compile(r"^([A-Z][A-Za-z'\-\s!]+?)\s*\(([^)]+)\)\s*:\s*(.*)$")


def _norm_apostrophe(s: str) -> str:
    return APOSTROPHE.sub("'", s)
SKIP_HEADERS = {
    "DOMINION STUNTS",
    "DOMINION STUNT",
    "CASUAL MIRACLES",
    "CATASTROPHIC SUCCESS",
    "AND MORTAL FAILURE",
    "CHAPTER FOUR: CHASING DIVINITY",
    "DOMINION BOONS",
    "USING DOMINION STUNTS",
    "BASICS",
    "ENFORCING THE ROLL",
    "WHO CAN USE",
    "GENERAL",
}


def _slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", name.lower().strip())
    return s.strip("_")


def _pdf_text(pages: range) -> str:
    if not PDF.is_file():
        raise FileNotFoundError(f"Demigod PDF not found: {PDF}")
    chunks: list[str] = []
    for p in pages:
        proc = subprocess.run(
            ["pdftotext", "-f", str(p), "-l", str(p), str(PDF), "-"],
            capture_output=True,
            text=True,
            check=True,
        )
        chunks.append(proc.stdout)
    return "\n".join(chunks)


def extract() -> dict:
    text = _pdf_text(range(156, 201))
    lines = [ln.strip() for ln in text.splitlines()]
    found: dict[str, dict] = {}
    current: dict | None = None

    def flush() -> None:
        nonlocal current
        if not current:
            return
        name = current["name"]
        pv = STUNT_PURVIEW.get(name)
        if not pv:
            current = None
            return
        slug = _slug(name)
        sid = f"{pv}_dominion_{slug}" if pv != "_general" else f"general_dominion_{slug}"
        found[sid] = {
            "id": sid,
            "purview": None if pv == "_general" else pv,
            "name": name,
            "successCost": current["successCost"],
            "description": current["description"].strip()[:1500],
            "source": "Scion_Demigod_Second_Edition_(Final_Download).pdf — Dominion Stunts",
        }
        current = None

    for raw in lines:
        line = _norm_apostrophe(raw)
        if not line or re.match(r"^\d+$", line):
            continue
        if line in SKIP_HEADERS or line.startswith("CHAPTER ") or line.startswith("Dominion Boons"):
            flush()
            continue
        m = STUNT_RE.match(line)
        if m:
            flush()
            current = {
                "name": m.group(1).strip(),
                "successCost": m.group(2).strip(),
                "description": m.group(3).strip(),
            }
            continue
        if current and line and not line.isupper():
            current["description"] += " " + line
    flush()

    missing = sorted(set(STUNT_PURVIEW) - {v["name"] for v in found.values()})
    if missing:
        print("WARNING: expected stunts not extracted:", ", ".join(missing), file=sys.stderr)

    meta = {
        "source": "Scion_Demigod_Second_Edition_(Final_Download).pdf pp. 154–175 (Dominion / Dominion Stunts)",
        "note": "Regenerate: python3 src/scripts/extract_demigod_dominion_stunts.py",
        "entryCount": len(found),
    }
    return {"_meta": meta, **dict(sorted(found.items()))}


def main() -> None:
    data = extract()
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(data) - 1} Dominion Stunts to {OUT}")


if __name__ == "__main__":
    main()
