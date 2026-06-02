#!/usr/bin/env python3
"""
Merge build_dragon_magic_json.py stdout with hand corrections + legacy chargen spell ids.

  python3 scripts/build_dragon_magic_json.py | python3 scripts/finalize_dragon_magic_data.py > data/dragonMagic.json
"""
from __future__ import annotations

import json
import sys
from copy import deepcopy

LEGACY_SPELLS: dict[str, list[dict]] = {
    "purification": [
        {
            "id": "burnImpurity",
            "name": "Burn Impurity",
            "summary": "Focus cleansing force to scour a specific corruption or curse vector.",
            "cost": "Imbue 1 Inheritance or Spend 1 Inheritance",
            "duration": "Instant",
            "subject": "One supernatural taint, curse vector, or bond corruption the SG agrees fits Purification",
            "action": "Simple",
        }
    ],
    "luck": [
        {
            "id": "twistOutcome",
            "name": "Twist Outcome",
            "summary": "Spend Inheritance to nudge a roll’s outcome category after the fact (table-dependent).",
            "cost": "Spend 1 Inheritance",
            "duration": "Instant",
            "subject": "One roll outcome you or an ally just resolved (SG/table)",
            "action": "Simple",
        },
        {
            "id": "jinxTrail",
            "name": "Jinx Trail",
            "summary": "Lay bad luck on a target’s next risky action.",
            "cost": "Imbue 1 Inheritance",
            "duration": "One scene",
            "subject": "One character",
            "action": "Simple",
        },
    ],
    "understanding": [
        {
            "id": "readDesire",
            "name": "Read Desire",
            "summary": "Surface a subject’s strongest want or fear in the scene.",
            "cost": "Imbue 1 Inheritance",
            "duration": "One scene",
            "subject": "One character",
            "action": "Simple",
        },
        {
            "id": "borrowedWisdom",
            "name": "Borrowed Wisdom",
            "summary": "Lean on draconic memory to answer one concrete question at a cost.",
            "cost": "Spend 1 Inheritance",
            "duration": "Instant",
            "subject": "Self",
            "action": "Simple",
        },
    ],
    "decay": [
        {
            "id": "witherObject",
            "name": "Wither Object",
            "summary": "Stress structures or gear; environmental hazard tilt.",
            "cost": "Imbue 1 Inheritance",
            "duration": "Instant",
            "subject": "A single object",
            "action": "Simple",
        },
        {
            "id": "gnawWill",
            "name": "Gnaw Will",
            "summary": "Erode a social tie or commitment over time.",
            "cost": "Imbue 1 Inheritance or Spend 1 Inheritance",
            "duration": "Instant",
            "subject": "One target",
            "action": "Simple",
        },
    ],
    "flight": [
        {
            "id": "downdraftSlam",
            "name": "Downdraft Slam",
            "summary": "Bring aerial force to bear against a zone or target.",
            "cost": "Spend 1 Inheritance",
            "duration": "Instant",
            "subject": "One Range Band within Long range",
            "action": "Simple",
        }
    ],
    "elementalManipulationWater": [],
    "weatherControl": [
        {
            "id": "suddenSquall",
            "name": "Sudden Squall",
            "summary": "Localize harsh weather against pursuers or structures.",
            "cost": "Imbue 1 Inheritance",
            "duration": "One scene",
            "subject": "One Field",
            "action": "Simple",
        },
        {
            "id": "clearSkies",
            "name": "Clear Skies",
            "summary": "Break an ongoing weather effect in a region.",
            "cost": "Imbue 1 Inheritance",
            "duration": "Instant",
            "subject": "One Field or visible weather pattern",
            "action": "Simple",
        },
    ],
    "illusions": [
        {
            "id": "maskAura",
            "name": "Mask Aura",
            "summary": "Hide draconic tells from casual supernatural scrutiny.",
            "cost": "Imbue 1 Inheritance",
            "duration": "One scene",
            "subject": "Self",
            "action": "Simple",
        },
        {
            "id": "phantomCrowd",
            "name": "Phantom Crowd",
            "summary": "Populate a scene with illusory extras.",
            "cost": "Imbue 1 Inheritance",
            "duration": "One scene",
            "subject": "One Field",
            "action": "Simple",
        },
    ],
    "animalControl": [
        {
            "id": "beastMessenger",
            "name": "Beast Messenger",
            "summary": "Dispatch animals with a simple geas.",
            "cost": "Imbue 1 Inheritance",
            "duration": "One day",
            "subject": "One animal",
            "action": "Simple",
        },
        {
            "id": "packFury",
            "name": "Pack Fury",
            "summary": "Rally mundane animals against a chosen threat.",
            "cost": "Spend 1 Inheritance",
            "duration": "One scene",
            "subject": "Multiple animals within Medium range",
            "action": "Simple",
        },
    ],
    "transformation": [
        {
            "id": "scaledHide",
            "name": "Scaled Hide",
            "summary": "Temporary armored skin or beast-markers.",
            "cost": "Imbue 1 Inheritance",
            "duration": "One scene",
            "subject": "Self",
            "action": "Simple",
        },
        {
            "id": "serpentineSpine",
            "name": "Serpentine Spine",
            "summary": "Contortion and reach tricks while mostly human.",
            "cost": "Imbue 1 Inheritance",
            "duration": "One scene",
            "subject": "Self",
            "action": "Simple",
        },
    ],
    "elementalManipulationFire": [
        {
            "id": "heatShroud",
            "name": "Heat Shroud",
            "summary": "Ward an ally or object from cold / soak fire briefly.",
            "cost": "Imbue 1 Inheritance",
            "duration": "One scene",
            "subject": "One target within Medium range",
            "action": "Simple",
        },
        {
            "id": "breathLine",
            "name": "Breath Line",
            "summary": "Directed gout of fire along a narrow arc.",
            "cost": "Spend 1 Inheritance",
            "duration": "Instant",
            "subject": "One target or narrow zone within Short range",
            "action": "Simple",
        },
    ],
}


