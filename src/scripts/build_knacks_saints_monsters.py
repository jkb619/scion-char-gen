#!/usr/bin/env python3
"""Emit data/knacksSaintsMonsters.json from Saints & Monsters Titanic Knacks (Ch. 4).

Transcribed from Scion_Players_Guide__Saints__Monsters_(Final_Download).pdf text
(data/_extracted/saints_monsters.txt). Re-run after re-extracting the PDF.

  python3 scripts/build_knacks_saints_monsters.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
OUT = SRC / "data" / "knacksSaintsMonsters.json"

SRC = (
    "Scion_Players_Guide__Saints__Monsters_(Final_Download).pdf — "
    "Titanic Knacks (Chapter Four: Titanic Scions, pp. 91–97)"
)


def knack(
    kid: str,
    name: str,
    calling: str,
    tier_min: str,
    knack_kind: str,
    description: str,
    mechanical_effects: str | None = None,
) -> dict:
    return {
        "id": kid,
        "name": name,
        "callings": [calling],
        "tierMin": tier_min,
        "knackKind": knack_kind,
        "description": description.strip(),
        "mechanicalEffects": (mechanical_effects or description).strip()[:1200],
        "source": SRC,
    }


def main() -> int:
    rows: list[tuple[str, str, str, str, str, str, str | None]] = []

    # --- Adversary (heroic then immortal) ---
    adv_h = [
        (
            "sm_adversary_antagonistic_lessons",
            "Antagonistic Lessons",
            "Whenever the results of your actions cause a target of your antagonism to fail, you may adjust their Attitude, cause them to succeed at an action you determine, or instantly create a Fatebinding with the target.",
        ),
        (
            "sm_adversary_jeering_taunts",
            "Jeering Taunts",
            "Once per scene, taunt a target: increase your Defense against their attacks by your Adversary Calling for the round, or penalize the cost of all their stunts by your Adversary Calling for one action (pick one; cannot pick the same twice in a row).",
        ),
        (
            "sm_adversary_lingering_presence",
            "Lingering Presence",
            "After any scene where you made a successful Encourage Behavior roll, spend Momentum in the next scene to reapply the same effects as though you rolled the same successes. Free if the target has negative Attitude toward you.",
        ),
        (
            "sm_adversary_spluttering_incoherence",
            "Spluttering Incoherence",
            "In a scene with a target who has negative Attitude toward you, spend Momentum to prevent them from making any social action until you act again (once per scene).",
        ),
        (
            "sm_adversary_sweet_and_sour",
            "Sweet and Sour",
            "Knack Skill roll: with successes, curse food/drink consumed by the target with spite-poison (Poisoned-like) that inverts others’ Attitudes toward them. Costs Momentum if you witness them eat/drink; free if you served it.",
        ),
        (
            "sm_adversary_theft_of_luck",
            "Theft of Luck",
            "While in the same scene as a target with negative Attitude toward you, after any of their rolls resolve, spend Momentum to take any number of their successes (before Enhancement/stunts) as Enhancement to your next roll. If that causes them to fail, regain the spent Momentum.",
        ),
    ]
    for kid, name, desc in adv_h:
        rows.append((kid, name, "adversary", "mortal", "mortal", desc, None))

    adv_i = [
        (
            "sm_adversary_opposition_without_limit",
            "Opposition Without Limit",
            "When you command, rally, or intrigue enormous forces to oppose another character, imbue (not spend) Legend to invoke your Legendary Title as a Feat of Scale.",
        ),
        (
            "sm_adversary_pawns_for_my_desire",
            "Pawns for My Desire",
            "When socially interacting with a target who has negative Attitude toward you, spend Momentum during any Encourage Behavior roll to succeed as though you achieved exactly the successes required.",
        ),
        (
            "sm_adversary_spitting_curses",
            "Spitting Curses",
            "Layer curses on a target until they must obey. Purchasable up to your Adversary Calling (different curse each). Active Knack grants two known curses and Sling Curses (2s) stunt on Encourage Belief/Behavior or attacks within Close. Includes Incompetence, Ill Fortune, and My Presence curse options per PDF.",
        ),
    ]
    for kid, name, desc in adv_i:
        rows.append((kid, name, "adversary", "hero", "immortal", desc, None))

    # --- Destroyer ---
    des_h = [
        (
            "sm_destroyer_equal_and_opposite",
            "Equal and Opposite",
            "Whenever an enemy moves you (push, throw, etc.), spend Momentum to apply the same effects to the attacker after resolving them on you.",
        ),
        (
            "sm_destroyer_from_destruction",
            "From Destruction",
            "During an extended action to create something, destroy something related to the project to add one milestone and impose Limited Resources (2c) on the project.",
        ),
        (
            "sm_destroyer_give_and_take",
            "Give-and-Take",
            "End one condition on a target (including Injury) in exchange for a destructive sacrifice of equal value (SG arbitrates).",
        ),
        (
            "sm_destroyer_mantle_of_unmaking",
            "Mantle of Unmaking",
            "+1 Defense at close range. When you use Disarm (Origin p. 116), you may destroy a mundane weapon instead of disarming.",
        ),
        (
            "sm_destroyer_mine_now",
            "Mine, Now",
            "If you break an enemy’s weapon after Disarm (including via Mantle of Unmaking), apply that weapon’s tags to your weapon until end of scene; overlapping tags grant +1 Enhancement per overlap to attacks. Cannot destroy Relics.",
        ),
        (
            "sm_destroyer_shattering_grasp",
            "Shattering Grasp",
            "Touch object/structure with Size Scale less than your Destroyer dots: Knack Skill roll; successes shatter it. Spend Momentum to destroy any object you can perceive without touch.",
        ),
        (
            "sm_destroyer_unstoppable_advance",
            "Unstoppable Advance",
            "While you keep moving (path cannot loop), smash through obstacles and hazards unscathed; does not stop restraint/immobilize. Rush counts as forward movement in combat.",
        ),
    ]
    for kid, name, desc in des_h:
        rows.append((kid, name, "destroyer", "mortal", "mortal", desc, None))

    des_i = [
        (
            "sm_destroyer_entropic_pull",
            "Entropic Pull",
            "Add up to your Destroyer Calling dice to one roll; each die adds 1 to Collateral Pool or Tension. Collateral fills → roll with Destroyer Enhancement; Tension ≥10 → SG promotes an enemy with your Destroyer Enhancement on their next action.",
        ),
        (
            "sm_destroyer_hammer_of_the_gods",
            "Hammer of the Gods",
            "Spend Momentum to add (Destroyer/2) Scale to one act of destruction, demolition, or wide-scale violence (stacks normally).",
        ),
        (
            "sm_destroyer_herald_of_the_end",
            "Herald of the End",
            "When working to destroy a person/place/thing at Scale, imbue (not spend) Legend to invoke your Legendary Title as a Feat of Scale.",
        ),
        (
            "sm_destroyer_made_favorable",
            "Made Favorable",
            "Knack Skill roll: successes destroy one Field Complication of your choice (or roll vs its rating + Momentum if intangible). Collateral +1 or Tension +1.",
        ),
        (
            "sm_destroyer_on_a_pale_horse",
            "On a Pale Horse",
            "Instantly kill any trivial target you perceive. 1 Momentum: kill one target in Close range with less than half Health, lower Tier (or Taken Out if same/higher Tier per SG). Cannot target PCs. SG determines outcomes.",
        ),
        (
            "sm_destroyer_the_ties_that_bind",
            "The Ties that Bind",
            "Spend Momentum to destroy a relationship between a target and another character (employer, friend, romance, etc.). Not for magically protected ties, Fatebindings, or higher Tier; not another PC without consent.",
        ),
    ]
    for kid, name, desc in des_i:
        rows.append((kid, name, "destroyer", "hero", "immortal", desc, None))

    # --- Monster ---
    mon_h = [
        (
            "sm_monster_apex_myth",
            "Apex Myth",
            "Gain your Monster dots in Enhancement to Encourage Behavior rolls involving another monster (non-human or same Monster Calling).",
        ),
        (
            "sm_monster_blood_drinker",
            "Blood-Drinker",
            "Enhancement to attacks vs wounded target from Health lost or highest Injury severity (whichever applies).",
        ),
        (
            "sm_monster_contagion",
            "Contagion",
            "Natural Tag attacks spread disease: choose Disease Condition when you Inflict Injury. Chosen when purchased; purchasable up to Monster dots (different disease each).",
        ),
        (
            "sm_monster_implacable",
            "Implacable",
            "When Taken Out, spend Momentum to keep fighting for Monster dots in Turns, then sleep until scene end; on waking, +2 to Monstrous Urge Complication until you fail to buy off.",
        ),
        (
            "sm_monster_keeper_of_taboos",
            "Keeper of Taboos",
            "Once per session, violate a non-violent social taboo without usual consequences; allies may ignore social Complications/Conditions or walk away from narrative fallout (Attitude floor 0). Speaking truth to power through violence/destruction buffs witnesses per PDF.",
        ),
        (
            "sm_monster_red_of_claw_and_fang",
            "Red of Claw and Fang",
            "Monstrous Natural weapon (stinger, horns, spines…): Natural tag + additional tags equal to Monster Calling; +1 Difficulty to conceal; Momentum to retract. Purchasable (Monster) times for separate weapons.",
        ),
        (
            "sm_monster_seizing_jaws",
            "Seizing Jaws",
            "Grapple without hands (maw, tongue, hair…); Monster dots Enhancement to grapple/combat stunts while maintaining hold.",
        ),
        (
            "sm_monster_tell_tale_heart",
            "Tell-Tale Heart",
            "With Q&A procedural Stunt, always ask one extra question about target’s fears/insecurities; +2 Enhancement when leveraging them.",
        ),
        (
            "sm_monster_the_monster_within",
            "The Monster Within",
            "Spend Momentum (free if succumbed to Monstrous Urge) to assume monstrous form: unarmed Natural + two chosen tags; synergy with Red of Claw and Fang; social resolution Difficulty +Monster; custom combat stunt with SG at purchase.",
        ),
    ]
    for kid, name, desc in mon_h:
        rows.append((kid, name, "monster", "mortal", "mortal", desc, None))

    mon_i = [
        (
            "sm_monster_compelling_and_repulsive",
            "Compelling and Repulsive",
            "Social face-to-face and close combat: Reviled (2s) stunt — target gains Revulsion Complication equal to Monster Calling; see PDF for follow-up Difficulty.",
        ),
        (
            "sm_monster_drawn_to_virulence",
            "Drawn to Virulence",
            "Spend Momentum to appear next to anyone you perceive with Poison or Disease Condition; your next attack or Encourage Behavior gains Monster dots Enhancement.",
        ),
        (
            "sm_monster_predators_instincts",
            "Predator's Instincts",
            "When indulging animalistic urges at epic Scale, imbue Legend to invoke Legendary Title as Feat of Scale.",
        ),
        (
            "sm_monster_sloughing_form",
            "Sloughing Form",
            "When Taken Out, spend Momentum: leave a meat shell, reappear in Close Range, recover Monster dots of Injuries (once/session unless reset by Monstrous Urge).",
        ),
        (
            "sm_monster_titanic_stature",
            "Titanic Stature",
            "Under Monstrous Urges, grow >2× size with fearsome mien: +1 Size Scale; Momentum to add Shockwave to attacks using giant form.",
        ),
    ]
    for kid, name, desc in mon_i:
        rows.append((kid, name, "monster", "hero", "immortal", desc, None))

    # --- Primeval ---
    pv_h = [
        (
            "sm_primeval_call_of_the_wild",
            "Call of the Wild",
            "Spend Momentum: call animals, earth/plants, or deep-sea beast to aid you — add Primeval dots Enhancement to any roll (before rolling).",
        ),
        (
            "sm_primeval_depths_of_the_world",
            "Depths of the World",
            "Nothing from nature harms you. Each purchase grants a chosen Resistant Tag (up to Primeval Calling purchases).",
        ),
        (
            "sm_primeval_elemental_body",
            "Elemental Body",
            "Simple action: become one natural element for the scene (or until you end); ignore environmental effects/Complications/Conditions as appropriate.",
        ),
        (
            "sm_primeval_fists_of_the_world",
            "Fists of the World",
            "Unarmed attacks gain Elemental tag (chosen element); second purchase extends to any weapon; repurchase up to Primeval Calling (different element each).",
        ),
        (
            "sm_primeval_tectonic_reveal",
            "Tectonic Reveal",
            "First procedural scene entry: without rolling, Q&A Stunt questions about the earth equal to your Primeval Calling.",
        ),
        (
            "sm_primeval_sheltering_presence",
            "Sheltering Presence",
            "Apply Primeval Knacks that grant immunity/resistance/protection from environment to allies within Close range.",
        ),
        (
            "sm_primeval_the_world_obeys",
            "The World Obeys",
            "Spend Momentum: reduce an environmental Field Complication by your Primeval Calling (may zero it); regain Momentum if eliminated (not for complications you created).",
        ),
    ]
    for kid, name, desc in pv_h:
        rows.append((kid, name, "primeval", "mortal", "mortal", desc, None))

    pv_i = [
        (
            "sm_primeval_alpha_and_omega",
            "Alpha and Omega",
            "In environmental disaster, spend Momentum to end it immediately (and related Conditions) or summon your own disaster as Field Complication (Primeval rating) affecting everyone unless protected.",
        ),
        (
            "sm_primeval_fly_on_wings_of_wind",
            "Fly on Wings of Wind",
            "Spend Momentum: lift self and allies (count = Primeval Calling) on storm/elemental movement; vertical movement in combat, bypass ground hazards.",
        ),
        (
            "sm_primeval_state_shift",
            "State Shift",
            "Spend Momentum: shift water (or with Knack Skill, other matter) one state solid/liquid/gas within Close.",
        ),
        (
            "sm_primeval_tidal_force",
            "Tidal Force",
            "Treat Primeval Calling as Speed Scale on combat movement; may add Shockwave after movement (+1 Collateral or Tension).",
        ),
        (
            "sm_primeval_the_world_entire",
            "The World Entire",
            "When bending massive natural forces (rivers, wildfires, tides), imbue Legend for Legendary Title as Feat of Scale.",
        ),
        (
            "sm_primeval_wild_growth",
            "Wild Growth",
            "Spend Momentum: bless one creature with wild growth to huge Size for the scene; animals become Creature Birthright under your control at Primeval rating; SG/player consent rules per PDF.",
        ),
        (
            "sm_primeval_world_spinner",
            "World-Spinner",
            "Spend Momentum: create environmental Field Complication (Primeval rating) for the scene; extend with +Momentum per extra scene (ends end of session).",
        ),
    ]
    for kid, name, desc in pv_i:
        rows.append((kid, name, "primeval", "hero", "immortal", desc, None))

    # --- Tyrant (heroic) ---
    tyr_h = [
        ("sm_tyrant_away_from_me", "Away From Me", "Rebuke a target in-scene: lower Tier free; same/higher spend Momentum + Clash of Wills — on success they must leave the Field (removed from scene)."),
        ("sm_tyrant_die_for_me", "Die for Me", "Once/session Knack Skill: successes let you redirect harm targeting you to a lower-Tier subject; if they die, second use unlocked."),
        ("sm_tyrant_empowered_by_sycophants", "Empowered by Sycophants", "Enhancement equal to rating of Followers or Creature present for Encourage Behavior/Belief, Tyrant Knack Skill, or intimidation/coercion."),
        ("sm_tyrant_first_and_foremost", "First and Foremost", "Start of social scene: declare yourself focus — SG characters must target you first socially or -2 dice; tie-break OOC if multiple Tyrants."),
        ("sm_tyrant_great_and_terrible", "Great and Terrible", "Spend Momentum: until your next turn, characters targeting you cannot benefit from extra Enhancement unless innate magic (Boon/Knack)."),
        ("sm_tyrant_in_my_stead", "In My Stead", "Once/scene promote lower-Tier subordinate to act socially as you (your Skill+Attribute only). On failure you may dispose of them and succeed exactly."),
        ("sm_tyrant_iron_fisted_order", "Iron-Fisted Order", "Initiative: lower-Tier SG characters cannot act before you; one PC Band member at a time benefits in combat."),
        ("sm_tyrant_pride_goes_before", "Pride Goes Before", "Access Inflated Ego (2s) stunt on social actions — Hubris Condition per PDF; consent rules for PCs; Enhancement inversion on target."),
        ("sm_tyrant_take_the_fall", "Take the Fall", "Once/scene on failed social or unbought social Complication, redirect fallout to a connected character (Bond etc.; PC needs consent)."),
        ("sm_tyrant_terror_at_hand", "Terror at Hand", "Spend Momentum: clear target’s negative Attitude toward you to 0, then summon weapon/armor from fear using Attitude+Legend for Tags until session end (may become Relic)."),
        ("sm_tyrant_total_authority", "Total Authority", "Trivial targets in procedural instantly treat you as authority and volunteer clues as Extra Clue/Interpretation stunts × Tyrant Calling."),
    ]
    for kid, name, desc in tyr_h:
        rows.append((kid, name, "tyrant", "mortal", "mortal", desc, None))

    tyr_i = [
        ("sm_tyrant_i_am_absolute", "I Am Absolute", "Spend Momentum (extra if same+ Tier): command target to take a non–self-harmful social/combat/procedural action they cannot refuse; Titans/Gods may demand return; PC consent."),
        ("sm_tyrant_petty_tyrant", "Petty Tyrant", "In your seat of power, set up to Tyrant Calling arbitrary rules; rulebreakers get -2 Complication; eject if unbought; PCs not forced to obey edicts."),
        ("sm_tyrant_selfish_demand", "Selfish Demand", "Once/session demand lower-Tier target comply as though they rolled successes = Tyrant Calling (must spend on stunts). Cannot demand self-harm or impossible acts."),
        ("sm_tyrant_solipsistic_disdain", "Solipsistic Disdain", "Once/scene spend Momentum to ignore an attack entirely; ambush/surprise may waive cost and allow second use."),
        ("sm_tyrant_squirming_masses", "Squirming Masses", "Coerce fear or obedience at huge Scale: imbue Legend for Legendary Title as Feat of Scale."),
    ]
    for kid, name, desc in tyr_i:
        rows.append((kid, name, "tyrant", "hero", "immortal", desc, None))

    out_obj: dict = {
        "_meta": {
            "title": "Saints & Monsters — Titanic Knacks",
            "role": "Merged into bundle.knacks by the server (see app/services/game_data.py).",
            "sourcePdf": "Scion_Players_Guide__Saints__Monsters_(Final_Download).pdf",
            "chapters": "Chapter Four — Titanic Scions (Knacks pp. 91–97).",
            "regenerate": "python3 scripts/build_knacks_saints_monsters.py",
        }
    }
    for kid, name, calling, tier_min, kk, desc, mech in rows:
        out_obj[kid] = knack(kid, name, calling, tier_min, kk, desc, mech)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out_obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    n = len(rows)
    print(f"Wrote {n} knack entries to {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
