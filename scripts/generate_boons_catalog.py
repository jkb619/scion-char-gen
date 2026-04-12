#!/usr/bin/env python3
"""
Regenerate data/boons.json: one twelve-step Boon ladder per Purview in purviews.json.

Each step is a separate catalog entry (selectable in the wizard) with tier/Legend gates.
Official proper names and mechanics remain in Pandora’s Box / tier PDFs — confirm at table.

Run from repo root:
  python3 scripts/generate_boons_catalog.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PURVIEWS_PATH = ROOT / "data" / "purviews.json"
OUT_PATH = ROOT / "data" / "boons.json"


def _apply_supplement_signature_ladders(boons: dict[str, object]) -> None:
    """Pantheon-gated Signature Purviews and MotM-published Boon names (rest are placeholders)."""

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
    for n in range(1, 13):
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
            e["mechanicalEffects"] = "Cost: Free. Duration: Instant. Subject: Self. Action: Simple. Once per session."
            e["source"] = f"{motm} (Disturbing Visions)"
        elif n == 2:
            e["name"] = "Mouth of Madness"
            e["description"] = (
                "Speak of an investigation target; everyone in range babbles everything they know. "
                "You gain Enhancement 3 on follow-up investigative actions for the session and +1 Scale "
                "when acting on those clues where appropriate."
            )
            e["mechanicalEffects"] = (
                "Cost: Spend 1 Awareness. Duration: One scene. "
                "Clash: Presence + Legend vs. Resolve + Legend. Range: Short. Action: Simple."
            )
            e["source"] = f"{motm} (Mouth of Madness)"
        else:
            e["name"] = f"Arcane Calculus — ladder step {n}"
            e["description"] = (
                "MotM publishes a short Signature; use this slot for chronicle-designed Awareness Boons, "
                "SG-approved imports, or future errata."
            )
            e["mechanicalEffects"] = "Storyguide sets Imbue, Legend, and Awareness costs to match table tone."
            e["source"] = f"{motm} (extended ladder placeholder)"


# Wyrd uses three named Hero Boons in Scion: Hero (Æsir Signature), not the twelve-step Fortune-style ladder.
_SKIP_TWELVE_RUNG_PURVIEWS = frozenset({"wyrd"})


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
        "mechanicalEffects": "Resolve with your Storyguide.",
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
        "mechanicalEffects": "Resolve with your Storyguide.",
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
        "mechanicalEffects": "Resolve with your Storyguide.",
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
            "Large catalog: twelve discrete ladder steps per Purview in purviews.json; "
            "each step is one choosable Boon id for UI/export. Supplement or tier books only where PB points to them. "
            "Regenerate with: python3 scripts/generate_boons_catalog.py"
        ),
        "eligibility": {
            "purview": "Required Purview id; character must hold this Purview.",
            "dot": "Ladder height (1–12) for sort order and default legendMin when legendMin omitted.",
            "tierMin": "Minimum tier: hero | demigod | god (dots 1–4 / 5–8 / 9–12 by default).",
            "tierMax": "Optional maximum tier rank.",
            "legendMin": "Minimum Legend (defaults to dot if omitted).",
            "requiresBoonIds": "Prior step(s) on this ladder that must already be chosen.",
            "callingAnyOf": "Optional: character.callingId must match one id.",
            "pantheonAnyOf": "Optional: character.pantheonId must match one id.",
            "deityAnyOf": "Optional: character.parentDeityId must match one id.",
            "pathRankPrimaryAnyOf": "Optional: character.pathRank.primary ∈ {origin,role,society}.",
        },
    }

    boons: dict[str, object] = {"_meta": meta}

    for pid in pv_ids:
        if pid in _SKIP_TWELVE_RUNG_PURVIEWS:
            continue
        row = pur[pid] if isinstance(pur.get(pid), dict) else {}
        disp = str(row.get("name") or pid)
        prev_id: str | None = None
        for n in range(1, 13):
            bid = f"{pid}_dot_{n:02d}"
            if n <= 4:
                tier_min = "hero"
                # Step 1: Legend 0 in the wizard still shows this row (eligibility / UX); higher steps keep n.
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

            entry: dict[str, object] = {
                "id": bid,
                "name": name_str,
                "purview": pid,
                "dot": n,
                "tierMin": tier_min,
                "legendMin": legend_min,
                "requiresBoonIds": [prev_id] if prev_id else [],
                "description": (
                    f"{disp} Purview, Boon dot {n}. Add the proper name to `boonLadderNames` / `boonLadderNameByDot` "
                    f"in purviews.json when transcribed from Pandora’s Box Revised (and tier books) for full text, Imbue, and tags."
                ),
                "mechanicalEffects": "Resolve with your Storyguide per Purview chapter and Legend.",
                "source": "SCION_Pandoras_Box_(Revised_Download).pdf",
            }
            boons[bid] = entry
            prev_id = bid

    _apply_supplement_signature_ladders(boons)
    _apply_aesir_wyrd_hero_boons(boons)

    OUT_PATH.write_text(json.dumps(boons, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(boons) - 1} boon entries to {OUT_PATH}")


if __name__ == "__main__":
    main()
