"""MotM Hero Boon eligibility — held Purviews only (Signature + patron innate)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ELIG = ROOT / "src" / "static" / "js" / "eligibility.js"
MOTM = ROOT / "src/data/masksOfTheMythos.json"
BOONS = ROOT / "src/data/boons.json"
PANTHEONS = ROOT / "src/data/pantheons.json"


def tier_rank(tier_id: str) -> int:
    t = tier_id.strip().lower()
    if t in ("mortal", "sorcerer"):
        return 0
    if t in ("hero", "titanic", "sorcerer_hero"):
        return 1
    if t in ("demigod", "sorcerer_demigod"):
        return 2
    return 3


def boon_primary_purview(b: dict) -> str:
    p = str(b.get("purview") or "").strip()
    if p:
        return p
    multi = b.get("purviews")
    if isinstance(multi, list) and multi:
        return str(multi[0]).strip()
    return ""


def catalog_purview_for_boon(bid: str, catalog: dict) -> str | None:
    for pv, mapped in catalog.items():
        if mapped == bid:
            return pv
    return None


def held_purview_set(character: dict, pantheons: dict) -> set[str]:
    """Mirror characterPurviewIdSet Hero-band signature merge (no mythos draft slot)."""
    held = set(character.get("purviewIds") or []) | set(character.get("patronPurviewSlots") or [])
    pant_id = str(character.get("pantheonId") or "").strip()
    pant = pantheons.get(pant_id) if pant_id else None
    if pant and str(character.get("tier") or "").strip().lower() in ("hero", "titanic", "sorcerer_hero"):
        sig = str(pant.get("signaturePurviewId") or "").strip()
        if sig:
            held.add(sig)
    return {x for x in held if x}


def boon_eligible_motm_hero(
    bid: str,
    b: dict,
    character: dict,
    pantheons: dict,
    catalog: dict,
) -> bool:
    if tier_rank(str(character.get("tier") or "")) != 1:
        return False
    if str(character.get("pantheonId") or "") != "mythos":
        return False
    pv = boon_primary_purview(b)
    if not pv:
        return False
    scope = held_purview_set(character, pantheons)
    cat_pv = catalog_purview_for_boon(bid, catalog)
    if cat_pv:
        if cat_pv not in scope:
            return False
        t_min = tier_rank("hero")
    else:
        if pv not in scope:
            return False
        t_min = tier_rank(str(b.get("tierMin") or "hero"))
    t_max = tier_rank(str(b.get("tierMax") or "god"))
    tr = tier_rank(str(character.get("tier") or ""))
    return t_min <= tr <= t_max


def test_eligibility_exports_motm_awareness_helpers():
    text = ELIG.read_text(encoding="utf-8")
    assert "export function mythosAwarenessCatalogPurviewForBoon" in text
    assert "mythosAwarenessCatalogPurviewForBoon(b, bundle)" in text.split("export function boonEligible")[1][:800]
    assert "export function mythosBoonPurviewScopeIds" not in text


def test_masks_catalog_maps_cthulhu_parent_awareness_boons():
    motm = json.loads(MOTM.read_text(encoding="utf-8"))
    catalog = motm["mythosAwarenessBoonByPurview"]
    assert catalog["death"] == "death_dot_02"
    assert catalog["darkness"] == "darkness_dot_08"
    assert catalog["arcaneCalculus"] == "arcaneCalculus_dot_01"
    assert catalog["water"] == "water_dot_09"


def test_cthulhu_hero_death_innate_only_held_purview_boons():
    motm = json.loads(MOTM.read_text(encoding="utf-8"))
    boons = json.loads(BOONS.read_text(encoding="utf-8"))
    pantheons = json.loads(PANTHEONS.read_text(encoding="utf-8"))
    catalog = motm["mythosAwarenessBoonByPurview"]
    character = {
        "tier": "hero",
        "pantheonId": "mythos",
        "parentDeityId": "cthulhu",
        "patronPurviewSlots": ["death"],
        "purviewIds": ["death", "arcaneCalculus"],
    }
    # Signature Arcane Calculus — not parent-list Darkness / Water / Epic Stamina
    assert boon_eligible_motm_hero(
        "arcaneCalculus_dot_01", boons["arcaneCalculus_dot_01"], character, pantheons, catalog
    )
    assert boon_eligible_motm_hero(
        "arcaneCalculus_dot_02", boons["arcaneCalculus_dot_02"], character, pantheons, catalog
    )
    assert not boon_eligible_motm_hero("darkness_dot_08", boons["darkness_dot_08"], character, pantheons, catalog)
    assert not boon_eligible_motm_hero("water_dot_09", boons["water_dot_09"], character, pantheons, catalog)
    assert not boon_eligible_motm_hero(
        "epicStamina_dot_04", boons["epicStamina_dot_04"], character, pantheons, catalog
    )
    assert not boon_eligible_motm_hero("deception_dot_09", boons["deception_dot_09"], character, pantheons, catalog)
    assert not boon_eligible_motm_hero("artistry_dot_08", boons["artistry_dot_08"], character, pantheons, catalog)


def test_cthulhu_hero_death_ladder_and_awareness_boon():
    boons = json.loads(BOONS.read_text(encoding="utf-8"))
    motm = json.loads(MOTM.read_text(encoding="utf-8"))
    catalog = motm["mythosAwarenessBoonByPurview"]
    pantheons = json.loads(PANTHEONS.read_text(encoding="utf-8"))
    character = {
        "tier": "hero",
        "pantheonId": "mythos",
        "parentDeityId": "cthulhu",
        "patronPurviewSlots": ["death"],
        "purviewIds": ["death", "arcaneCalculus"],
    }
    assert boon_eligible_motm_hero("death_dot_01", boons["death_dot_01"], character, pantheons, catalog)
    assert boon_eligible_motm_hero("death_dot_02", boons["death_dot_02"], character, pantheons, catalog)
    assert boon_eligible_motm_hero("death_dot_04", boons["death_dot_04"], character, pantheons, catalog)
    assert not boon_eligible_motm_hero("death_dot_06", boons["death_dot_06"], character, pantheons, catalog)
