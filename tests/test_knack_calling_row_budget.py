"""Per-Calling knack point budgets (mirrors src/static/js/eligibility.js)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KNACKS_PATH = ROOT / "src/data/knacks.json"


def knack_rule_tier(knack: dict) -> str:
    return str(knack.get("tier") or "immortal").strip().lower()


def knack_point_cost(knack: dict) -> int:
    return 2 if knack_rule_tier(knack) == "immortal" else 1


def row_dots(character: dict, row_idx: int) -> int:
    return max(1, min(5, round(int(character["callingSlots"][row_idx].get("dots") or 1))))


def finishing_bonus_set(character: dict) -> set[str]:
    raw = character.get("finishingBonusKnackIds")
    if not isinstance(raw, list):
        return set()
    return {x for x in raw if isinstance(x, str) and x.strip()}


def experience_knack_set(character: dict) -> set[str]:
    raw = character.get("experienceKnackIds")
    if not isinstance(raw, list):
        return set()
    return {x for x in raw if isinstance(x, str) and x.strip()}


def budget_exempt_knacks(character: dict) -> set[str]:
    return finishing_bonus_set(character) | experience_knack_set(character)


def row_points_used(row_idx: int, knack_ids: list[str], slot_map: dict, knacks: dict, character: dict) -> int:
    exempt = budget_exempt_knacks(character)
    used = 0
    for kid in knack_ids:
        if slot_map.get(kid) != row_idx:
            continue
        if kid in exempt:
            continue
        used += knack_point_cost(knacks[kid])
    return used


def validate_assignments(knack_ids: list[str], slot_map: dict, character: dict, knacks: dict) -> bool:
    slots = character.get("callingSlots") or []
    for kid in knack_ids:
        r = slot_map.get(kid)
        if r is None or r < 0 or r >= len(slots):
            return False
    for ri in range(len(slots)):
        cap = row_dots(character, ri)
        if row_points_used(ri, knack_ids, slot_map, knacks, character) > cap:
            return False
    return True


def test_finishing_bonus_knacks_do_not_spend_row_budget():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "hero",
        "callingSlots": [
            {"id": "cosmos", "dots": 2},
            {"id": "sage", "dots": 2},
            {"id": "liminal", "dots": 2},
        ],
        "knackIds": ["mythos_psychic_attack", "auraOfGreatness", "sage_blockade_of_reason"],
        "finishingBonusKnackIds": ["auraOfGreatness", "sage_blockade_of_reason"],
        "knackSlotById": {
            "mythos_psychic_attack": 0,
            "auraOfGreatness": 0,
            "sage_blockade_of_reason": 0,
        },
    }
    assert row_points_used(0, character["knackIds"], character["knackSlotById"], knacks, character) == 1
    extra_heroic = "sage_as_i_have_foreseen"
    slot_map = {
        "mythos_psychic_attack": 0,
        "auraOfGreatness": 0,
        "sage_blockade_of_reason": 0,
        extra_heroic: 0,
    }
    assert validate_assignments(
        ["mythos_psychic_attack", "auraOfGreatness", "sage_blockade_of_reason", extra_heroic],
        slot_map,
        character,
        knacks,
    )


def test_one_dot_calling_allows_one_heroic_only():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "hero",
        "callingSlots": [
            {"id": "cosmos", "dots": 1},
            {"id": "sage", "dots": 2},
            {"id": "liminal", "dots": 2},
        ],
        "knackIds": [],
        "knackSlotById": {},
    }
    heroic = knacks["mythos_psychic_attack"]
    immortal = knacks["mythos_infinite_knowledge"]
    assert knack_point_cost(heroic) == 1
    assert knack_point_cost(immortal) == 2
    slot_map = {"mythos_psychic_attack": 0}
    assert validate_assignments(["mythos_psychic_attack"], slot_map, character, knacks)
    slot_map2 = {
        "mythos_psychic_attack": 0,
        "sage_blockade_of_reason": 0,
    }
    assert not validate_assignments(
        ["mythos_psychic_attack", "sage_blockade_of_reason"], slot_map2, character, knacks
    )
    slot_map3 = {"mythos_infinite_knowledge": 0}
    assert not validate_assignments(["mythos_infinite_knowledge"], slot_map3, character, knacks)


def test_two_dot_calling_heroic_or_immortal():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "hero",
        "callingSlots": [
            {"id": "cosmos", "dots": 1},
            {"id": "sage", "dots": 2},
            {"id": "liminal", "dots": 2},
        ],
        "knackIds": [],
        "knackSlotById": {},
    }
    two_heroic = {
        "mythos_psychic_attack": 1,
        "sage_blockade_of_reason": 1,
    }
    assert validate_assignments(list(two_heroic), two_heroic, character, knacks)
    one_immortal = {"mythos_infinite_knowledge": 1}
    assert validate_assignments(["mythos_infinite_knowledge"], one_immortal, character, knacks)
    immortal_plus_heroic = {
        "mythos_infinite_knowledge": 1,
        "sage_blockade_of_reason": 1,
    }
    assert not validate_assignments(
        ["mythos_infinite_knowledge", "sage_blockade_of_reason"], immortal_plus_heroic, character, knacks
    )


def test_experience_knacks_do_not_spend_row_budget():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "hero",
        "callingSlots": [
            {"id": "cosmos", "dots": 1},
            {"id": "sage", "dots": 2},
            {"id": "liminal", "dots": 2},
        ],
        "knackIds": ["mythos_psychic_attack", "sage_blockade_of_reason"],
        "experienceKnackIds": ["sage_blockade_of_reason"],
        "knackSlotById": {
            "mythos_psychic_attack": 0,
            "sage_blockade_of_reason": 0,
        },
    }
    assert row_points_used(0, character["knackIds"], character["knackSlotById"], knacks, character) == 1
    extra = "sage_as_i_have_foreseen"
    slot_map = {
        "mythos_psychic_attack": 0,
        "sage_blockade_of_reason": 0,
        extra: 1,
    }
    assert validate_assignments(
        ["mythos_psychic_attack", "sage_blockade_of_reason", extra],
        slot_map,
        character,
        knacks,
    )


def test_general_knack_paid_from_different_row():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "hero",
        "callingSlots": [
            {"id": "cosmos", "dots": 1},
            {"id": "sage", "dots": 2},
            {"id": "liminal", "dots": 2},
        ],
        "knackIds": ["auraOfGreatness"],
        "knackSlotById": {"auraOfGreatness": 2},
    }
    assert validate_assignments(["auraOfGreatness"], character["knackSlotById"], character, knacks)
