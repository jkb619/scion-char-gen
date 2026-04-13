#!/usr/bin/env python3
"""
Regenerate data/boons.json: twelve Boon catalog entries per Purview in purviews.json.

Each catalog position is a separate Boon entry (selectable in the wizard) with tier/Legend gates.
Official proper names and mechanics remain in Pandora’s Box / tier PDFs — confirm at table.

Run from repo root:
  python3 scripts/generate_boons_catalog.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PURVIEWS_PATH = ROOT / "data" / "purviews.json"
PB_MECH_SNIPPETS_PATH = ROOT / "data" / "boonPbMechanics.json"
PB_MECH_PATCH_PATH = ROOT / "data" / "boonPbMechanicsPatch.json"
OUT_PATH = ROOT / "data" / "boons.json"


def _apply_supplement_signature_ladders(boons: dict[str, object]) -> None:
    """Pantheon-gated Signature Purviews and MotM-published Arcane Calculus rows."""

    def gate(pid: str, pantheon_ids: list[str], source_note: str) -> None:
        for n in range(1, 13):
            bid = f"{pid}_dot_{n:02d}"
            e = boons.get(bid)
            if isinstance(e, dict):
                e["pantheonAnyOf"] = pantheon_ids
                e["source"] = source_note

    gate(
        "nemeton",
        ["nemetondevos"],
        "Mysteries_of_the_World_-_Scion_Companion_(Final_Download).pdf — Signature Purview: Nemeton",
    )
    gate(
        "asha",
        ["yazata"],
        "Mysteries_of_the_World_-_Scion_Companion_(Final_Download).pdf — Signature Purview: Asha",
    )

    pb_sig = "SCION_Pandoras_Box_(Revised_Download).pdf — Pantheon Signature Purview"
    for pid, pantheon_ids in (
        ("shuila", ["anunna"]),
        ("pachakutic", ["apu"]),
        ("atuaMana", ["atua"]),
        ("paganito", ["balahala"]),
        ("dvoeverie", ["bogovi"]),
        ("yoga", ["deva"]),
        ("marzeh", ["ilhm"]),
        ("tzolkin", ["kuh"]),
        ("yaoyorozuNoKamigami", ["kami"]),
        ("dodaem", ["manitou"]),
        ("heku", ["netjer"]),
        ("tianming", ["shen"]),
        ("qut", ["tengri"]),
        ("yidam", ["palas"]),
        ("behique", ["zem"]),
    ):
        gate(pid, pantheon_ids, pb_sig)

    motm = "Scion_Masks_of_the_Mythos_(Final_Download).pdf — Arcane Calculus"
    # MotM: two titled Boons only; do not emit further arcaneCalculus_dot_* catalog rows (chronicle extras stay at the table).
    for n in range(1, 3):
        bid = f"arcaneCalculus_dot_{n:02d}"
        e = boons.get(bid)
        if not isinstance(e, dict):
            continue
        e["pantheonAnyOf"] = ["mythos"]
        if n == 1:
            e["name"] = "Disturbing Visions"
            e["description"] = (
                "By reading Mythos scripts or inscribing geometries, you receive a vision-compulsion: "
                "your Short-Term Deed becomes a minor Mythos mission for the session. Completing it grants "
                "1 Awareness and 1 Legend; afterward you can see beings touched by the Mythos."
            )
            e["mechanicalEffects"] = (
                "Cost: Free\nDuration: Instant\nSubject: Self\nRange: —\nAction: Simple\nOnce per session."
            )
            e["source"] = f"{motm} (Disturbing Visions)"
        else:
            e["name"] = "Mouth of Madness"
            e["description"] = (
                "Speak of an investigation target; everyone in range babbles everything they know. "
                "You gain Enhancement 3 on follow-up investigative actions for the session and +1 Scale "
                "when acting on those clues where appropriate."
            )
            e["mechanicalEffects"] = (
                "Cost: Spend 1 Awareness\nDuration: One scene\nSubject: Multiple characters\n"
                "Range: Short\nAction: Simple\nClash: Presence + Legend vs. Resolve + Legend"
            )
            e["source"] = f"{motm} (Mouth of Madness)"


# Wyrd uses three named Hero Boons in Scion: Hero (Æsir Signature), not the twelve-entry Fortune-style catalog.
_SKIP_TWELVE_RUNG_PURVIEWS = frozenset({"wyrd"})

_SHEET_MECH_KEYS = ("cost", "duration", "subject", "range", "action", "clash")


def _split_mechanicals_line_dict(mech: str) -> dict[str, str]:
    """Match static/js/boonMechanicalParse.js label splitting for Cost/Duration/… lines."""
    o = {k: "" for k in _SHEET_MECH_KEYS}
    text = (mech or "").strip()
    if not text:
        return o
    pat = re.compile(r"\b(Cost|Duration|Subject|Range|Action|Clash)\s*:\s*", re.I)
    matches = list(pat.finditer(text))
    for i, m in enumerate(matches):
        key = m.group(1).lower()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        val = text[start:end].strip()
        val = re.sub(r"\s+\.+$", "", val).strip()
        if key in o:
            o[key] = val
    return o


def _apply_sheet_index_fields(boons: dict[str, object], pur: dict[str, object]) -> None:
    """Denormalize purview display name and labeled mechanical lines for auditing / sheet."""
    for bid, entry in boons.items():
        if str(bid).startswith("_") or not isinstance(entry, dict):
            continue
        pid = entry.get("purview")
        pid_s = str(pid) if pid is not None else ""
        row = pur.get(pid_s) if pid_s and isinstance(pur.get(pid_s), dict) else None
        entry["purviewName"] = str(row.get("name") or pid_s) if row else pid_s
        d = _split_mechanicals_line_dict(str(entry.get("mechanicalEffects") or ""))
        for k in _SHEET_MECH_KEYS:
            entry[k] = d[k]

# Paraphrased from SCION_Pandoras_Box_(Revised_Download).pdf — Darkness Purview (pp. 227–229 in this PDF).
# Do not paste full copyrighted stat blocks; keep summaries short for UI/export.
_CURATED_BOONS: dict[str, dict[str, str]] = {
    "darkness_dot_01": {
        "description": (
            "Strip away the vision of any number of characters in range, imposing a blinded Condition on them for the scene. "
            "If you target only trivial characters, using this Boon is free."
        ),
        "mechanicalEffects": (
            "Cost: Imbue 1 Legend (free for trivial-only targets)\n"
            "Duration: One scene\nSubject: Multiple characters\nRange: Short\nAction: Simple"
        ),
    },
    "darkness_dot_02": {
        "description": (
            "Shape a dream and send it after someone you can uniquely describe. The next time they sleep, the Boon triggers: "
            "you may make an influence roll by controlling the dream’s events and how you appear, easing hostile Attitudes or "
            "exploiting Bonds toward others; appearing as yourself still raises Attitude by one (does not stack with other magical Attitude bonuses)."
        ),
        "mechanicalEffects": (
            "Cost: Spend 1 Legend\nDuration: Until the target next sleeps\nSubject: One character\nRange: Long\nAction: Simple"
        ),
    },
    "darkness_dot_03": {
        "description": (
            "Spend Legend to dissolve into natural shadow with everything you carry, becoming insubstantial. Remain there or "
            "reflexively spend additional Legend to jump to any other shadow you can perceive, as often as you pay for, until the scene ends. "
            "Aggressive action ends concealment; bright light forces another Legend spend to relocate or you emerge; with no shadow or Legend left, you reincorporate."
        ),
        "mechanicalEffects": (
            "Cost: Variable (1+ Legend)\nDuration: One scene\nSubject: Self\nRange: —\nAction: Reflexive"
        ),
    },
    "darkness_dot_04": {
        "description": (
            "Bless a target as a creature of the night—nocturnal traits, a living pall of darkness, or similar. While the Condition lasts, "
            "they gain Enhancement 3 on Intrigue actions involving nocturnal animals or night-, dream-, or darkness-linked Denizens, and the same bonus to hide in shadow or conceal identity. "
            "The Condition ends when sunlight falls on the target."
        ),
        "mechanicalEffects": (
            "Cost: Imbue 1 Legend\nDuration: Condition\nSubject: One character\nRange: Medium\nAction: Simple"
        ),
    },
    "darkness_dot_05": {
        "description": (
            "Turn a sleeper’s nightmares tangible: they gain the Living Nightmare Condition with a +3 Complication on all rolls from distraction; "
            "if not bought off, the nightmare closes a range band until it strikes in Close range (Occult + Presence vs. Defense), inflicting a strange Injury. "
            "Only you and the target perceive it; it can count as a Clue. They can try Integrity + Cunning vs. your Occult + Presence in Close range to end it for the scene."
        ),
        "mechanicalEffects": (
            "Cost: Spend 1 Legend\nDuration: Condition\nSubject: One character\nRange: Short\nAction: Simple"
        ),
    },
    "darkness_dot_06": {
        "description": (
            "Lull a character to sleep in seconds if they are not in combat or a similarly high-stakes situation; they stay asleep until the scene ends "
            "unless attacked or magically roused. You may put multiple trivial targets to sleep in range, even in combat."
        ),
        "mechanicalEffects": (
            "Cost: Imbue 1 Legend\nDuration: One scene\nSubject: One character or multiple trivial characters\nRange: Short\nAction: Simple"
        ),
    },
    "darkness_dot_07": {
        "description": (
            "Draw out dark thoughts so targets want to confess secrets: they take 3 Complication on social actions, and failing to buy it off forces them to share their darkest deed "
            "(Storyguide defines what counts). If irrelevant to your inquiry, gain +2 Enhancement to leverage what you learned. Ends on confession or at next sunrise."
        ),
        "mechanicalEffects": (
            "Cost: Imbue 1 Legend\nDuration: Varies\nSubject: One character\nRange: Short\nAction: Simple"
        ),
    },
    "darkness_dot_08": {
        "description": (
            "Create shadow minions that obey you—build them as antagonists (Origin pp. 143–145): one Professional-level threat or several Mooks, "
            "Incorporeal with a fire Vulnerability. They cannot be turned against you; they vanish the turn after you reclaim your Awareness from the Boon."
        ),
        "mechanicalEffects": "Cost: Imbue 1 Awareness\nDuration: Indefinite\nSubject: Self\nRange: —\nAction: Simple",
    },
    "darkness_dot_09": {
        "description": (
            "Compel shadows you can perceive to divulge secrets of what they have “seen.” Answers are truthful but limited by the shadow’s nature "
            "(torch vs. lantern vs. human cast). Shadows default to Attitude 3 toward you; while Legend remains imbued, their answers grant Enhancement 3 on applicable rolls."
        ),
        "mechanicalEffects": "Cost: Imbue 1 Legend\nDuration: Indefinite\nSubject: Shadows\nRange: Long\nAction: Simple",
    },
}


def _apply_aesir_wyrd_hero_boons(boons: dict[str, object]) -> None:
    hero = "SCION_Scion_Hero_(Final_Download).pdf"
    for n in range(1, 13):
        bid = f"wyrd_dot_{n:02d}"
        boons.pop(bid, None)
    boons["wyrd_cast_the_runes"] = {
        "id": "wyrd_cast_the_runes",
        "name": "Cast the Runes",
        "purview": "wyrd",
        "dot": 1,
        "tierMin": "hero",
        "legendMin": 0,
        "requiresBoonIds": [],
        "pantheonAnyOf": ["aesir"],
        "description": "Æsir Wyrd Specialty Boon (Scion: Hero).",
        "mechanicalEffects": (
            "Cost: (see Scion: Hero — Wyrd).\nDuration: (printed).\nSubject: (printed).\nRange: (printed).\nAction: (printed)."
        ),
        "source": hero,
    }
    boons["wyrd_runic_charm"] = {
        "id": "wyrd_runic_charm",
        "name": "Runic Charm",
        "purview": "wyrd",
        "dot": 2,
        "tierMin": "hero",
        "legendMin": 0,
        "requiresBoonIds": ["wyrd_cast_the_runes"],
        "pantheonAnyOf": ["aesir"],
        "description": "Æsir Wyrd Specialty Boon (Scion: Hero).",
        "mechanicalEffects": (
            "Cost: (see Scion: Hero — Wyrd).\nDuration: (printed).\nSubject: (printed).\nRange: (printed).\nAction: (printed)."
        ),
        "source": hero,
    }
    boons["wyrd_spin_the_thread"] = {
        "id": "wyrd_spin_the_thread",
        "name": "Spin the Thread",
        "purview": "wyrd",
        "dot": 3,
        "tierMin": "hero",
        "legendMin": 0,
        "requiresBoonIds": ["wyrd_runic_charm"],
        "pantheonAnyOf": ["aesir"],
        "description": "Æsir Wyrd Specialty Boon (Scion: Hero).",
        "mechanicalEffects": (
            "Cost: (see Scion: Hero — Wyrd).\nDuration: (printed).\nSubject: (printed).\nRange: (printed).\nAction: (printed)."
        ),
        "source": hero,
    }


def main() -> None:
    pur = json.loads(PURVIEWS_PATH.read_text(encoding="utf-8"))
    pv_ids = sorted(
        k
        for k, v in pur.items()
        if not str(k).startswith("_") and isinstance(v, dict) and "id" in v
    )

    meta = {
        "note": (
            "Primary rules text: SCION_Pandoras_Box_(Revised_Download).pdf. "
            "Large catalog: twelve Boon entries per Purview in purviews.json (`_dot_01` … `_dot_12`); "
            "each is one choosable id for UI/export. Supplement or tier books only where PB points to them. "
            "Optional data/boonPbMechanics.json (scripts/extract_pb_boon_mechanics.py) and data/boonPbMechanicsPatch.json "
            "merge Cost/Duration/Subject/Range/Action lines for the Review sheet parser. "
            "Each entry also stores purviewName plus cost/duration/subject/range/action/clash (parsed from mechanicalEffects) for audits. "
            "Regenerate with: python3 scripts/generate_boons_catalog.py"
        ),
        "eligibility": {
            "purview": "Required Purview id; character must hold this Purview.",
            "purviewName": "Display Purview name (from purviews.json); denormalized for sheets/audits.",
            "cost": "Parsed Cost line from mechanicalEffects (empty if unlabeled).",
            "duration": "Parsed Duration line.",
            "subject": "Parsed Subject line.",
            "range": "Parsed Range line.",
            "action": "Parsed Action line.",
            "clash": "Parsed Clash line (empty when none).",
            "description": "Flavor / summary text for the Boon.",
            "dot": "Catalog position 1–12 for sort order and default legendMin when legendMin omitted.",
            "tierMin": "Minimum tier: hero | demigod | god (positions 1–4 / 5–8 / 9–12 by default).",
            "tierMax": "Optional maximum tier rank.",
            "legendMin": "Minimum Legend (defaults to dot if omitted).",
            "requiresBoonIds": "Other Boon ids that must already be chosen before this one (prerequisites).",
            "callingAnyOf": "Optional: character.callingId must match one id.",
            "pantheonAnyOf": "Optional: character.pantheonId must match one id.",
            "deityAnyOf": "Optional: character.parentDeityId must match one id.",
            "pathRankPrimaryAnyOf": "Optional: character.pathRank.primary ∈ {origin,role,society}.",
        },
    }

    boons: dict[str, object] = {"_meta": meta}

    pb_overrides: dict[str, dict[str, str]] = {}
    if PB_MECH_SNIPPETS_PATH.is_file():
        raw_pb = json.loads(PB_MECH_SNIPPETS_PATH.read_text(encoding="utf-8"))
        if isinstance(raw_pb, dict):
            for k, v in raw_pb.items():
                if str(k).startswith("_") or not isinstance(v, dict):
                    continue
                pb_overrides[str(k)] = v
    if PB_MECH_PATCH_PATH.is_file():
        raw_patch = json.loads(PB_MECH_PATCH_PATH.read_text(encoding="utf-8"))
        if isinstance(raw_patch, dict):
            for k, v in raw_patch.items():
                if str(k).startswith("_") or not isinstance(v, dict):
                    continue
                kid = str(k)
                base = dict(pb_overrides.get(kid, {}))
                base.update(v)
                pb_overrides[kid] = base

    for pid in pv_ids:
        if pid in _SKIP_TWELVE_RUNG_PURVIEWS:
            continue
        row = pur[pid] if isinstance(pur.get(pid), dict) else {}
        disp = str(row.get("name") or pid)
        prev_id: str | None = None
        max_n = 2 if pid == "arcaneCalculus" else 12
        for n in range(1, max_n + 1):
            bid = f"{pid}_dot_{n:02d}"
            if n <= 4:
                tier_min = "hero"
                # Position 1: Legend 0 in the wizard still shows this row (eligibility / UX); higher positions keep n.
                legend_min = 0 if n == 1 else n
            elif n <= 8:
                tier_min = "demigod"
                legend_min = n
            else:
                tier_min = "god"
                legend_min = n

            name_str = f"{disp} • Boon {n}"
            by_dot = row.get("boonLadderNameByDot") if isinstance(row, dict) else None
            if isinstance(by_dot, dict):
                alt = by_dot.get(str(n)) or by_dot.get(f"{n:02d}")
                if isinstance(alt, str) and alt.strip():
                    name_str = alt.strip()
            if name_str == f"{disp} • Boon {n}" and isinstance(row, dict):
                ladder = row.get("boonLadderNames")
                if isinstance(ladder, list) and len(ladder) >= n:
                    cand = str(ladder[n - 1] or "").strip()
                    if cand:
                        name_str = cand

            src = str(row.get("source") or "SCION_Pandoras_Box_(Revised_Download).pdf")
            entry: dict[str, object] = {
                "id": bid,
                "name": name_str,
                "purview": pid,
                "dot": n,
                "tierMin": tier_min,
                "legendMin": legend_min,
                "requiresBoonIds": [prev_id] if prev_id else [],
                "description": "",
                "mechanicalEffects": "",
                "source": src,
            }
            uses_ladder_name = name_str != f"{disp} • Boon {n}"
            pb_snip = pb_overrides.get(bid)
            if isinstance(pb_snip, dict):
                pd = pb_snip.get("description")
                pm = pb_snip.get("mechanicalEffects")
                if isinstance(pd, str) and pd.strip():
                    entry["description"] = pd.strip()
                if isinstance(pm, str) and pm.strip():
                    entry["mechanicalEffects"] = pm.strip()
            elif uses_ladder_name:
                entry["description"] = (
                    f"“{name_str}” is a published {disp} Purview Boon in Pandora’s Box (Revised). "
                    "Use that entry for Conditions, Complications, Clashes, Enhancement, Imbue uses, and pantheon-specific riders."
                )
                entry["mechanicalEffects"] = (
                    "Cost, duration, subject, range, and action type are printed in SCION_Pandoras_Box_(Revised_Download).pdf "
                    f"under the {disp} Purview for this title."
                )
            else:
                entry["description"] = (
                    f"Standard {disp} Purview catalog Boon (printed ladder position {n}). "
                    "This id is for wizard picks and export; use the cited book at the table for full wording, Imbue, and tags."
                )
                entry["mechanicalEffects"] = (
                    f"See {src} — this Purview’s Boon ladder, position {n} — for exact cost, duration, range, and mechanics."
                )
            curated = _CURATED_BOONS.get(bid)
            if curated:
                entry.update(curated)
                entry.setdefault("source", src)
            boons[bid] = entry
            prev_id = bid

    _apply_supplement_signature_ladders(boons)
    _apply_aesir_wyrd_hero_boons(boons)
    _apply_sheet_index_fields(boons, pur)

    OUT_PATH.write_text(json.dumps(boons, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(boons) - 1} boon entries to {OUT_PATH}")


if __name__ == "__main__":
    main()