def mech_lines(sp: dict) -> str:
    lines = []
    for k in ("cost", "duration", "subject", "range", "action"):
        if sp.get(k):
            label = "Subject" if k == "subject" else k.title()
            lines.append(f"{label}: {sp[k]}")
    return "\n".join(lines)


def apply_corrections(root: dict) -> None:
    """In-place spell fixes keyed by (magic_id, spell_id)."""
    fixes: dict[tuple[str, str], dict] = {
        ("animalControl", "masterOfBeasts"): {
            "name": "Master of Beasts",
            "cost": "Imbue 1 Inheritance",
            "duration": "Indefinite",
            "subject": "Self (you understand and influence animals; see Dragon p.151)",
        },
        ("animalControl", "mergeWithBeast"): {
            "name": "Merge with Beast",
            "cost": "Imbue 1 Inheritance",
            "duration": "Indefinite",
            "subject": "One non-legendary creature within Short range initially",
        },
        ("animalControl", "masterSSong"): {"id": "mastersSong", "name": "Master's Song"},
        ("decay", "frayed"): {
            "cost": "Imbue 1 Inheritance or Spend 1 Inheritance",
            "duration": "Instant",
            "subject": "One target",
        },
        ("decay", "untouchable"): {
            "cost": "Imbue 1 Inheritance",
            "duration": "One scene",
            "subject": "Self",
        },
        ("decay", "totalAnnihilation"): {
            "cost": "Spend 1 Inheritance",
            "duration": "Instant",
            "subject": "One Field",
        },
        ("elementalManipulationAir", "breathOfLife"): {
            "cost": "Imbue 1 Inheritance or None",
            "duration": "Condition",
            "subject": "Self",
        },
        ("elementalManipulationEarth", "animateEarth"): {
            "cost": "Imbue or spend 1 Inheritance",
            "duration": "Indefinite",
            "subject": "Earth within Medium range",
        },
        ("elementalManipulationFire", "fireMastery"): {
            "cost": "Imbue 1 Inheritance",
            "duration": "One scene",
            "subject": "One fire you can perceive within Long range",
        },
        ("elementalManipulationWater", "hydraulicOverride"): {
            "cost": "Imbue 1 Inheritance",
            "duration": "One scene or Instant (person vs object, see Dragon p.156)",
            "subject": "One person, object, or water source within Medium range",
        },
        ("fear", "calmMind"): {
            "cost": "Imbue 1 Inheritance",
            "duration": "One scene",
            "subject": "Self",
        },
        ("luck", "swiftFortune"): {
            "cost": "None",
            "duration": "Indefinite",
            "subject": "Self",
        },
        ("refinement", "finalDestruction"): {
            "cost": "Spend 1 Inheritance",
            "duration": "Instant",
            "subject": "One object within Close range (refined annihilation; Dragon p.163)",
        },
        ("refinement", "transmuteInformation"): {
            "cost": "Imbue 1 Inheritance",
            "duration": "Instant",
            "subject": "One source of information you touch",
        },
        ("weatherControl", "unnaturalWeather"): {
            "cost": "None",
            "duration": "Indefinite",
            "subject": "Self (sense and call weather; prerequisite spells may apply)",
        },
        ("avarice", "irresistibleCraving"): {
            "cost": "Imbue 1 Inheritance",
            "duration": "Condition",
            "subject": "One target",
        },
        ("avarice", "radiantWealth"): {
            "cost": "Imbue 1 Inheritance",
            "duration": "One scene",
            "subject": "Self",
        },
        ("avarice", "stockYourHoard"): {
            "cost": "Spend 1 Inheritance",
            "duration": "Instant",
            "subject": "One theft target or location (see Dragon p.164)",
        },
        ("pandemonium", "violentAnarchy"): {
            "cost": "Spend 1 Inheritance",
            "duration": "Instant",
            "subject": "Multiple characters in one Field",
        },
        ("dragonBlessings", "blessingOfDraconicPower"): {
            "cost": "Imbue 1 Inheritance",
            "duration": "Indefinite",
            "subject": "One character you must touch",
        },
        ("dragonBlessings", "blessingOfLuck"): {
            "cost": "Imbue 1 Inheritance",
            "duration": "Condition",
            "subject": "One target within Close range",
        },
        ("dragonBlessings", "blessingOfPerfection"): {
            "cost": "Imbue 1 Inheritance",
            "duration": "One scene",
            "subject": "One task",
        },
        ("dragonBlessings", "defenseFromAfar"): {
            "cost": "Imbue 1 Inheritance",
            "duration": "One month",
            "subject": "One character you must touch",
        },
        ("dragonBlessings", "landBlessing"): {
            "cost": "Spend 1 Inheritance",
            "duration": "Varies",
            "subject": "Any defined region no more than four square kilometers",
        },
        ("teleportation", "createPocketRealm"): {
            "cost": "Imbue 1 Inheritance",
            "duration": "While you remain inside",
            "subject": "Self and up to Inheritance × 2 companions",
        },
        ("teleportation", "imprison"): {
            "cost": "Imbue 1 Inheritance",
            "duration": "Indefinite",
            "subject": "One target within Close range",
        },
        ("teleportation", "jump"): {
            "cost": "Imbue 1 Inheritance",
            "duration": "Instant",
            "subject": "Self and willing targets within Long range",
        },
        ("teleportation", "pocketLair"): {
            "cost": "Spend 1 Inheritance",
            "duration": "Permanent",
            "subject": "Your pocket realm",
        },
    }
    for mid, mag in root.items():
        if mid.startswith("_") or not isinstance(mag, dict):
            continue
        spells = mag.get("spells")
        if not isinstance(spells, list):
            continue
        for sp in spells:
            if not isinstance(sp, dict):
                continue
            sid = sp.get("id")
            if not sid:
                continue
            f = fixes.get((mid, sid))
            if f:
                sp.update(f)
            sp.setdefault("action", "Simple")
            sp["mechanicalEffects"] = mech_lines(sp)


