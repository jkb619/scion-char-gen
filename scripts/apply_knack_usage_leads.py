#!/usr/bin/env python3
"""
1) Apply PB-aligned patches to data/knacks.json (fixes stub/Epic rows).
2) Prepend a short usage-frequency clause to each knack `description` when missing.

Run from repo root: python3 scripts/apply_knack_usage_leads.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KNACKS = ROOT / "data" / "knacks.json"

# PB-paraphrased fixes (Pandora’s Box Revised unless noted)
PATCHES: dict[str, dict[str, str]] = {
    "creator_reverse_engineer": {
        "mechanicalEffects": "When you dismantle an object, you immediately understand how to rebuild it or produce new versions from what you learned (subject to materials, time, and Scale as in Pandora’s Box).",
    },
    "creator_touch_of_the_muses": {
        "description": "While collaborators work an artistic project together, their rolls get extra punch from your inspiration.",
        "mechanicalEffects": "On an artistic project, double successes on each roll made by one artistic partner; you may spend Momentum to include yourself. Immortal Knack (two Calling slots to keep active)—Pandora’s Box (Revised) p. 23; Hero p. 226.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf; Scion_Hero_(Final_Download).pdf; community rules mirror cod.spiele-bund.net/scion/knacks",
    },
    "guardian_a_talisman": {
        "description": "Bless an object so its bearer gains +2 Enhancement on rolls to defend or protect against a named threat you set when blessing.",
        "mechanicalEffects": "Indefinite; Knack Skill roll unless the bearer is your charge (then automatic).",
    },
    "guardian_they_cannot_be_touched": {
        "description": "Spend Momentum to make one person you share a Bond with (or who is lower Tier) immune to all damage until the session ends—only when they genuinely need shielding.",
        "mechanicalEffects": "End of session. Immortal Knack (two Calling slots to keep active)—Pandora’s Box (Revised) p. 29.",
    },
    "healer_the_bare_minimum": {
        "description": "Treat serious wounds with improvised, unsanitary tools when nothing better exists.",
        "mechanicalEffects": "You can always tend someone safely: no increased Difficulty and no extra risk to the patient even with only scraps (twigs, dirt, etc.). Surgery under those conditions stays at normal Difficulty.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Healer — The Bare Minimum",
    },
    "healer_combat_medic": {
        "description": "Keep allies on their feet during a fight with battlefield first aid.",
        "mechanicalEffects": "Once per turn while tending an ally’s wounds in combat, remove any +1 Bruised Injury they have (including armor damage) without rolling. You cannot take Mixed actions while using this Knack.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Healer — Combat Medic",
    },
    "healer_damage_conversion": {
        "description": "Convert injuries downward when you give real medical attention.",
        "mechanicalEffects": "When you administer medical attention to a patient or yourself as an action, convert each Injury one step down the track (Maimed→Injured→Bruised→healed).",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Healer — Damage Conversion",
    },
    "healer_doctor_s_kit": {
        "description": "Spend held successes from your Knack roll to erase allies’ injuries during a fight.",
        "mechanicalEffects": "At the start of a combat scene, roll your Knack Skill and bank successes; spend them when a bandmate or ally in your range band takes an Injury (Ice Pack 1s / Swift Bandaging 2s / Emergency Operation 4s until scene end per book).",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Healer — Doctor’s Kit",
    },
    "healer_immunization_booster": {
        "description": "Shelter a small circle of patients from disease, poison, and slow recovery.",
        "mechanicalEffects": "Designate up to your Knack Skill in characters under your care. While protected, they gain +2 Enhancement to resist poison and disease and to recover from Injuries; protected Storyguide characters auto-resist as the book describes.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Healer — Immunization Booster",
    },
    "healer_instant_diagnosis": {
        "description": "Diagnose ailments and context after meaningful interaction with a patient.",
        "mechanicalEffects": "After meaningful interaction with an ailing target, you know what is wrong and other pertinent medical facts; supernatural illness may require a Knack Skill roll opposed by whoever afflicted them.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Healer — With a Glance (listed as Instant Diagnosis in app data)",
    },
    "healer_surgeon_with_the_hands_of_gods": {
        "description": "Halve procedure time; no extra Difficulty for critically ill or injured patients.",
        "mechanicalEffects": "Halve the time needed for any medical procedure (e.g. surgery). You never suffer increased Difficulty to treat critically ill or injured patients.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Healer — Surgeon with the Hands of God",
    },
    "healer_breath_of_life": {
        "mechanicalEffects": "If you touch a target within three minutes of death, spend Legend to restore them with all Injury boxes filled; after three minutes they cannot be revived this way. Immortal Knack (two Calling slots to keep active)—Pandora’s Box (Revised).",
    },
    "healer_reconstruction": {
        "description": "Remove disabling conditions and reshape your Attributes between sessions.",
        "mechanicalEffects": "Once per day, roll Knack Skill; on any success, remove one non-illness Condition (blindness, lost limb, paralysis, PTSD, etc.). Spend Momentum for additional removals. At session start you may reorder your Attribute dots within the same categories (book limits). Immortal Knack (two Calling slots to keep active)—Pandora’s Box (Revised).",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Healer — Reconstruction",
    },
    "hunter_eyes_in_the_blinds": {
        "description": "Invest power in a token to watch a Field as if you were there.",
        "mechanicalEffects": "Spend Momentum to charge a small token and place it in a Field you are aware of. While it remains, you observe that Field as if present; lasts one in-game day or one session of play, whichever is longer. Token notice Difficulty equals your Hunter Calling dots. Ends if the token leaves or is destroyed.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Hunter — Eyes in the Blinds",
    },
    "hunter_it_s_a_trap": {
        "mechanicalEffects": "Lay ambushes or hazards while hunting so they stay unnoticed until they spring; trap ratings, Structure, and opposed perception follow Pandora’s Box Hunter (Revised). Confirm this knack’s exact title in your printing if it differs.",
    },
    "judge_on_the_case": {
        "description": "While you investigate an event or scene (“casing”), you read motives and spot clues more keenly.",
        "mechanicalEffects": "+1 Enhancement (before the roll) to discern motives and search for clues while casing; casing lasts until the end of the session.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Judge — On the Case (p. 37)",
    },
    "liminal_unerring_delivery": {
        "description": "Send a message through an intermediary so it reaches the recipient immediately, even off-grid.",
        "mechanicalEffects": "Choose a messenger (passerby, small spirit, etc.); the message reaches the intended recipient instantly as in Pandora’s Box Liminal — Unerring Delivery.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Liminal — Unerring Delivery",
    },
    "lover_i_am_a_fire": {
        "description": "Fan the feelings one person has toward another (or toward you); Storyguide shapes NPC passions.",
        "mechanicalEffects": "When you stoke affection between people (including toward yourself), work with the Storyguide on how passion manifests; bandmates require player consent. If you target yourself toward a chosen partner, +1 Enhancement to Social rolls involving them until the session ends.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Lover — I am a Fire",
    },
    "sage_blockade_of_reason": {
        "description": "Call out grifts and nonsense so cons and coercion bounce off you.",
        "mechanicalEffects": "Lower-Tier characters cannot trick, coerce, swindle, or con you. Supernatural attempts to do so provoke a Clash of Wills; you gain +2 Enhancement on that Clash.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Sage — Blockade of Reason",
    },
    "sage_master_of_the_world": {
        "description": "Inside a Field, you spot plausible Enhancements or Complications others overlook—if they fit the Field’s features.",
        "mechanicalEffects": "While in a Field, assign up to three total Enhancement/Complication points (split between them) that are obvious to you but not to other observers; each must suit the Field (no impossible props or contradictions). At most three such points may apply to the Field at once, no matter how many Scions use this Knack.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Sage — Master of the World",
    },
    "sage_palace_of_memory": {
        "description": "Recall what you lived or studied without dropping salient facts; reclaim missed procedural clues.",
        "mechanicalEffects": "No roll needed to remember salient facts or clues you could know; you may assert a narrative advantage you reasonably remembered without invoking a Path. If you missed a Procedural Clue in an earlier scene, you may try once to rediscover it (per Pandora’s Box).",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Sage — Palace of Memory",
    },
    "sage_presence_of_magic": {
        "description": "Sense when something nearby is truly magical or sacred.",
        "mechanicalEffects": "Ask the Storyguide if a place or object is magical or sacred; they must answer honestly yes or no, bypassing Occult identification rolls for that question.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Sage — Presence of Magic",
    },
    "sage_office_hours": {
        "description": "Coach someone through a problem you can solve—or lean in yourself if you cannot.",
        "mechanicalEffects": "When someone brings you a problem you can solve, they gain +1 Enhancement (before rolls) to resolve it with your coaching; if you cannot solve it, you gain the same bonus to fix it yourself. Spend Momentum to pull a Storyguide character to you with a problem that needs solving.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Sage — Office Hours",
    },
    "sage_omniglot_translation": {
        "description": "Speak and read foreign languages flawlessly; churn out written translations fast.",
        "mechanicalEffects": "Conversation and reading in foreign languages are perfect (no accent). Turn out written translations in your native language in minutes without a roll; divine runes or gods’ handwriting still needs a Knack Skill roll but stays swift.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Sage — Omniglot Translation",
    },
    "sage_cipher": {
        "description": "Break lower-Tier codes and author encryption only peers can realistically crack.",
        "mechanicalEffects": "You are never stumped by codes or encryption set by a lower-Tier character. Encryption you create cannot be solved by lower-Tier characters; you add half your Legend (round up) in Enhancement to resist decryption from equals or betters (before the roll). Immortal Knack (two Calling slots to keep active)—Pandora’s Box (Revised) p. 57.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Sage — Cipher",
    },
    "trickster_blather_and_skite": {
        "description": "Nonsense buys time for infiltration or escapes.",
        "mechanicalEffects": "Automatic on same- or lower-Tier targets; against higher Tier, roll Knack Skill. Each success buys five minutes of in-game time or one combat turn (whichever fits) before enemies realize the intrusion; bandmates require their players’ consent.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Trickster — Blather and Skite",
    },
    "trickster_smoke_and_mirrors": {
        "description": "Once per scene. When a hit would take you out, spend Momentum to negate that damage, slip one range band away, and leave a brief crumbling afterimage.",
        "mechanicalEffects": "Once per scene, when you would be Taken Out, spend Momentum instead: negate the damage that would take you out and move one range band from your attacker, leaving an outline that crumbles away moments later.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Trickster — Smoke and Mirrors (p. 62)",
    },
    "trickster_the_fish_trick": {
        "mechanicalEffects": "Exchange the positions of two inanimate objects in your line of sight. If either object is supernatural, the owner may oppose with a Clash of Wills. Confirm exact costs and limits in your printing of Pandora’s Box Trickster knacks.",
    },
    "trickster_rumor_miller": {
        "mechanicalEffects": "Make a Knack Skill roll; any successes mean the rumor about the target reaches the people who should hear it (boss, spouse, friends, etc.) as in Pandora’s Box.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Trickster — Rumor Miller",
    },
    "trickster_doppelgaenger": {
        "mechanicalEffects": "Roll Knack Skill; with successes you create an exact copy of yourself with your Attributes, Skills, Knacks, and Boons, controlled by you for social or investigative tasks. It cannot use teamwork, dissipates if attacked, and otherwise lasts days equal to your Trickster Calling dots. Immortal Knack (two Calling slots to keep active)—Pandora’s Box (Revised) p. 63.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Trickster — Doppelgänger",
    },
    "warrior_death_by_teacup": {
        "description": "An improvised weapon temporarily takes the weapon profile of a similar-sized real armament (teacup as knuckles, glass shard as knife, etc.).",
        "mechanicalEffects": "Until you release it, it breaks, you stop using it with a Warrior Skill, or (if thrown) until impact—Pandora’s Box (Revised) p. 66.",
        "source": "SCION_Pandoras_Box_(Revised_Download).pdf, Warrior — Death by Teacup",
    },
}

_META_TAIL = re.compile(
    r"\s*Immortal Knack.*$"
    r"|\s*General / Heroic Knack.*$"
    r"|—see Hero.*$"
    r"|—Pandora.*$"
    r"|\s*Pandora’s Box \(Revised\) p\. \d+.*$"
    r"|\s*Hero p\. \d+.*$",
    re.IGNORECASE | re.DOTALL,
)


def _core_mech(mech: str) -> str:
    s = (mech or "").strip()
    return _META_TAIL.sub("", s).strip()


def _timingish(fragment: str) -> bool:
    f = fragment.lower()
    keys = (
        "once per",
        "one scene",
        "one fight",
        "one mission",
        "one session",
        "one party",
        "one task",
        "one plan",
        "one build",
        "one repair",
        "one building",
        "8 hours",
        "eight hours",
        "instant",
        "indefinite",
        "condition",
        "until ",
        "end of session",
        "end of the session",
        "at the start",
        "each time",
        "while ",
        "when you dismantle",
        "includes working",
        "the first time each scene",
        "pick one social",
        "when active:",
        "when you wish",
        "with a sniff",
        "in a scene where",
        "at the start of a combat scene",
        "when you administer",
        "after meaningful",
        "designate up to",
        "halve the time",
        "spend momentum to charge",
        "lay ambushes",
        "lower-tier characters",
        "you are never stumped",
        "when someone brings",
        "conversation and reading",
        "no roll needed",
        "ask the storyguide",
        "you can always tend",
        "+1 enhancement",
        "on an artistic project",
        "roll knack skill; with successes",
        "automatic on same",
        "make a knack skill roll",
        "exchange the positions",
        "fan the feelings",
        "when you release it",
        "choose a messenger",
        "if you touch a target within",
        "variable;",
        "origin:",
        "per pandora",
    )
    return any(k in f for k in keys)


def usage_lead(mech: str) -> str | None:
    if not mech or not str(mech).strip():
        return None
    raw = mech.strip()
    low = raw.lower()
    if low.startswith("confirm ") or low.startswith("listed "):
        return None
    if "inverted knack" in low[:120]:
        return None
    if low.startswith("variable;"):
        return "Frequency varies by effect—confirm with your Storyguide"
    if low.startswith("mortal knack option"):
        return "Origin only: one Mortal Knack of this style active at a time unless you purchase extras"
    if low.startswith("martial knack"):
        return "Per Pandora’s Box Warrior rules at your table"

    c = _core_mech(raw)
    if not c:
        return None
    cl = c.lower()

    if cl.startswith("once per session"):
        return "Once per session"
    if cl.startswith("once per scene"):
        if cl.startswith("once per scene, when"):
            return "Once per scene"
        m = re.match(r"(Once per scene[^.]*\.)", c, re.I)
        if m:
            return m.group(1).strip().rstrip(".")
        m2 = re.match(r"(Once per scene[^:]*)(?::|$)", c, re.I)
        return (m2.group(1).strip() if m2 else "Once per scene")
    if cl.startswith("once per turn"):
        return "Once per turn"
    if cl.startswith("once per day"):
        return "Once per day"
    if cl.startswith("the first time each scene"):
        return "The first time each scene"
    if cl.startswith("pick one social skill"):
        return "Once per session"
    if cl.startswith("one scene"):
        return "One scene"
    if cl.startswith("one fight"):
        return "One fight"
    if cl.startswith("one mission"):
        return "One mission"
    if cl.startswith("one session"):
        return "One session"
    if cl.startswith("one party"):
        return "One party"
    if cl.startswith("one task"):
        return "One task"
    if cl.startswith("one plan"):
        return "One plan"
    if cl.startswith("one build or repair action"):
        return "One Build or Repair action"
    if cl.startswith("one building or repair action"):
        return "One Building or Repair action"
    if cl.startswith("one repair or build action"):
        return "One Repair or Build action"
    if cl.startswith("8 hours"):
        return "Eight hours"
    if cl.startswith("instant"):
        return "Instant"
    if cl.startswith("end of session"):
        return "End of the session"
    if cl.startswith("indefinite"):
        h = c.split(";")[0].strip()
        return h if len(h) <= 96 else "Indefinite while the Knack remains active"
    if cl.startswith("condition"):
        return c.split(";")[0].strip()[:110]
    if cl.startswith("until "):
        return c.split(";")[0].strip()[:120]
    if cl.startswith("includes working"):
        return "One project through completion, then mandatory rest"
    if cl.startswith("when active:"):
        return "Session-long while active"
    if cl.startswith("+2 enhancement to shift atmosphere"):
        return "While performing in a scene (optional Momentum to reset atmosphere first)"
    if cl.startswith("when you wish,"):
        return "Whenever you invoke it (no fixed clock)"
    if cl.startswith("with a sniff or listen"):
        return "When you take a moment to sniff or listen (per book)"
    if cl.startswith("in a scene where"):
        return "In scenes where you would be in danger"
    if cl.startswith("at the start of a combat scene"):
        return "At the start of each qualifying combat scene"
    if cl.startswith("when you dismantle"):
        return "Each time you dismantle an object"
    if cl.startswith("when you administer"):
        return "Each time you administer medical attention as an action"
    if cl.startswith("after meaningful interaction"):
        return "After meaningful interaction with an ailing subject"
    if cl.startswith("designate up to"):
        return "While your designated patients remain under your care"
    if cl.startswith("halve the time"):
        return "Each qualifying medical procedure you perform"
    if cl.startswith("spend momentum to charge"):
        return "While the token stays placed (one day in-game or one session, whichever is longer)"
    if cl.startswith("lay ambushes"):
        return "While hunting and laying traps (per Pandora’s Box Hunter)"
    if cl.startswith("lower-tier characters"):
        return "Always on (passive)"
    if cl.startswith("you are never stumped"):
        return "Always on (passive)"
    if cl.startswith("when someone brings"):
        return "Whenever someone brings you a problem you can solve"
    if cl.startswith("conversation and reading"):
        return "While translating or dictating written work in play"
    if cl.startswith("no roll needed to remember"):
        return "Whenever you recall studied or experienced facts"
    if cl.startswith("ask the storyguide"):
        return "Each time you ask about a place or object in play"
    if cl.startswith("you can always tend"):
        return "Always when you tend a patient, even with improvised tools"
    if cl.startswith("+1 enhancement (before the roll)"):
        return "End of the session while you are casing an investigation"
    if cl.startswith("on an artistic project"):
        return "For the duration of an artistic project"
    if cl.startswith("roll knack skill; with successes"):
        return "Each time you roll to create your duplicate"
    if cl.startswith("automatic on same- or lower-tier"):
        return "Automatic on same or lower Tier; rolled against higher Tier"
    if cl.startswith("make a knack skill roll; any successes"):
        return "Each time you roll to seed a rumor"
    if cl.startswith("exchange the positions"):
        return "Each time you swap two objects in line of sight"
    if cl.startswith("fan the feelings"):
        return "Each time you stoke feelings between people (per book)"
    if cl.startswith("when you release it, it breaks"):
        return "Until you release the object, it breaks, you stop using it with a Warrior Skill, or (if thrown) until impact"
    if cl.startswith("choose a messenger"):
        return "Each delivery you send through an intermediary"
    if cl.startswith("if you touch a target within"):
        return "Within three minutes of death, if you can touch the body"

    head = c.split(";")[0].strip()
    if len(head) <= 110 and _timingish(head):
        if not head.endswith((".", "!", "?")):
            return head
        return head.rstrip(".!")
    fs = re.split(r"\. (?=[A-Z])", head)
    frag = fs[0].strip() if fs else head
    if _timingish(frag) and len(frag) <= 130:
        return frag.rstrip(".")
    return None


def _should_prepend(desc: str, lead: str) -> bool:
    d = (desc or "").strip().lower()
    l = lead.strip().lower()
    if not l:
        return False
    if d.startswith(l) or d.startswith(l + "."):
        return False
    if l + "." in d or (l + " ") in d:
        return False
    return True


def merge_description(desc: str, mech: str) -> str:
    lead = usage_lead(mech)
    if not lead:
        return desc
    lead = lead.strip()
    if not lead.endswith((".", "!", "?")):
        lead += "."
    d = (desc or "").strip()
    if not d:
        return lead
    if not _should_prepend(d, lead.rstrip(".")):
        return desc
    return f"{lead} {d}".strip()


def _apply_usage_only(path: Path) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    updated = 0
    for key, val in data.items():
        if key.startswith("_") or not isinstance(val, dict):
            continue
        if "description" not in val:
            continue
        old = val["description"]
        val["description"] = merge_description(old, val.get("mechanicalEffects") or "")
        if val["description"] != old:
            updated += 1
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return updated


def main() -> int:
    data = json.loads(KNACKS.read_text(encoding="utf-8"))
    for kid, patch in PATCHES.items():
        if kid not in data:
            continue
        data[kid].update(patch)

    updated = 0
    for key, val in data.items():
        if key.startswith("_") or not isinstance(val, dict):
            continue
        if "description" not in val:
            continue
        old = val["description"]
        val["description"] = merge_description(old, val.get("mechanicalEffects") or "")
        if val["description"] != old:
            updated += 1

    KNACKS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {KNACKS.relative_to(ROOT)} ({updated} descriptions gained a usage lead)")

    for rel in ("data/knacksTitansRising.json", "data/knacksSaintsMonsters.json"):
        p = ROOT / rel
        if p.exists():
            n = _apply_usage_only(p)
            print(f"Wrote {p.relative_to(ROOT)} ({n} descriptions gained a usage lead)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
