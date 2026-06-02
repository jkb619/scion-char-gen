#!/usr/bin/env python3
"""
Build data/dragonMagic.json from Scion: Dragon core PDF (pdftotext).

Harvests Cost / Duration / Subject / Range / Action immediately after each
ALL-CAPS spell title (Ch.5 + Signature lists). Caches full text to /tmp once
per run for speed.

  python3 scripts/build_dragon_magic_json.py > /tmp/dm.json
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

PDF = Path("/mnt/c/Users/John/Desktop/Scion/books/Scion_Dragon_(Final_Download).pdf")
TEXT_CACHE = Path("/tmp/scion_dragon_pdftotext_cache.txt")


def full_text() -> str:
    if TEXT_CACHE.exists() and PDF.exists() and TEXT_CACHE.stat().st_mtime > PDF.stat().st_mtime:
        return TEXT_CACHE.read_text(encoding="utf-8", errors="replace")
    raw = subprocess.check_output(["pdftotext", str(PDF), "-"], stderr=subprocess.DEVNULL).decode(
        "utf-8", errors="replace"
    )
    norm = raw.replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"')
    TEXT_CACHE.write_text(norm, encoding="utf-8")
    return norm


def slug(s: str) -> str:
    p = re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()
    bits = [b for b in p.split() if b]
    if not bits:
        return "spell"
    return bits[0] + "".join(x.title() for x in bits[1:])


def harvest_after_title(text: str, title_caps: str) -> dict:
    """Find line exactly equal to title_caps (after strip)."""
    lines = text.splitlines()
    out: dict[str, str] = {"name": title_caps.title()}
    for i, raw in enumerate(lines):
        if raw.strip() != title_caps:
            continue
        tag = re.compile(r"^(Cost|Duration|Subject|Range|Action)\s*:\s*(.+)$", re.I)
        for ln in lines[i + 1 : i + 28]:
            s = ln.strip()
            if not s:
                continue
            mm = tag.match(s)
            if mm:
                out[mm.group(1).lower()] = mm.group(2).strip()
                continue
            if s.upper() == s and len(s) > 4 and re.match(r"^[A-Z0-9][A-Z0-9 '\-()/]+$", s):
                break
            if s.startswith("Prerequisite:"):
                out["prerequisite"] = s.split(":", 1)[1].strip()
        break
    return out


def spell_row(title_caps: str, h: dict) -> dict:
    name = h.get("name", title_caps.title())
    sid = slug(title_caps)
    row: dict[str, str] = {
        "id": sid,
        "name": name,
        "summary": "",
        "action": h.get("action") or "Simple",
    }
    for k in ("cost", "duration", "subject", "range"):
        if h.get(k):
            row[k] = h[k]
    if h.get("prerequisite"):
        row["prerequisite"] = h["prerequisite"]
    mech_lines = []
    for k in ("cost", "duration", "subject", "range", "action"):
        if row.get(k):
            label = "Subject" if k == "subject" else k.title()
            mech_lines.append(f"{label}: {row[k]}")
    row["mechanicalEffects"] = "\n".join(mech_lines)
    return row


MAGICS: list[tuple[str, str, list[str]]] = [
    (
        "animalControl",
        "Animal Control",
        [
            "MENTAL COMMAND",
            "FRIEND OF BEASTS",
            "MASTER OF BEASTS",
            "MERGE WITH BEAST",
            "MASTER'S SONG",
        ],
    ),
    (
        "decay",
        "Decay",
        ["FRAYED", "UNTOUCHABLE", "ACCELERATED DECAY", "TOXIC CORRUPTION", "TOTAL ANNIHILATION"],
    ),
    (
        "elementalManipulationAir",
        "Elemental Manipulation (Air)",
        [
            "BREATH OF LIFE",
            "SKYWARD GALE",
            "WIND BLAST",
            "WIND OF WINGS",
            "WORDS ON THE WIND",
        ],
    ),
    (
        "elementalManipulationEarth",
        "Elemental Manipulation (Earth)",
        [
            "ADAMANT BONDS",
            "ANIMATE EARTH",
            "ARMOR OF EARTH",
            "COMMAND THE SOLID EARTH",
            "EARTH ROAR",
        ],
    ),
    (
        "elementalManipulationFire",
        "Elemental Manipulation (Fire)",
        [
            "ASHES TO ASHES",
            "EMBER SKIN",
            "FIERY AWE",
            "FIRE MASTERY",
            "FIRE SHAPING",
        ],
    ),
    (
        "elementalManipulationFrost",
        "Elemental Manipulation (Frost)",
        ["COOL DOWN", "FLASH FREEZE", "ICE SCULPTING", "RIME", "SEARING COLD"],
    ),
    (
        "elementalManipulationWater",
        "Elemental Manipulation (Water)",
        [
            "FLASH FLOOD",
            "HYDRAULIC OVERRIDE",
            "OCEANIC MAJESTY",
            "VISION OF THE DISTANT SHORE",
            "WATER MASTERY",
        ],
    ),
    (
        "fear",
        "Fear",
        [
            "CALM MIND",
            "PARALYZING GAZE",
            "READ THE ROOM",
            "INTIMIDATING PRESENCE",
            "LOOMING PRESENCE",
        ],
    ),
    (
        "flight",
        "Flight",
        [
            "ACROBATIC FLIGHT",
            "AERIAL MOBILITY",
            "COMPANION FLIGHT",
            "SWIFT AS LIGHTNING",
            "TELEKINESIS",
        ],
    ),
    (
        "illusions",
        "Illusions",
        [
            "CLEAR SIGHT",
            "DISGUISE",
            "EYES TURNED AWAY",
            "ILLUSORY AURA",
            "IMPERSONATION",
        ],
    ),
    (
        "luck",
        "Luck",
        [
            "ARMOR OF FORTUNE",
            "FORTUNE'S FAVOR",
            "SECOND CHANCES",
            "STOLEN LUCK",
            "SWIFT FORTUNE",
        ],
    ),
    (
        "transformation",
        "Transformation",
        [
            "SHIFT SHAPE",
            "HIDE BENEATH NOTICE",
            "TRANSFORM OBJECT",
            "TRANSFORM OTHER",
            "TRANSFORM SUBSTANCE",
        ],
    ),
    (
        "understanding",
        "Understanding",
        [
            "FORESIGHT",
            "GLIMPSE THE FUTURE",
            "PENETRATING INSIGHT",
            "PIERCING GAZE",
            "VISION OF THE AGES",
        ],
    ),
    (
        "weatherControl",
        "Weather Control",
        [
            "UNNATURAL WEATHER",
            "ALTER WEATHER",
            "LETHAL WEATHER",
            "LOCALIZED WEATHER",
            "RESIST WEATHER",
        ],
    ),
    (
        "purification",
        "Purification (Serpent Signature)",
        [
            "CLEANSE",
            "SOOTHING AURA",
            "PURIFY ORGANIZATION",
            "RECLAIM THE EARTH",
            "REMOVE THE UNNATURAL",
        ],
    ),
    (
        "pandemonium",
        "Pandemonium (Draq Signature)",
        ["VORTEX", "MINOR CHAOS", "ORGANIZATIONAL CHAOS", "PARALYZING DISORDER", "VIOLENT ANARCHY"],
    ),
    (
        "refinement",
        "Refinement (Joka Signature)",
        [
            "ABSORB INFORMATION",
            "FINAL DESTRUCTION",
            "TRANSFORM ENERGY",
            "TRANSMUTATION",
            "TRANSMUTE INFORMATION",
        ],
    ),
    (
        "avarice",
        "Avarice (Lindwurm Signature)",
        [
            "CURSED HOARD",
            "IRRESISTIBLE CRAVING",
            "OVERWHELMING GREED",
            "RADIANT WEALTH",
            "STOCK YOUR HOARD",
        ],
    ),
    (
        "dragonBlessings",
        "Blessings (Lóng Signature)",
        [
            "BLESSING OF DRACONIC POWER",
            "BLESSING OF LUCK",
            "BLESSING OF PERFECTION",
            "DEFENSE FROM AFAR",
            "LAND BLESSING",
        ],
    ),
    (
        "teleportation",
        "Teleportation (Naga Signature)",
        ["CREATE POCKET REALM", "IMPRISON", "JUMP", "POCKET LAIR", "TELEPORTATION"],
    ),
]

DESCRIPTIONS: dict[str, str] = {
    "animalControl": "Bolster commanded people and beasts; compel, bond, merge, and direct animals.",
    "decay": "Entropy and ruin — bonds, bodies, fields, and totality of annihilation.",
    "elementalManipulationAir": "Winds, breath, gales, buffeting, and carried voices.",
    "elementalManipulationEarth": "Stone, metal, earth — bonds, constructs, armor, reshaping, roars.",
    "elementalManipulationFire": "Flame control, burning and restoring, awe, mastery, shaping.",
    "elementalManipulationFrost": "Cold immunity, flash freeze, ice art, rime aura, searing cold strike.",
    "elementalManipulationWater": "Floods, fine control, majesty over bodies of water, scrying, mastery.",
    "fear": "Panic and dread — gaze, room tone, presence, looming terror.",
    "flight": "True flight, telekinesis, companions, speed, acrobatics in the air.",
    "illusions": "Disguise, misdirection, piercing deception, auras, impersonation.",
    "luck": "Fortune's armor and favor, second chances, stolen luck, physical luck.",
    "transformation": "Forms, hiding, objects, others, and substance shifts.",
    "understanding": "Foreknowledge, session insight, documents, lies, deep history.",
    "weatherControl": "Altered, lethal, localized, resisted, and unnatural weather.",
    "purification": "Serpent cleansing — food, aura, organizations, land, region-scale purge.",
    "pandemonium": "Draq chaos in life, crowds, organizations, paralysis, anarchy.",
    "refinement": "Joka consume, destroy, convert energy, matter, and information.",
    "avarice": "Lindwurm hunger for wealth — hoards, craving, greed, radiance, stockpiles.",
    "dragonBlessings": "Lóng boons — power, luck, perfection, distant defense, land.",
    "teleportation": "Naga space tricks — pockets, prison, jump, lair, core teleport.",
}


def overrides() -> dict[str, dict[str, dict[str, str]]]:
    """Hand fixes where pdftotext order breaks title/body (Transformation, etc.)."""
    return {
        "luck": {
            "armorOfFortune": {
                "cost": "Imbue 1 Inheritance",
                "duration": "One scene",
                "subject": "Self",
                "action": "Simple",
            },
            "fortunesFavor": {
                "cost": "None or Imbue 1 Inheritance",
                "duration": "One scene",
                "subject": "Self",
                "action": "Simple",
            },
        },
        "transformation": {
            "shiftShape": {
                "cost": "Imbue 1 Inheritance",
                "duration": "Indefinite",
                "subject": "Self",
                "action": "Simple",
            },
            "transformObject": {
                "cost": "Spend 1 Inheritance",
                "duration": "Permanent",
                "subject": "One object within Close range",
                "action": "Simple",
            },
        },
        "elementalManipulationWater": {
            "waterMastery": {
                "cost": "Imbue 1 Inheritance",
                "duration": "Instant or one scene",
                "subject": "One target",
                "action": "Simple",
            },
        },
    }


def main() -> int:
    if not PDF.exists():
        print(f"Missing PDF: {PDF}", file=sys.stderr)
        return 1
    text = full_text()
    ov = overrides()
    root: dict[str, object] = {
        "_meta": {
            "note": "Spell stat lines (Cost, Duration, Subject, Range, Action) extracted from Scion: Dragon (Final) PDF text; some entries hand-corrected where layout scrambled lines. Default Action Simple per p.150. Full rules text remains in the book.",
            "source": "Scion_Dragon_(Final_Download).pdf — Dragon Magic & Signature Magic",
            "spellStatLines": "Explicit fields + mechanicalEffects tag block for boonTrackedMechanicalFields.",
        }
    }
    for mid, display, titles in MAGICS:
        spells_out = []
        for t in titles:
            h = harvest_after_title(text, t)
            row = spell_row(t, h)
            fix = ov.get(mid, {}).get(row["id"])
            if fix:
                row.update(fix)
                mech_lines = []
                for k in ("cost", "duration", "subject", "range", "action"):
                    if row.get(k):
                        label = "Subject" if k == "subject" else k.title()
                        mech_lines.append(f"{label}: {row[k]}")
                row["mechanicalEffects"] = "\n".join(mech_lines)
            spells_out.append(row)
        root[mid] = {
            "id": mid,
            "name": display,
            "description": DESCRIPTIONS.get(mid, ""),
            "spells": spells_out,
            "source": "Scion_Dragon_(Final_Download).pdf",
        }
    print(json.dumps(root, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