def merge_legacy(root: dict) -> None:
    existing: dict[str, set[str]] = {}
    for mid, mag in root.items():
        if mid.startswith("_") or not isinstance(mag, dict):
            continue
        spells = mag.get("spells")
        if not isinstance(spells, list):
            continue
        existing[mid] = {str(s.get("id")) for s in spells if isinstance(s, dict) and s.get("id")}
    for mid, legs in LEGACY_SPELLS.items():
        if mid not in root or not legs:
            continue
        have = existing.setdefault(mid, set())
        spells = root[mid]["spells"]
        for leg in legs:
            lid = leg["id"]
            if lid in have:
                continue
            row = deepcopy(leg)
            row.setdefault("action", "Simple")
            row["mechanicalEffects"] = mech_lines(row)
            spells.append(row)
            have.add(lid)


def main() -> None:
    root = json.load(sys.stdin)
    apply_corrections(root)
    merge_legacy(root)
    if isinstance(root.get("purification"), dict):
        root["purification"]["name"] = "Purification"
    meta = root.get("_meta")
    if isinstance(meta, dict):
        meta["legacyIds"] = (
            "Chargen-only spell ids from earlier app builds are appended where needed "
            "(e.g. burnImpurity, twistOutcome) so old exports still resolve."
        )
        meta["companion"] = (
            "Scion: Dragon Companion adds further Signature options (e.g. Oracular Fury); "
            "not yet merged into this table."
        )
    for mid, mag in root.items():
        if mid.startswith("_") or not isinstance(mag, dict):
            continue
        for sp in mag.get("spells") or []:
            if isinstance(sp, dict) and not sp.get("summary"):
                sp["summary"] = ""
    print(json.dumps(root, indent=2))


if __name__ == "__main__":
    main()
