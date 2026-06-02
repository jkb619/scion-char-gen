#!/usr/bin/env python3
"""
Add Divine Armory (7711) appendix-style equipment and supporting weapon/armor tags.

Source: local PDFs under Scion/books — paraphrase mechanics only (workspace rules).

  python3 scripts/merge_da_equipment.py
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TAGS = ROOT / "data" / "tags.json"
EQUIP = ROOT / "data" / "equipment.json"

DA = "Divine Armory (Storypath Nexus community content, Óskar Örn Eggertsson); verify in 7711-Divine_Armory.pdf"

# Tags introduced or defined in Divine Armory ch.1 (PDF ~pp. 7–8) — paraphrased.
NEW_TAGS: dict[str, dict] = {
    "weaponAttach": {
        "id": "weaponAttach",
        "name": "Attach (weapon)",
        "bookCategory": "Weapon",
        "pointCost": 0,
        "tagType": "weapon",
        "category": "combat",
        "appliesTo": ["equipment", "relic"],
        "description": "Mounts on another item or weapon to function as a different weapon (e.g. bayonet).",
        "source": f"{DA}, introduction (Attach).",
    },
    "burns": {
        "id": "burns",
        "name": "Burns",
        "bookCategory": "Weapon",
        "pointCost": 0,
        "tagType": "weapon",
        "category": "combat",
        "appliesTo": ["equipment", "relic", "creature"],
        "description": "Inflicts burn-style Injuries (e.g. scorched flesh) instead of ordinary cuts or bruises.",
        "source": f"{DA}, introduction (Burns).",
    },
    "defensiveWeapon": {
        "id": "defensiveWeapon",
        "name": "Defensive (weapon)",
        "bookCategory": "Weapon",
        "pointCost": 2,
        "tagType": "weapon",
        "category": "combat",
        "appliesTo": ["equipment", "relic", "creature"],
        "description": "If not used to attack this round, grants Enhancement 1 to defensive rolls instead of the attack; defensive use prevents attacking that round.",
        "source": f"{DA}, introduction (Defensive).",
    },
    "doubleWeapon": {
        "id": "doubleWeapon",
        "name": "Double (weapon)",
        "bookCategory": "Weapon",
        "pointCost": 0,
        "tagType": "weapon",
        "category": "combat",
        "appliesTo": ["equipment", "relic"],
        "description": "Two usable sides: wielder picks Bashing or Lethal for the round, not both in the same round.",
        "source": f"{DA}, introduction (Double).",
    },
    "fragileWeapon": {
        "id": "fragileWeapon",
        "name": "Fragile (weapon)",
        "bookCategory": "Weapon",
        "pointCost": -1,
        "pointCostAlt": -3,
        "pointCostNote": "Divine Armory: weaker version is a level-1 Complication to overcome on attack or the weapon breaks; stronger version breaks automatically after a hit.",
        "tagType": "weapon",
        "category": "combat",
        "appliesTo": ["equipment", "relic"],
        "description": "Risk of breaking on use; severity depends on tier purchased on the table.",
        "source": f"{DA}, introduction (Fragile).",
    },
    "inaccurate": {
        "id": "inaccurate",
        "name": "Inaccurate",
        "bookCategory": "Weapon",
        "pointCost": -1,
        "tagType": "weapon",
        "category": "combat",
        "appliesTo": ["equipment", "relic", "creature"],
        "description": "Poorly suited as a weapon: +1 Difficulty to attack rolls with it (common on improvised gear).",
        "source": f"{DA}, introduction (Inaccurate).",
    },
    "prototypeWeapon": {
        "id": "prototypeWeapon",
        "name": "Prototype (weapon)",
        "bookCategory": "Weapon",
        "pointCost": -1,
        "pointCostAlt": -2,
        "pointCostNote": "Divine Armory: Complication level equals tag magnitude; failing yields a Glitched-style malfunction — see PDF.",
        "tagType": "weapon",
        "category": "combat",
        "appliesTo": ["equipment", "relic"],
        "description": "Experimental build: powerful or novel but prone to jams or glitches.",
        "source": f"{DA}, introduction (Prototype).",
    },
    "resetWeapon": {
        "id": "resetWeapon",
        "name": "Reset (weapon)",
        "bookCategory": "Weapon",
        "pointCost": -1,
        "tagType": "weapon",
        "category": "combat",
        "appliesTo": ["equipment", "relic"],
        "description": "Single use before reload or reset; may spend an action or beat a level-1 Complication before firing again (book options).",
        "source": f"{DA}, introduction (Reset).",
    },
    "shortRange": {
        "id": "shortRange",
        "name": "Short range (firearm)",
        "bookCategory": "Weapon",
        "pointCost": -1,
        "tagType": "weapon",
        "category": "combat",
        "appliesTo": ["equipment", "relic"],
        "description": "Firearm effective only out to short range instead of usual bands.",
        "source": f"{DA}, introduction (Short Range).",
    },
    "weaponSoftMinor": {
        "id": "weaponSoftMinor",
        "name": "Soft — minor (weapon)",
        "bookCategory": "Weapon",
        "pointCost": -1,
        "tagType": "weapon",
        "category": "combat",
        "appliesTo": ["equipment", "relic", "creature"],
        "description": "Raises Difficulty to inflict an Injury Condition by 1 (Divine Armory weapon Soft, mild tier). Not armor Soft.",
        "source": f"{DA}, introduction (Soft, weapon).",
    },
    "weaponSoftMajor": {
        "id": "weaponSoftMajor",
        "name": "Soft — major (weapon)",
        "bookCategory": "Weapon",
        "pointCost": -3,
        "tagType": "weapon",
        "category": "combat",
        "appliesTo": ["equipment", "relic", "creature"],
        "description": "Cannot cause Injury Conditions at all (Divine Armory weapon Soft, strong tier).",
        "source": f"{DA}, introduction (Soft, weapon).",
    },
    "weaponTool": {
        "id": "weaponTool",
        "name": "Tool (weapon)",
        "bookCategory": "Weapon",
        "pointCost": 1,
        "tagType": "weapon",
        "category": "utility",
        "appliesTo": ["equipment", "relic"],
        "description": "Doubles as a plausible tool; Enhancement 1 on fitting non-combat rolls when used as that tool.",
        "source": f"{DA}, introduction (Tool).",
    },
    "slotHelm": {
        "id": "slotHelm",
        "name": "Slot: helm",
        "bookCategory": "Armor",
        "pointCost": -1,
        "tagType": "armor",
        "category": "protection",
        "appliesTo": ["equipment", "relic"],
        "description": "Armor build counts a helmet slot or integrated head protection as part of its tag budget (Divine Armory armor write-ups).",
        "source": f"{DA}, armor chapter / appendix (Slot Helm).",
    },
    "camouflageArmor": {
        "id": "camouflageArmor",
        "name": "Camouflage (armor)",
        "bookCategory": "Armor",
        "pointCost": 2,
        "tagType": "armor",
        "category": "protection",
        "appliesTo": ["equipment", "relic"],
        "description": "Helps the wearer blend into terrain or hunting fiction; confirm bonuses with the Storyguide.",
        "source": f"{DA}, armor chapter (Camouflage).",
    },
}

# Equipment appendix + obvious chapter picks — tagIds must exist in tags.json.
NEW_EQUIPMENT: dict[str, dict] = {
    "eqDaKnife": {
        "id": "eqDaKnife",
        "name": "Knife (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["lethal", "melee", "concealableWeapon", "thrown"],
        "description": "General-purpose blade; easy to hide or throw.",
        "mechanicalEffects": "Divine Armory appendix total 1 tag point; confirm Stunts with SG.",
        "source": f"{DA}; appendix List of Weapons.",
    },
    "eqDaSword": {
        "id": "eqDaSword",
        "name": "Sword (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["lethal", "melee", "weaponVersatile"],
        "mechanicalEffects": "Appendix total 2; useful for varied stunts per Versatile weapon tag.",
        "source": f"{DA}; appendix.",
    },
    "eqDaSpear": {
        "id": "eqDaSpear",
        "name": "Spear (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["lethal", "melee", "reach", "defensiveWeapon"],
        "mechanicalEffects": "Appendix total 3; Defensive from Divine Armory (paraphrase in tags.json).",
        "source": f"{DA}; appendix.",
    },
    "eqDaBattleAx": {
        "id": "eqDaBattleAx",
        "name": "Battle ax (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["lethal", "melee", "brutal", "piercing", "twoHanded", "unconcealable"],
        "mechanicalEffects": "Appendix total 1 (heavy two-hander with flaw credits).",
        "source": f"{DA}; appendix.",
    },
    "eqDaBrassKnuckles": {
        "id": "eqDaBrassKnuckles",
        "name": "Brass knuckles (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["bashing", "melee", "concealableWeapon", "worn"],
        "mechanicalEffects": "Appendix total 3.",
        "source": f"{DA}; appendix.",
    },
    "eqDaWhip": {
        "id": "eqDaWhip",
        "name": "Whip (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["bashing", "melee", "reach", "grappling"],
        "mechanicalEffects": "Appendix total 2.",
        "source": f"{DA}; appendix.",
    },
    "eqDaShield": {
        "id": "eqDaShield",
        "name": "Shield (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["bashing", "melee", "pushing", "defensiveWeapon"],
        "mechanicalEffects": "Appendix total 3; also usable as protection fiction — compare to shield tag on armor side.",
        "source": f"{DA}; appendix.",
    },
    "eqDaHatchet": {
        "id": "eqDaHatchet",
        "name": "Hatchet (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["lethal", "melee", "thrown"],
        "mechanicalEffects": "Appendix melee entry total 0.",
        "source": f"{DA}; appendix.",
    },
    "eqDaRapier": {
        "id": "eqDaRapier",
        "name": "Rapier (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["lethal", "melee", "piercing"],
        "mechanicalEffects": "Appendix total 2.",
        "source": f"{DA}; appendix.",
    },
    "eqDaIceAx": {
        "id": "eqDaIceAx",
        "name": "Ice ax (Divine Armory)",
        "equipmentType": "tool",
        "tagIds": ["lethal", "melee", "piercing", "weaponTool"],
        "mechanicalEffects": "Appendix total 3; climbing tool + weapon.",
        "source": f"{DA}; appendix.",
    },
    "eqDaBow": {
        "id": "eqDaBow",
        "name": "Bow (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["ranged", "twoHanded", "arcing"],
        "mechanicalEffects": "Appendix base 0 before arrows; ammunition swaps tags per same book.",
        "source": f"{DA}; appendix.",
    },
    "eqDaCrossbow": {
        "id": "eqDaCrossbow",
        "name": "Crossbow (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["firearm", "lethal", "piercing", "ranged", "resetWeapon"],
        "mechanicalEffects": "Appendix total 1.",
        "source": f"{DA}; appendix.",
    },
    "eqDaPistol": {
        "id": "eqDaPistol",
        "name": "Pistol (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["firearm", "lethal", "piercing", "ranged", "resetWeapon"],
        "mechanicalEffects": "Appendix total 1.",
        "source": f"{DA}; appendix.",
    },
    "eqDaLightRevolver": {
        "id": "eqDaLightRevolver",
        "name": "Light revolver (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["concealableWeapon", "firearm", "lethal", "piercing", "ranged"],
        "mechanicalEffects": "Appendix total 3.",
        "source": f"{DA}; appendix.",
    },
    "eqDaAssaultRifle": {
        "id": "eqDaAssaultRifle",
        "name": "Assault rifle (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["automatic", "firearm", "lethal", "piercing", "ranged", "twoHanded"],
        "mechanicalEffects": "Appendix total 3.",
        "source": f"{DA}; appendix.",
    },
    "eqDaHuntingRifle": {
        "id": "eqDaHuntingRifle",
        "name": "Hunting rifle (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["firearm", "lethal", "weaponLoud", "piercing", "ranged", "twoHanded"],
        "mechanicalEffects": "Appendix total 0.",
        "source": f"{DA}; appendix.",
    },
    "eqDaSniperRifle": {
        "id": "eqDaSniperRifle",
        "name": "Sniper rifle (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["firearm", "lethal", "longRange", "piercing", "unconcealable"],
        "mechanicalEffects": "Appendix total 2.",
        "source": f"{DA}; appendix.",
    },
    "eqDaShotgun": {
        "id": "eqDaShotgun",
        "name": "Shotgun, generic (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["firearm", "lethal", "weaponLoud", "piercing", "pushing", "ranged"],
        "mechanicalEffects": "Appendix ‘Generic Shotgun’ total 2.",
        "source": f"{DA}; appendix.",
    },
    "eqDaBoomerang": {
        "id": "eqDaBoomerang",
        "name": "Boomerang (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["arcing", "bashing", "returning", "stun", "thrown"],
        "mechanicalEffects": "Appendix total 3.",
        "source": f"{DA}; appendix.",
    },
    "eqDaSubmachineGun": {
        "id": "eqDaSubmachineGun",
        "name": "Submachine gun (Divine Armory)",
        "equipmentType": "weapon",
        "tagIds": ["automatic", "firearm", "lethal", "ranged"],
        "mechanicalEffects": "Appendix total 2.",
        "source": f"{DA}; appendix.",
    },
    "eqDaHeavyMachineGun": {
        "id": "eqDaHeavyMachineGun",
        "name": "Heavy machine gun (Divine Armory)",
        "equipmentType": "heavy",
        "tagIds": [
            "automatic",
            "brutal",
            "firearm",
            "lethal",
            "weaponLoud",
            "piercing",
            "ranged",
            "twoHanded",
            "unconcealable",
        ],
        "mechanicalEffects": "Appendix: Scale 1 damage, usually mounted; confirm Scale and crew with SG.",
        "source": f"{DA}; appendix.",
    },
    "eqDaFragGrenade": {
        "id": "eqDaFragGrenade",
        "name": "Frag grenade (Divine Armory)",
        "equipmentType": "accessory",
        "tagIds": ["arcing", "lethal", "weaponLoud", "messy", "shockwave", "thrown"],
        "mechanicalEffects": "Appendix: Scale 2 damage in area; one use.",
        "source": f"{DA}; appendix tactical weapons.",
    },
    "eqDaFlashbang": {
        "id": "eqDaFlashbang",
        "name": "Flashbang (Divine Armory)",
        "equipmentType": "accessory",
        "tagIds": ["arcing", "shockwave", "weaponSoftMajor", "stun", "thrown"],
        "mechanicalEffects": "Appendix uses major weapon Soft tier (−3); confirm area effects with SG.",
        "source": f"{DA}; appendix.",
    },
    "eqDaRocketLauncherDisposable": {
        "id": "eqDaRocketLauncherDisposable",
        "name": "Disposable rocket launcher (Divine Armory)",
        "equipmentType": "heavy",
        "tagIds": [
            "concealableWeapon",
            "firearm",
            "lethal",
            "weaponLoud",
            "messy",
            "ranged",
            "shockwave",
            "twoHanded",
        ],
        "mechanicalEffects": "Appendix: Scale 2, single shot; Concealable reflects packed carry in the supplement’s fiction.",
        "source": f"{DA}; appendix.",
    },
    "eqDaFlamethrower": {
        "id": "eqDaFlamethrower",
        "name": "Flamethrower (Divine Armory)",
        "equipmentType": "heavy",
        "tagIds": ["arcing", "automatic", "burns", "firearm", "lethal", "shortRange"],
        "mechanicalEffects": "Appendix total 2; Burns tag from Divine Armory.",
        "source": f"{DA}; appendix tactical weapons.",
    },
    "eqDaLeatherArmor": {
        "id": "eqDaLeatherArmor",
        "name": "Leather armor (Divine Armory)",
        "equipmentType": "armor",
        "tagIds": ["softArmor", "weighty"],
        "mechanicalEffects": "Appendix total 0; map ‘Armored: Soft’ to softArmor tag.",
        "source": f"{DA}; appendix armor.",
    },
    "eqDaBulletproofVest": {
        "id": "eqDaBulletproofVest",
        "name": "Bulletproof vest (Divine Armory)",
        "equipmentType": "armor",
        "tagIds": ["softArmor", "resistant", "weighty"],
        "mechanicalEffects": "Appendix: Resistant (bulletproof); Resistant tag in app covers typed resistance.",
        "source": f"{DA}; appendix.",
    },
    "eqDaChainMail": {
        "id": "eqDaChainMail",
        "name": "Chain mail (Divine Armory)",
        "equipmentType": "armor",
        "tagIds": ["hardArmor", "resistant", "weighty"],
        "mechanicalEffects": "Appendix: Hard (1) + Resistant (arrows) + Weighty; confirm Hard dots with SG.",
        "source": f"{DA}; appendix.",
    },
    "eqDaFullPlate": {
        "id": "eqDaFullPlate",
        "name": "Full plate (Divine Armory)",
        "equipmentType": "armor",
        "tagIds": ["hardArmor", "cumbersome"],
        "mechanicalEffects": "Appendix: Hard (3) + Cumbersome; use hardArmor note for second box cost if purchased.",
        "source": f"{DA}; appendix.",
    },
    "eqDaBombSuit": {
        "id": "eqDaBombSuit",
        "name": "Bomb suit (Divine Armory)",
        "equipmentType": "armor",
        "tagIds": ["hardArmor", "cumbersome", "weighty", "slotHelm"],
        "mechanicalEffects": "Appendix total 0 with heavy Hard and multiple flaws.",
        "source": f"{DA}; appendix.",
    },
    "eqDaHazmatSuit": {
        "id": "eqDaHazmatSuit",
        "name": "Hazmat suit (Divine Armory)",
        "equipmentType": "armor",
        "tagIds": ["resistant", "slotHelm"],
        "mechanicalEffects": "Appendix: Resistant (bioweapons, gas) at higher magnitude; not full rigid armor.",
        "source": f"{DA}; appendix.",
    },
    "eqDaHuntingSuit": {
        "id": "eqDaHuntingSuit",
        "name": "Hunting suit (Divine Armory)",
        "equipmentType": "armor",
        "tagIds": ["softArmor", "camouflageArmor", "cumbersome"],
        "mechanicalEffects": "Appendix total 2.",
        "source": f"{DA}; appendix.",
    },
    "eqDaSegmentedArmor": {
        "id": "eqDaSegmentedArmor",
        "name": "Segmented armor (Divine Armory)",
        "equipmentType": "armor",
        "tagIds": ["hardArmor", "weighty"],
        "mechanicalEffects": "Appendix total 0; overlapping plates fiction.",
        "source": f"{DA}; appendix.",
    },
}


def main() -> None:
    tags = json.loads(TAGS.read_text(encoding="utf-8"))
    for tid, row in NEW_TAGS.items():
        if tid not in tags:
            tags[tid] = row
    TAGS.write_text(json.dumps(tags, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    eq = json.loads(EQUIP.read_text(encoding="utf-8"))
    meta = eq.setdefault("_meta", {})
    note = meta.get("note", "")
    if "7711-Divine_Armory" not in note:
        meta["note"] = (
            (note + " " if note else "")
            + "Many `eqDa*` entries summarize Divine Armory appendix gear (7711-Divine_Armory*.pdf); confirm tags at the table."
        ).strip()
    for eid, row in NEW_EQUIPMENT.items():
        if eid not in eq:
            eq[eid] = row
    EQUIP.write_text(json.dumps(eq, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print("Tags added (if missing):", ", ".join(sorted(NEW_TAGS)))
    print("Equipment added (if missing):", len(NEW_EQUIPMENT), "templates")


if __name__ == "__main__":
    main()
