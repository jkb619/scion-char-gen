#!/usr/bin/env python3
"""Generate Saints & Monsters supplemental JSON tables (run from repo root).

Outputs:
  data/tables/purviews/15_Scion_Players_Guide_Saints_Monsters_Denizens_and_Magic.json
  data/tables/boons/20_Scion_Players_Guide_Saints_Monsters.json
  data/epicenters.json
  data/tables/knacks/20_Scion_Players_Guide_Saints_Monsters.json

  python3 src/scripts/integrate_saints_monsters_tables.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = ROOT / "src"
DATA_DIR = SRC_DIR / "data"
TABLES = DATA_DIR / "tables"
SAINTS_SOURCE_PDF = "Scion_Players_Guide__Saints__Monsters_(Final_Download).pdf"
KNACKS_SM_PATH = TABLES / "knacks" / "20_Scion_Players_Guide_Saints_Monsters.json"
PURV_SM_PATH = TABLES / "purviews" / "15_Scion_Players_Guide_Saints_Monsters_Denizens_and_Magic.json"
BOONS_SM_PATH = TABLES / "boons" / "20_Scion_Players_Guide_Saints_Monsters.json"


def knack(kid, name, calling, tier_min, kind, desc, mech=None):
    return {
        "id": kid,
        "name": name,
        "callings": [calling],
        "tierMin": tier_min,
        "knackKind": kind,
        "description": desc.strip(),
        "mechanicalEffects": (mech or desc).strip()[:1200],
        "source": f"{SAINTS_SOURCE_PDF} — Saints & Monsters (Calling Knacks)",
    }


def main() -> int:
    # --- Titanic knacks (same as prior build_knacks_saints_monsters - abbreviated import via exec?)
    # Inline full list from existing file if present, else regenerate minimal
    prev = KNACKS_SM_PATH
    titanic: dict = {}
    if prev.is_file():
        raw = json.loads(prev.read_text(encoding="utf-8"))
        for k, v in raw.items():
            if k == "_meta":
                titanic["_meta"] = {
                    "title": "Saints & Monsters — Titanic + optional Callings Knacks",
                    "role": "Merged into bundle.knacks from data/tables/knacks/*.json",
                    "sourcePdf": SAINTS_SOURCE_PDF,
                    "regenerate": "python3 src/scripts/integrate_saints_monsters_tables.py",
                }
                continue
            if isinstance(v, dict) and k.startswith("sm_"):
                titanic[k] = v

    # --- Outsider ---
    out_h = [
        ("sm_outsider_i_cant_you_say", "I Can't, You Say", "Once/session reroll a failed roll; +1 Enhancement if botch, +2 if another character said you'd fail."),
        ("sm_outsider_lovable_scamp", "Lovable Scamp", "When your action would drop Attitude, Knack roll negates reduction per success; extras impose +1 Complication on future Intrigue vs you until bought."),
        ("sm_outsider_narrow_trolling", "Narrow Trolling", "When you drop someone's Attitude, it only drops toward you; their Attitude toward your Band rises."),
        ("sm_outsider_exceptions_that_prove", "Exceptions that Prove", "Once/scene in a Field with a Complication, spend Momentum to ignore it; free if truly alone."),
        ("sm_outsider_no_i_in_team", "There's no I in Team", "Spend Momentum to exclude yourself from a multi-target effect that would include you."),
        ("sm_outsider_master_of_interference", "Master of Interference", "Once/session compelling a Fatebound SG character: you gain 1 Legend, they gain 2 Legend instead of 1."),
        ("sm_outsider_petard_hoister", "Petard Hoister", "+2 Enhancement vs secret plotters/effects until a day passes or outsiders learn."),
        ("sm_outsider_with_friends_like_these", "With Friends Like These", "Spend Momentum vs pantheon social engagement: on success target gains +2 Complication on Procedural/Intrigue involving you; draws you into their scheme."),
    ]
    for kid, name, desc in out_h:
        titanic[kid] = knack(kid, name, "outsider", "mortal", "mortal", desc)
    out_i = [
        ("sm_outsider_black_sheep", "Black Sheep", "When others use Scent the Divine or similar, you read as member of any pantheon except your own."),
        ("sm_outsider_fate_twister", "Fate Twister", "Vs Fatebound: Knack roll successes ≥ Fatebinding strength turns their Fatebound to Jinx for the session (exceptions per PDF)."),
        ("sm_outsider_friendly_face", "Friendly Face", "Once/session declare alliance with an individual and sever their tie to a group/Path until session end."),
        ("sm_outsider_nowhere_man", "Nowhere Man", "Tracking you fails without magic; magic adds +3 Complication or warns you."),
        ("sm_outsider_outside_looking_in", "Outside Looking In", "Outside a building: spend Momentum to sense inside via someone you know there; lose normal senses for duration."),
    ]
    for kid, name, desc in out_i:
        titanic[kid] = knack(kid, name, "outsider", "hero", "immortal", desc)

    # --- Shepherd ---
    sh_h = [
        ("sm_shepherd_a_friend_to_all", "A Friend to All", "You and Ward may exceed Fatebinding limit by tier difference."),
        ("sm_shepherd_and_my_shield", "And My Shield", "Full Defense: Ward in Short range doubles Defense pool."),
        ("sm_shepherd_in_the_nick_of_time", "In the Nick of Time", "Ward attacked in LOS: spend Momentum to move to them instantly."),
        ("sm_shepherd_leading_by_example", "Leading by Example", "When Ward gains Complication, you may take consequences; overcoming it grants them Enhancement = rating, you half."),
        ("sm_shepherd_matchmaker", "Matchmaker", "Your once/session new Fatebinding may be used by another consenting player/SG character instead."),
        ("sm_shepherd_taught_you_everything", "Taught You Everything I Know", "Once/session train Ward — note successes; spend for Just Like in Training / You Won't Stop Me / I Can Do This per PDF."),
    ]
    for kid, name, desc in sh_h:
        titanic[kid] = knack(kid, name, "shepherd", "mortal", "mortal", desc)
    sh_i = [
        ("sm_shepherd_my_senses_tingling", "My Senses are Tingling", "Meet SG characters: aware if Jinx/Nemesis/Rival/Traitor with Ward or Bandmates (not which)."),
        ("sm_shepherd_out_of_frying_pan", "Out of the Frying Pan", "Ward Taken Out in LOS: Knack success negates after armor; uses per Episode = tier difference."),
        ("sm_shepherd_punching_above_weight", "Punching Above Your Weight", "Once/Episode spend Momentum: Ward's attack/defense at Scale = tier difference."),
        ("sm_shepherd_wise_counsel", "Wise Counsel", "Procedural: Ward researches with 0 dots — spend Momentum once/session, Knack roll grants them dots up to 5 for that roll."),
        ("sm_shepherd_you_can_do_this_all_day", "You Can Do This All Day", "Ward buying off Complication: spend Momentum, Knack roll; Ward may use successes to buy off that Complication."),
    ]
    for kid, name, desc in sh_i:
        titanic[kid] = knack(kid, name, "shepherd", "hero", "immortal", desc)

    KNACKS_SM_PATH.parent.mkdir(parents=True, exist_ok=True)
    KNACKS_SM_PATH.write_text(json.dumps(titanic, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    purviews = {
        "_meta": {
            "title": "Denizen & Magic Purviews (Saints & Monsters)",
            "mergedInto": "purviews",
            "sourcePdf": SAINTS_SOURCE_PDF,
        },
        "magic": {
            "id": "magic",
            "name": "Magic",
            "description": "Occult mastery that taps power external to a wielder’s nature—how Sorcerers and some Gods work miracles (not the same as “all divine miracles are magical”).",
            "mechanicalEffects": "Innate: sense Sorcerers; after witnessing another’s Marvel/Boon in scene, reduce your Legend cost to emulate that effect with Magic by 1 (min 1). Heroes with Magic access one Working; Demigods two; Gods three; Techniques as Heroic Knacks. Scions/Gods gain Magic only via Relics/Guides (PDF).",
            "source": f"{SAINTS_SOURCE_PDF} — Ch. 3 Sorcerers (Purview: Magic)",
            "denizenOrSorcery": True,
        },
        "denizenEarthFriend": {
            "id": "denizenEarthFriend",
            "name": "Earth Friend (Denizen)",
            "description": "Kinship with stone, soil, and buried things.",
            "mechanicalEffects": "Innate: see through earth/stone/concrete to Short range without light. Boons: Animate Earth, Commanding the Solid Earth (see PDF pp. 45–46).",
            "source": f"{SAINTS_SOURCE_PDF} — Denizen Purviews",
            "denizenPurview": True,
        },
        "denizenIllusions": {
            "id": "denizenIllusions",
            "name": "Illusions (Denizen)",
            "description": "Pierce deception; weave convincing illusions.",
            "mechanicalEffects": "Innate: see through illusions/disguises; trivial lies detected in your presence; +2 Enhancement vs deliberate lies. Boons: Disguise, Impersonation (PDF p. 46).",
            "source": f"{SAINTS_SOURCE_PDF} — Denizen Purviews",
            "denizenPurview": True,
        },
        "denizenLair": {
            "id": "denizenLair",
            "name": "Lair (Denizen)",
            "description": "Your legend merges with a place you haunt or protect.",
            "mechanicalEffects": "Innate: awareness of intrusion/changes; fetch/store portable items 1/scene; travel to Lair in ~1 hour; Otherworld access may cost Legend. Boons: Homeward Shortcut, Encroaching Den, Sanctum and Refuge (PDF pp. 46–47).",
            "source": f"{SAINTS_SOURCE_PDF} — Denizen Purviews",
            "denizenPurview": True,
        },
        "denizenObdurance": {
            "id": "denizenObdurance",
            "name": "Obdurance (Denizen)",
            "description": "Oaths and guardianships made as physical law.",
            "mechanicalEffects": "Innate: sworn oaths (Legend count) resist betrayal; bypass obstacles by taking Wounds. Boons: Bar the Way, Booming Voice of Conviction, Icon of Resolve (PDF pp. 47–48).",
            "source": f"{SAINTS_SOURCE_PDF} — Denizen Purviews",
            "denizenPurview": True,
        },
        "denizenTransformation": {
            "id": "denizenTransformation",
            "name": "Transformation (Denizen)",
            "description": "Refuse a single shape—skins, beasts, and stranger masks.",
            "mechanicalEffects": "Innate: change form (simple action in Action play); pick benefits per imbue (identity, object, movement, armor, natural weapons). Boons: Counterfeit Visage, Parade of Skins, Shapes of Might (PDF pp. 48–49).",
            "source": f"{SAINTS_SOURCE_PDF} — Denizen Purviews",
            "denizenPurview": True,
        },
        "denizenWaterFriend": {
            "id": "denizenWaterFriend",
            "name": "Water Friend (Denizen)",
            "description": "Command water and move as liquid lightning.",
            "mechanicalEffects": "Innate: Speed Scale 1 in water; fight underwater freely; aquatic animals +1 Attitude. Boons: Watery Hospitality, Water Mastery (PDF p. 49).",
            "source": f"{SAINTS_SOURCE_PDF} — Denizen Purviews",
            "denizenPurview": True,
        },
        "denizenWindFriend": {
            "id": "denizenWindFriend",
            "name": "Wind Friend (Denizen)",
            "description": "Winds obey; breath survives poison and fall.",
            "mechanicalEffects": "Innate: breathe any air; immune to mundane smoke/toxic gas (non-supernatural); see through fog; winds slow falls. Marvels per PDF p. 49.",
            "source": f"{SAINTS_SOURCE_PDF} — Denizen Purviews",
            "denizenPurview": True,
        },
    }
    PURV_SM_PATH.parent.mkdir(parents=True, exist_ok=True)
    PURV_SM_PATH.write_text(json.dumps(purviews, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    boons = {
        "_meta": {
            "title": "Saints & Monsters — Magic & Denizen Boon hooks",
            "mergedInto": "boons",
            "note": "Transcribe full Boon ladders from the PDF into this file over time; Magic and Denizen Purview entries here are starting anchors.",
            "sourcePdf": SAINTS_SOURCE_PDF,
        },
        "magic_assumption_godform": {
            "id": "magic_assumption_godform",
            "name": "Assumption of the Godform",
            "purview": "magic",
            "dot": 1,
            "tierMin": "hero",
            "legendMin": 0,
            "requiresBoonIds": [],
            "description": "Imbue 1 Legend — for the scene gain Enhancement 3 on Sorcery rolls for spells tied to any other Purview you have.",
            "mechanicalEffects": "Cost: Imbue 1 Legend. Duration: One scene. Subject: Self.",
            "source": SAINTS_SOURCE_PDF,
        },
        "magic_bend_fate": {
            "id": "magic_bend_fate",
            "name": "Bend Fate",
            "purview": "magic",
            "dot": 2,
            "tierMin": "hero",
            "legendMin": 2,
            "requiresBoonIds": ["magic_assumption_godform"],
            "description": "Spend 1+ Legend to subtly alter an ongoing ritual, curse, or magical effect you know — one brief phrase alteration; cost 1 Legend per Tier of the effect.",
            "mechanicalEffects": "Spend 1+ Legend. Range: Close. See S&M p. 79.",
            "source": SAINTS_SOURCE_PDF,
        },
        "magic_thrice_great": {
            "id": "magic_thrice_great",
            "name": "Thrice-Great",
            "purview": "magic",
            "dot": 3,
            "tierMin": "demigod",
            "legendMin": 4,
            "requiresBoonIds": ["magic_bend_fate"],
            "description": "Imbue 2 Legend — during extended rituals, each Milestone completed allows a Feat of Scale without spending Legend on mystical-knowledge rolls.",
            "mechanicalEffects": "Imbue 2 Legend. Reflexive. Until ritual completes.",
            "source": SAINTS_SOURCE_PDF,
        },
        "denizen_earth_animate_placeholder": {
            "id": "denizen_earth_animate_placeholder",
            "name": "Animate Earth (Denizen)",
            "purview": "denizenEarthFriend",
            "dot": 1,
            "tierMin": "hero",
            "legendMin": 1,
            "requiresBoonIds": [],
            "description": "Imbue or spend Legend to animate earth as a mindless construct (professional) under your control — full stats in S&M pp. 45–46.",
            "mechanicalEffects": "Placeholder Boon row for chargen UI — confirm costs and construct tags with PDF.",
            "source": SAINTS_SOURCE_PDF,
        },
    }
    BOONS_SM_PATH.parent.mkdir(parents=True, exist_ok=True)
    BOONS_SM_PATH.write_text(json.dumps(boons, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # Epicenters: key = purview id in merged purviews table
    epic_summaries = {
        "artistry": "Performances draw emotional investment; viewers resist with Integrity+Resolve vs your Legend or gain positive Attitude. Investigators of your secrets gain +2 Enhancement.",
        "beasts": "Start of Intrigue/Action: local animals appear; +1 Enhancement if you accept aid. Harder to hide supernatural nature (+Difficulty = Legend).",
        "beauty": "Intrigue/Procedural: impose Legend-rated Adoration/Obsession Complications on interactors.",
        "chaos": "Scene start: others’ actions gain Unfortunate Side Effects Complication; feeds Collateral or Tension alternates per PDF.",
        "darkness": "Once/scene +2 Enhancement to hide/conceal; sleeping targets share dream-influence Intrigue.",
        "death": "Thin life/death barriers; Underworld gates swing; ghosts manifest and understand you; undead not hostile unless provoked.",
        "deception": "+2 Difficulty to pierce your lies/concealment; your Intrigue carries Untrustworthy Complication.",
        "earth": "On/under ground, earth rises as Light then Heavy Cover after risk/injury; damages surroundings.",
        "epicDexterity": "+1 Speed Scale; two Complication: Collateral Damage → Collateral pool or property damage.",
        "epicStamina": "+1 Scale vs physical harm; failed harm attempts add Collateral die or hurt nearby.",
        "epicStrength": "+1 Might Scale; physical actions carry Grievous Collateral Damage; Collateral rolls immediately.",
        "fertility": "Light Cover from rampant growth; vermin/vegetation damage follows you.",
        "fire": "Immune to mundane fire/heat/smoke; others gain +1 Enhancement to start fires/destructive flame in your presence.",
        "forge": "Extra Milestone or duplicate on craft success; Loose Ends Complication may hand work to rivals.",
        "fortune": "Extra Fatebinding; more Legend from Fatebindings; may strengthen a Fatebinding ending soon.",
        "frost": "After cold-related injury/Complication, immune to cold for scene; passion atmospheres chill; Speed Scale users risk Shocking Chill.",
        "health": "Either heal ambient ills / ease First Aid, OR spread pestilence Complications — pick one style per character.",
        "journeys": "Wanderlust in your presence grants Legend (or SG Tension).",
        "moon": "Hide/reveal vs specific targets gain Legend Enhancement.",
        "order": "Sense legal transgressions viscerally; mortals report breaches; +Legend Enhancement tracking lawbreakers.",
        "passion": "+1 Scale to emotional Attitudes/atmospheres.",
        "prosperity": "Windfalls and +Legend Enhancement for money/trade solutions.",
        "sky": "Weather reflects mood; easy to track/read you; once/session Legend Enhancement when storm helps you.",
        "stars": "+1 Scale visual perception; Overwhelmed Complication from vastness.",
        "sun": "First lie/conceal/attack in scene +2 Difficulty vs your brilliance; your concealment suffers +2 Complication.",
        "war": "Cheaper Critical stunt; +Legend Enhancement encouraging violence.",
        "water": "+1 Speed Scale in water; Swept Away Complication for others.",
        "wild": "+2 Survival/Stealth in your presence even in urban environments.",
    }
    epicenters = {
        "_meta": {
            "title": "Titanic Epicenters",
            "sourcePdf": SAINTS_SOURCE_PDF,
            "note": "Titanic Scions use Epicenter text instead of normal Innate for universal Purviews (S&M pp. 97–100). Imbue 1 Legend to suppress all Epicenter effects until reclaimed.",
        }
    }
    for pid, summary in epic_summaries.items():
        epicenters[pid] = {
            "purviewId": pid,
            "summary": summary,
            "collateralNote": "Many entries reference the Collateral Pool (S&M p. 90); if not using Collateral, use the Tension/Momentum alternates in the PDF.",
            "source": f"{SAINTS_SOURCE_PDF} — Maelstroms' Hearts: Epicenters",
        }
    (SRC_DIR / "data" / "epicenters.json").write_text(
        json.dumps(epicenters, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    n = len([k for k in titanic if k != "_meta"])
    print("Wrote", KNACKS_SM_PATH.relative_to(ROOT), n, "knacks")
    print("Wrote", PURV_SM_PATH.relative_to(ROOT), len(purviews) - 1, "purviews")
    print("Wrote", BOONS_SM_PATH.relative_to(ROOT), len(boons) - 1, "boons")
    print("Wrote epicenters.json", len(epicenters) - 1, "entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
