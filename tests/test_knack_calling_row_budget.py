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


def carried_experience_set(character: dict) -> set[str]:
    raw = character.get("carriedExperienceKnackIds")
    if not isinstance(raw, list):
        return set()
    return {x for x in raw if isinstance(x, str) and x.strip()}


def budget_exempt_knacks(character: dict) -> set[str]:
    return finishing_bonus_set(character) | experience_knack_set(character) | carried_experience_set(character)


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


def knack_row_budget_cost(kid: str, knacks: dict, character: dict) -> int:
    """Mirrors knackRowBudgetCost — snapshotted locked costs; XP/Finishing = 0."""
    if kid in budget_exempt_knacks(character):
        return 0
    locked = set(character.get("lockedKnackIds") or [])
    snap = character.get("knackLockedRowBudgetCostById") or {}
    if kid in locked and kid in snap:
        return int(snap[kid])
    return knack_point_cost(knacks[kid])


def row_points_used_coerced(row_idx: int, knack_ids: list[str], slot_map: dict, knacks: dict, character: dict) -> int:
    """Mirrors JS rowKnackPointsUsed — Number() coercion on payer row."""
    used = 0
    row = int(row_idx)
    for kid in knack_ids:
        pay = slot_map.get(kid)
        if pay is None or int(pay) != row:
            continue
        used += knack_row_budget_cost(kid, knacks, character)
    return used


def heavy_immortal_assigned(knack_ids: list[str], slot_map: dict, knacks: dict) -> int:
    """Mirrors JS heavyImmortalKnackCountAssigned — only mapped immortals count."""
    n = 0
    for kid in knack_ids:
        pay = slot_map.get(kid)
        if pay is None:
            continue
        if knack_point_cost(knacks[kid]) == 2:
            n += 1
    return n


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


def test_carried_experience_knacks_do_not_spend_row_budget():
    """After tier advance, Origin XP knack buys stay budget-free via carriedExperienceKnackIds."""
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    assert "export function carriedExperienceKnackIdSet" in elig
    assert "carriedExperienceKnackIdSet(character).has(kid)" in elig
    assert "carriedExperienceKnackIds" in elig
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "hero",
        "callingSlots": [
            {"id": "cosmos", "dots": 1},
            {"id": "corruptor", "dots": 2},
            {"id": "defiler", "dots": 2},
        ],
        "knackIds": ["mythos_psychic_attack", "sage_blockade_of_reason", "sage_as_i_have_foreseen"],
        "lockedKnackIds": [
            "mythos_psychic_attack",
            "sage_blockade_of_reason",
            "sage_as_i_have_foreseen",
        ],
        "carriedExperienceKnackIds": ["sage_blockade_of_reason", "sage_as_i_have_foreseen"],
        "experienceKnackIds": [],
        "knackSlotById": {
            "mythos_psychic_attack": 0,
            "sage_blockade_of_reason": 1,
            "sage_as_i_have_foreseen": 2,
        },
    }
    assert row_points_used(1, character["knackIds"], character["knackSlotById"], knacks, character) == 0
    assert row_points_used(2, character["knackIds"], character["knackSlotById"], knacks, character) == 0
    assert row_points_used(0, character["knackIds"], character["knackSlotById"], knacks, character) == 1
    new_immortal = "mythos_honied_words"
    slot_map = {
        **character["knackSlotById"],
        new_immortal: 1,
    }
    assert validate_assignments(
        [*character["knackIds"], new_immortal],
        slot_map,
        character,
        knacks,
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


def test_locked_knack_without_slot_blocks_until_row_assigned():
    """Mirrors syncHeroKnackSlotAssignments: locked picks need row assignment before new buys stick."""
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "hero",
        "parentDeityId": "cthulhu",
        "callingId": "cosmos",
        "callingSlots": [
            {"id": "cosmos", "dots": 1},
            {"id": "defiler", "dots": 2},
            {"id": "destroyer", "dots": 2},
        ],
        "knackIds": ["mythos_psychic_attack"],
        "lockedKnackIds": ["mythos_psychic_attack"],
        "knackSlotById": {},
    }
    assert not validate_assignments(character["knackIds"], character["knackSlotById"], character, knacks)
    character["knackSlotById"] = {"mythos_psychic_attack": 0}
    assert validate_assignments(character["knackIds"], character["knackSlotById"], character, knacks)
    new_kid = "mythos_spread_disease"
    slot_map = {
        "mythos_psychic_attack": 0,
        new_kid: 1,
    }
    assert validate_assignments(["mythos_psychic_attack", new_kid], slot_map, character, knacks)
    assert row_points_used(1, ["mythos_psychic_attack", new_kid], slot_map, knacks, character) == 1


def test_solve_keeps_pinned_picks_when_locked_settle_pending():
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    assert "return Object.keys(pinned).length ? pinned : null" in elig
    assert "export function settleUnassignedHeldKnackSlots" in elig
    assert "if (slotMap && slotMap[id] != null) continue" in elig
    assert "if (ids.includes(id)) continue" in elig
    picker = (ROOT / "src" / "static" / "js" / "knackPayingRowPicker.js").read_text(encoding="utf-8")
    assert "settleUnassignedHeldKnackSlots(character, bundle)" in picker
    app = (ROOT / "src" / "static" / "js" / "app.js").read_text(encoding="utf-8")
    render_calling_open = app.split("function renderCalling(root)")[1].split('const wrap = document.createElement("div")')[0]
    assert "settleUnassignedHeldKnackSlots(character, bundle)" in render_calling_open
    assert "syncHeroKnackSlotAssignments(character, bundle)" not in render_calling_open


def test_calling_rows_that_can_pay_excludes_pick_from_budget_solve():
    """Affordability uses explicit payer rows only — never provisional solves that block other Callings."""
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    assert "const heldIds = ids.filter((id) => !omit.has(id))" in elig
    assert "rowKnackPointsUsed(ri, heldIds, map" in elig
    assert "export function knackSlotMapForRowBudgetUi" in elig
    can_pay = elig.split("export function callingRowsThatCanPayForKnack")[1].split("export function knackPayingCallingRowLabel")[0]
    assert "Only count explicit payer rows" in can_pay
    assert "solveHeroKnackSlotAssignment" not in can_pay
    assert "popLastUnlockedKnackId(arr, character, map)" in elig


def test_prune_stale_knacks_uses_settle_not_sync_on_calling_tab():
    app = (ROOT / "src" / "static" / "js" / "app.js").read_text(encoding="utf-8")
    prune = app.split("function pruneStaleKnackIds()")[1].split("function healExperienceKnackIdsFromMortalOverflow")[0]
    assert "settleUnassignedHeldKnackSlots(character, bundle)" in prune
    assert "syncHeroKnackSlotAssignments(character, bundle)" in prune
    assert prune.index("settleUnassignedHeldKnackSlots") < prune.index("syncHeroKnackSlotAssignments")


def test_toggle_requires_preferred_calling_row():
    picker = (ROOT / "src" / "static" / "js" / "knackPayingRowPicker.js").read_text(encoding="utf-8")
    toggle = picker.split("export async function toggleHeroKnackWithRowPayment")[1].split("export function")[0]
    assert "if (!rows.includes(pref)) return false" in toggle
    assert "character.knackSlotById[kid] = payRow" in toggle
    assert "pinHeldKnackToCallingRowIfAffordable" in toggle
    assert "settleUnassignedHeldKnackSlots(character, bundle)" in toggle.split("set.delete(kid)")[1]


def test_sync_preserves_explicit_unlocked_row_picks():
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    sync = elig.split("export function syncHeroKnackSlotAssignments")[1].split("export function callingKnackSlotCap")[0]
    assert "if (map[id] != null && !isKnackLocked(character, id)) continue" in sync


def test_three_row_slot_cost_immortal_two_heroic_one():
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    fn = elig.split("export function knackCallingSlotCost(k, character)")[1].split("export function")[0]
    assert "heroUsesCallingSlotRows(character)" in fn
    assert "return knackPointCost(k)" in fn
    assert "!immortalKnackCostsTwoCallingSlots(character.tier) && knackPointCost(k) === 2) return 1" not in fn
    assert "export function persistHeroKnackSlotMapIfSolvable" in elig
    assert "return knackPointCost(k)" in elig.split("export function knackHeroBandSlotCost")[1][:120]
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    assert knack_rule_tier(knacks["mythos_puppet_show"]) == "immortal"
    assert knack_point_cost(knacks["mythos_puppet_show"]) == 2
    assert knack_point_cost(knacks["mythos_spread_disease"]) == 1


def test_solve_pins_explicit_payer_row_before_free_assignments():
    """Clicking a knack under Corruptor must charge that row immediately (not wait for a second pick)."""
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    assert "const pinned = {}" in elig
    assert "const freeIds = []" in elig
    assert "return { ...pinned, ...solvedFree }" in elig


def test_per_row_slot_blocked_uses_calling_rows_that_can_pay():
    app = (ROOT / "src" / "static" / "js" / "app.js").read_text(encoding="utf-8")
    render_calling = app.split("function renderCalling(root)")[1].split("function renderFinishing")[0]
    assert "callingRowsThatCanPayForKnack" in render_calling
    assert "canPayFromRow" in render_calling
    assert "canPayAnyRow" in render_calling
    assert "!on && !slotBlocked" in render_calling
    assert "knackSlotMapForRowBudgetUi(character, bundle)" in render_calling.split("knackBudgetMap")[1][:200]


def test_corruptor_defiler_motm_picks_charge_each_row():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "hero",
        "pantheonId": "mythos",
        "callingSlots": [
            {"id": "cosmos", "dots": 1},
            {"id": "corruptor", "dots": 2},
            {"id": "defiler", "dots": 2},
        ],
        "knackIds": ["mythos_puppet_show"],
        "knackSlotById": {"mythos_puppet_show": 1},
    }
    assert character["knackSlotById"]["mythos_puppet_show"] == 1
    assert row_points_used(1, character["knackIds"], character["knackSlotById"], knacks, character) > 0
    assert row_points_used(2, character["knackIds"], character["knackSlotById"], knacks, character) == 0
    character["knackIds"].append("mythos_plague_bearer")
    character["knackSlotById"]["mythos_plague_bearer"] = 2
    assert row_points_used(1, character["knackIds"], character["knackSlotById"], knacks, character) > 0
    assert row_points_used(2, character["knackIds"], character["knackSlotById"], knacks, character) > 0


def test_finishing_bonus_without_matching_row_does_not_block_hero_buys():
    """Origin Finishing extras may not match Visitation Callings — still assign without blocking new picks."""
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "hero",
        "callingSlots": [
            {"id": "cosmos", "dots": 1},
            {"id": "corruptor", "dots": 2},
            {"id": "defiler", "dots": 2},
        ],
        "knackIds": [
            "mythos_psychic_attack",
            "creator_flawlessly_platonic_ideal",
            "guardian_a_bulwark",
        ],
        "lockedKnackIds": [
            "mythos_psychic_attack",
            "creator_flawlessly_platonic_ideal",
            "guardian_a_bulwark",
        ],
        "finishingBonusKnackIds": [
            "creator_flawlessly_platonic_ideal",
            "guardian_a_bulwark",
        ],
        "knackSlotById": {},
    }
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    assert "export function knackRowAssignmentCallingExempt" in elig
    assert "knackRowAssignmentCallingExempt(character, id)" in elig
    assert "knackRowAssignmentCallingExempt(character, kid)" in elig
    # With calling-exempt finishing extras, full assignment fits (mirrors solveHeroKnackSlotAssignment).
    slot_map = {
        "mythos_psychic_attack": 0,
        "creator_flawlessly_platonic_ideal": 1,
        "guardian_a_bulwark": 1,
        "mythos_honied_words": 1,
    }
    assert validate_assignments(
        [
            "mythos_psychic_attack",
            "creator_flawlessly_platonic_ideal",
            "guardian_a_bulwark",
            "mythos_honied_words",
        ],
        slot_map,
        character,
        knacks,
    )
    assert row_points_used(1, list(slot_map.keys()), slot_map, knacks, character) == 1


def test_settle_solves_full_held_list_not_unassigned_subset():
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    settle = elig.split("export function settleUnassignedHeldKnackSlots")[1].split("export function repairUnmappedHeroKnackSlots")[0]
    assert "solveHeroKnackSlotAssignment(heldIds, character, bundle)" in settle
    assert "solveHeroKnackSlotAssignment(unassigned, character, bundle)" not in settle
    assert "export function repairUnmappedHeroKnackSlots" in elig
    assert "export function pinHeldKnackToCallingRowIfAffordable" in elig


def test_orphan_held_knack_pins_to_preferred_row():
    """Held without payer row must not look selected; commit assigns the Calling row and charges budget."""
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "hero",
        "pantheonId": "mythos",
        "callingSlots": [
            {"id": "cosmos", "dots": 1},
            {"id": "corruptor", "dots": 2},
            {"id": "defiler", "dots": 2},
        ],
        "knackIds": ["mythos_honied_words"],
        "knackSlotById": {},
    }
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    picker = (ROOT / "src" / "static" / "js" / "knackPayingRowPicker.js").read_text(encoding="utf-8")
    app = (ROOT / "src" / "static" / "js" / "app.js").read_text(encoding="utf-8")
    assert "export function knackSelectedOnCallingRow" in elig
    assert "export function commitKnackToCallingRow" in picker
    assert "commitKnackToCallingRow(character, bundle, kid, k, rowIdx)" in app
    assert "knackSelectedOnCallingRow(character, kid, rowIdx)" in app
    assert row_points_used(1, character["knackIds"], character["knackSlotById"], knacks, character) == 0
    character["knackSlotById"]["mythos_honied_words"] = 1
    assert row_points_used(1, character["knackIds"], character["knackSlotById"], knacks, character) == 1
    assert row_points_used(2, character["knackIds"], character["knackSlotById"], knacks, character) == 0


def test_render_calling_repairs_unmapped_knack_slots():
    app = (ROOT / "src" / "static" / "js" / "app.js").read_text(encoding="utf-8")
    render_calling = app.split("function renderCalling(root)")[1].split("const wrap = document.createElement")[0]
    assert "seedHeroKnackRowAssignments(character, bundle)" in render_calling
    assert "repairUnmappedHeroKnackSlots(character, bundle)" in render_calling
    prune = app.split("function pruneStaleKnackIds()")[1].split("function healExperienceKnackIdsFromMortalOverflow")[0]
    assert "seedHeroKnackRowAssignments(character, bundle)" in prune
    assert "repairUnmappedHeroKnackSlots(character, bundle)" in prune


def heavy_immortal_on_row(row_idx: int, knack_ids: list, slot_map: dict, knacks: dict) -> int:
    """Mirrors JS heavyImmortalKnackCountAssignedOnRow."""
    n = 0
    row = int(row_idx)
    for kid in knack_ids:
        pay = slot_map.get(kid)
        if pay is None or int(pay) != row:
            continue
        if knack_point_cost(knacks[kid]) == 2:
            n += 1
    return n


def row_can_pay_immortal(row_idx: int, knack_ids: list, slot_map: dict, knacks: dict, character: dict, new_kid: str) -> bool:
    """Mirrors per-row immortal cap in callingRowsThatCanPayForKnack."""
    cap = row_dots(character, row_idx)
    if cap < 2:
        return False
    if heavy_immortal_on_row(row_idx, knack_ids, slot_map, knacks) > 0 and new_kid not in knack_ids:
        return False
    used = row_points_used_coerced(row_idx, knack_ids, slot_map, knacks, character)
    return used + knack_point_cost(knacks[new_kid]) <= cap


def test_calling_step_eligibility_uses_row_afford_not_global_solve():
    """Carried Origin knacks must not block new buys until an orphan click mutates state."""
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    step = elig.split("export function knackEligibleForCallingStep")[1].split("export function motmInvertedChargenKnackAtOrigin")[0]
    assert "callingRowsThatCanPayForKnack(k, character, bundle, [...cur, kid], map).length > 0" in step
    assert "solveHeroKnackSlotAssignment([...cur, kid]" not in step
    pay = elig.split("export function callingRowsThatCanPayForKnack")[1].split("export function knackPayingCallingRowLabel")[0]
    assert "heavyImmortalKnackCountAssignedOnRow(ri, ids, mapForCap, bundle) > 0" in pay
    assert "heavyImmortalKnackCountAssigned(ids, mapForCap, bundle) > 0" not in pay
    assert "heavyImmortalKnackCountInList(capIds, bundle) > 1" not in pay


def test_corruptor_and_defiler_each_allow_one_immortal():
    """Immortal cap is per Calling row — Corruptor 2/2 must not block Defiler buys."""
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "hero",
        "pantheonId": "mythos",
        "callingSlots": [
            {"id": "guardian", "dots": 1},
            {"id": "corruptor", "dots": 2},
            {"id": "defiler", "dots": 2},
        ],
        "knackIds": ["mythos_puppet_show"],
        "knackSlotById": {"mythos_puppet_show": 1},
    }
    assert row_points_used_coerced(1, character["knackIds"], character["knackSlotById"], knacks, character) == 2
    assert row_points_used_coerced(2, character["knackIds"], character["knackSlotById"], knacks, character) == 0
    assert not row_can_pay_immortal(1, character["knackIds"], character["knackSlotById"], knacks, character, "mythos_plague_bearer")
    assert row_can_pay_immortal(2, character["knackIds"], character["knackSlotById"], knacks, character, "mythos_plague_bearer")
    character["knackIds"].append("mythos_plague_bearer")
    character["knackSlotById"]["mythos_plague_bearer"] = 2
    assert row_points_used_coerced(1, character["knackIds"], character["knackSlotById"], knacks, character) == 2
    assert row_points_used_coerced(2, character["knackIds"], character["knackSlotById"], knacks, character) == 2


def test_orphan_immortal_in_knack_ids_does_not_block_new_immortal_buys():
    """Unmapped mythos_puppet_show must not consume the one-Immortal cap or row budget."""
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "hero",
        "pantheonId": "mythos",
        "callingSlots": [
            {"id": "cosmos", "dots": 1},
            {"id": "corruptor", "dots": 2},
            {"id": "defiler", "dots": 2},
        ],
        "knackIds": ["mythos_puppet_show"],
        "knackSlotById": {},
    }
    assert heavy_immortal_assigned(character["knackIds"], character["knackSlotById"], knacks) == 0
    assert row_points_used_coerced(1, character["knackIds"], character["knackSlotById"], knacks, character) == 0
    character["knackSlotById"]["mythos_puppet_show"] = 1
    assert heavy_immortal_assigned(character["knackIds"], character["knackSlotById"], knacks) == 1
    assert row_points_used_coerced(1, character["knackIds"], character["knackSlotById"], knacks, character) == 2


def test_commit_uses_single_knack_validation_and_rollback():
    picker = (ROOT / "src" / "static" / "js" / "knackPayingRowPicker.js").read_text(encoding="utf-8")
    commit = picker.split("export function commitKnackToCallingRow")[1].split("export async function toggleHeroKnackWithRowPayment")[0]
    assert "validateCommittedKnackRowAssignment(id, ri, proposed, proposedMap, character, bundle)" in commit
    assert "character.knackIds = prevIds" in commit
    buy_tail = commit.split("validateCommittedKnackRowAssignment(id, ri, proposed, proposedMap, character, bundle)")[1]
    assert "settleUnassignedHeldKnackSlots(character, bundle)" not in buy_tail


def test_prune_orphan_unmapped_knack_purchases():
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    app = (ROOT / "src" / "static" / "js" / "app.js").read_text(encoding="utf-8")
    assert "export function pruneOrphanUnmappedKnackPurchases" in elig
    prune = app.split("function pruneStaleKnackIds()")[1].split("function healExperienceKnackIdsFromMortalOverflow")[0]
    assert "pruneOrphanUnmappedKnackPurchases(character, bundle)" in prune
    render_calling = app.split("function renderCalling(root)")[1].split("const wrap = document.createElement")[0]
    assert "pruneOrphanUnmappedKnackPurchases(character, bundle)" in render_calling


def simulate_hero_band_ensure_finishing_bonus(character: dict) -> None:
    """Mirrors ensureFinishingBonusKnackIds hero-band rebuild (tier rank <= 1)."""
    tier = str(character.get("tier") or "").strip().lower()
    hero_band = tier in ("hero", "titanic", "sorcerer_hero")
    locked = set(character.get("lockedKnackIds") or [])
    held = set(character.get("knackIds") or [])
    xp = experience_knack_set(character) | carried_experience_set(character)
    if not hero_band or len(locked) <= 1:
        return
    locked_in_order = [k for k in character.get("knackIds") or [] if k in locked]
    budget = next((k for k in locked_in_order if k not in xp), locked_in_order[0] if locked_in_order else None)
    fin = {k for k in locked_in_order if k != budget and k not in xp}
    character["finishingBonusKnackIds"] = [k for k in fin if k in held]


def test_hero_partial_finishing_rebuilds_extras_corruptor_row_zero():
    """Stale partial finishingBonusKnackIds at Hero must not leave 1/2 on Corruptor visitation row."""
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "hero",
        "pantheonId": "mythos",
        "callingSlots": [
            {"id": "guardian", "dots": 1},
            {"id": "corruptor", "dots": 2},
            {"id": "defiler", "dots": 2},
        ],
        "knackIds": ["guardian_a_bulwark", "auraOfGreatness", "guardian_a_warning"],
        "lockedKnackIds": ["guardian_a_bulwark", "auraOfGreatness", "guardian_a_warning"],
        "finishingBonusKnackIds": ["auraOfGreatness"],
        "knackSlotById": {
            "guardian_a_bulwark": 0,
            "auraOfGreatness": 1,
            "guardian_a_warning": 1,
        },
    }
    assert row_points_used_coerced(1, character["knackIds"], character["knackSlotById"], knacks, character) >= 1
    simulate_hero_band_ensure_finishing_bonus(character)
    assert finishing_bonus_set(character) == {"auraOfGreatness", "guardian_a_warning"}
    assert row_points_used_coerced(1, character["knackIds"], character["knackSlotById"], knacks, character) == 0
    assert row_points_used_coerced(0, character["knackIds"], character["knackSlotById"], knacks, character) == 1


def test_visitation_rows_zero_until_hero_buys_after_origin_carry():
    """Origin Knack + Finishing extras must not pre-charge Corruptor/Defiler visitation rows."""
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    assert "export function ensureFinishingBonusKnackIds" in elig
    assert "export function pinLockedOriginBudgetKnackToPrimaryRow" in elig
    assert "export function heroOriginCallingBudgetKnackId" in elig
    app = (ROOT / "src" / "static" / "js" / "app.js").read_text(encoding="utf-8")
    render_calling = app.split("function renderCalling(root)")[1].split("const wrap = document.createElement")[0]
    assert "ensureFinishingBonusKnackIds(character)" in render_calling
    assert "pinLockedOriginBudgetKnackToPrimaryRow(character, bundle)" in render_calling
    assert "isOriginThroughHeroBandTier(character) && locked.size > 1" in elig
    # Three locked Origin knacks wrongly assigned to visitation rows — only row 0 should show budget.
    character = {
        "tier": "hero",
        "pantheonId": "mythos",
        "callingSlots": [
            {"id": "cosmos", "dots": 1},
            {"id": "corruptor", "dots": 2},
            {"id": "defiler", "dots": 2},
        ],
        "knackIds": ["mythos_psychic_attack", "auraOfGreatness", "sage_blockade_of_reason"],
        "lockedKnackIds": ["mythos_psychic_attack", "auraOfGreatness", "sage_blockade_of_reason"],
        "finishingBonusKnackIds": [],
        "knackSlotById": {
            "mythos_psychic_attack": 1,
            "auraOfGreatness": 1,
            "sage_blockade_of_reason": 2,
        },
    }
    exempt = budget_exempt_knacks(character)
    # Before heal: two non-exempt-looking rows charged (finishing not tagged yet).
    assert row_points_used_coerced(1, character["knackIds"], character["knackSlotById"], knacks, character) >= 1
    assert row_points_used_coerced(2, character["knackIds"], character["knackSlotById"], knacks, character) >= 1
    # After tagging Finishing extras + pinning origin budget to row 0:
    character["finishingBonusKnackIds"] = ["auraOfGreatness", "sage_blockade_of_reason"]
    character["knackSlotById"]["mythos_psychic_attack"] = 0
    assert row_points_used_coerced(1, character["knackIds"], character["knackSlotById"], knacks, character) == 0
    assert row_points_used_coerced(2, character["knackIds"], character["knackSlotById"], knacks, character) == 0
    assert row_points_used_coerced(0, character["knackIds"], character["knackSlotById"], knacks, character) == 1


def test_hero_knacks_stay_budgeted_after_demigod_advance():
    """Hero chargen Knacks must not become Finishing extras at Demigod — row spend carries forward."""
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    assert "export function snapshotKnackRowBudgetCostsBeforeTierAdvance" in elig
    assert "export function snapshotMissingLockedKnackRowBudgetCosts" in elig
    assert "knackLockedRowBudgetCostById" in elig
    ensure_fin = elig.split("export function ensureFinishingBonusKnackIds")[1].split(
        "export function snapshotKnackRowBudgetCostsBeforeTierAdvance"
    )[0]
    assert "isOriginThroughHeroBandTier(character) && locked.size > 1" in ensure_fin
    assert "if (!logFin.size && !finishingBonusKnackIdSet(character).size && locked.size > 1)" in ensure_fin
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "demigod",
        "pantheonId": "mythos",
        "callingSlots": [
            {"id": "cosmos", "dots": 1},
            {"id": "corruptor", "dots": 3},
            {"id": "defiler", "dots": 2},
        ],
        "knackIds": [
            "mythos_psychic_attack",
            "auraOfGreatness",
            "sage_blockade_of_reason",
            "mythos_puppet_show",
        ],
        "lockedKnackIds": [
            "mythos_psychic_attack",
            "auraOfGreatness",
            "sage_blockade_of_reason",
            "mythos_puppet_show",
        ],
        "finishingBonusKnackIds": ["auraOfGreatness", "sage_blockade_of_reason"],
        "knackSlotById": {
            "mythos_psychic_attack": 0,
            "mythos_puppet_show": 1,
        },
        "knackLockedRowBudgetCostById": {
            "mythos_psychic_attack": 1,
            "mythos_puppet_show": 2,
        },
        "tierAdvancementLog": [
            {
                "fromTier": "mortal",
                "toTier": "hero",
                "carriedKnackIds": ["mythos_psychic_attack", "auraOfGreatness", "sage_blockade_of_reason"],
                "carriedFinishingBonusKnackIds": ["auraOfGreatness", "sage_blockade_of_reason"],
            },
            {
                "fromTier": "hero",
                "toTier": "demigod",
                "carriedKnackIds": [
                    "mythos_psychic_attack",
                    "auraOfGreatness",
                    "sage_blockade_of_reason",
                    "mythos_puppet_show",
                ],
                "carriedFinishingBonusKnackIds": [],
            },
        ],
    }
    exempt = budget_exempt_knacks(character)
    assert "mythos_puppet_show" not in exempt
    assert "auraOfGreatness" in exempt


def row_points_with_locked_snap(row_idx: int, knack_ids: list, slot_map: dict, snap_map: dict, knacks: dict, character: dict) -> int:
    """Mirrors knackRowBudgetCost + rowKnackPointsUsed for locked snapshot costs."""
    exempt = budget_exempt_knacks(character)
    used = 0
    row = int(row_idx)
    for kid in knack_ids:
        pay = slot_map.get(kid)
        if pay is None or int(pay) != row:
            continue
        if kid in exempt:
            continue
        if kid in snap_map:
            used += int(snap_map[kid])
        else:
            used += knack_point_cost(knacks[kid])
    return used


def test_demigod_corruptor_row_shows_hero_spend_with_extra_dot():
    """Hero Immortal spend (2 pts) stays on the row after Demigod advance; cap follows Calling dots."""
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    row_used = elig.split("export function rowKnackPointsUsed")[1].split("export function heavyImmortalKnackCountAssigned")[0]
    assert "knackRowBudgetCost(character, id, bundle)" in row_used
    character = {
        "tier": "demigod",
        "callingSlots": [
            {"id": "cosmos", "dots": 1},
            {"id": "corruptor", "dots": 3},
            {"id": "defiler", "dots": 2},
        ],
        "knackIds": ["mythos_psychic_attack", "auraOfGreatness", "mythos_puppet_show"],
        "lockedKnackIds": ["mythos_psychic_attack", "auraOfGreatness", "mythos_puppet_show"],
        "finishingBonusKnackIds": ["auraOfGreatness"],
        "knackSlotById": {"mythos_psychic_attack": 0, "mythos_puppet_show": 1},
        "knackLockedRowBudgetCostById": {"mythos_psychic_attack": 1, "mythos_puppet_show": 2},
    }
    used = row_points_used_coerced(1, character["knackIds"], character["knackSlotById"], knacks, character)
    assert used == 2
    assert row_dots(character, 1) == 3


def test_calling_row_cap_equals_calling_dots():
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    cap_fn = elig.split("export function callingRowDotCap")[1].split("export function rowKnackPointsUsed")[0]
    assert "heroCallingSlotRowDots(character, rowIdx)" in cap_fn
    character = {"callingSlots": [{"id": "corruptor", "dots": 3}, {"id": "defiler", "dots": 2}]}
    assert row_dots(character, 0) == 3
    assert row_dots(character, 1) == 2


def test_experience_knack_on_row_does_not_spend_calling_budget():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "demigod",
        "callingSlots": [
            {"id": "guardian", "dots": 1},
            {"id": "corruptor", "dots": 3},
            {"id": "defiler", "dots": 2},
        ],
        "knackIds": ["mythos_puppet_show", "mythos_spread_disease"],
        "lockedKnackIds": ["mythos_puppet_show"],
        "knackSlotById": {"mythos_puppet_show": 1, "mythos_spread_disease": 2},
        "knackLockedRowBudgetCostById": {"mythos_puppet_show": 2},
        "carriedExperienceKnackIds": ["mythos_spread_disease"],
    }
    assert row_points_used_coerced(1, character["knackIds"], character["knackSlotById"], knacks, character) == 2
    assert row_points_used_coerced(2, character["knackIds"], character["knackSlotById"], knacks, character) == 0


def test_heal_mortal_overflow_skips_hero_three_row_calling_buys():
    """Calling-step Immortal buys must not be mis-tagged as Experience (budget-exempt) knacks."""
    app = (ROOT / "src" / "static" / "js" / "app.js").read_text(encoding="utf-8")
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    picker = (ROOT / "src" / "static" / "js" / "knackPayingRowPicker.js").read_text(encoding="utf-8")
    heal = app.split("function healExperienceKnackIdsFromMortalOverflow()")[1].split("function healCarriedExperienceKnackIds")[0]
    assert "if (heroUsesCallingSlotRows(character)) return" in heal
    assert "export function stripRowPaidKnacksFromExperiencePools" in elig
    assert "stripRowPaidKnacksFromExperiencePools(character)" in app.split("function renderCalling(root)")[1][:1200]
    commit = picker.split("export function commitKnackToCallingRow")[1].split("export async function toggleHeroKnackWithRowPayment")[0]
    assert "character.experienceKnackIds = character.experienceKnackIds.filter((x) => x !== id)" in commit


def test_hero_click_uses_commit_when_calling_row_index_set():
    app = (ROOT / "src" / "static" / "js" / "app.js").read_text(encoding="utf-8")
    render_calling = app.split("function renderCalling(root)")[1].split("function renderFinishing")[0]
    append = render_calling.split("function appendKnackChip(container, kid, k, preferredRowIdx = null)")[1].split(
        "const appliesLine = knackAppliesToCallingsLine"
    )[0]
    assert "if (heroUsesCallingSlotRows(character))" in append
    assert "commitKnackToCallingRow(character, bundle, kid, k, rowIdx)" in append
    assert "useThreeRowKnackBuckets && heroUsesCallingSlotRows" not in append


def test_origin_heroic_knack_counts_against_cosmos_row_budget():
    """Origin heroic (1 pt) on Cosmos must spend row budget so Immortal (2 pts) cannot fit on 2 dots."""
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    app = (ROOT / "src" / "static" / "js" / "app.js").read_text(encoding="utf-8")
    assert "export function heroOriginCallingRowIndex" in elig
    assert "pinLockedOriginBudgetKnackToPrimaryRow(character, bundle)" in elig.split(
        "export function knackSlotMapForRowBudgetUi"
    )[1][:400]
    assert "knackSlotMapForRowBudgetUi(character, bundle)" in elig.split("export function callingRowsThatCanPayForKnack")[1][
        :500
    ]
    render_calling = app.split("function renderCalling(root)")[1].split("function renderFinishing")[0]
    assert "const knackBudgetMap = knackSlotMapForRowBudgetUi(character, bundle)" in render_calling
    character = {
        "tier": "hero",
        "callingId": "cosmos",
        "callingSlots": [
            {"id": "cosmos", "dots": 2},
            {"id": "sage", "dots": 1},
            {"id": "liminal", "dots": 1},
        ],
        "knackIds": ["mythos_psychic_attack"],
        "lockedKnackIds": ["mythos_psychic_attack"],
        "knackSlotById": {},
        "knackLockedRowBudgetCostById": {"mythos_psychic_attack": 1},
    }
    cosmos_row = 0
    slot_map = dict(character["knackSlotById"])
    slot_map["mythos_psychic_attack"] = cosmos_row
    used = row_points_used_coerced(cosmos_row, character["knackIds"], slot_map, knacks, character)
    assert used == 1
    cap = row_dots(character, cosmos_row)
    assert cap == 2
    immortal_cost = knack_point_cost(knacks["mythos_infinite_knowledge"])
    assert immortal_cost == 2
    assert used + immortal_cost > cap


def test_demigod_cosmos_two_dots_one_heroic_only_one_slot_left():
    """Demigod three-row: Immortal knacks cost 2 points — one heroic from Origin leaves no room for Immortal."""
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "demigod",
        "callingId": "cosmos",
        "callingSlots": [
            {"id": "cosmos", "dots": 2},
            {"id": "corruptor", "dots": 1},
            {"id": "defiler", "dots": 1},
        ],
        "knackIds": ["mythos_psychic_attack"],
        "lockedKnackIds": ["mythos_psychic_attack"],
        "knackSlotById": {"mythos_psychic_attack": 0},
        "knackLockedRowBudgetCostById": {"mythos_psychic_attack": 1},
    }
    used = row_points_used_coerced(0, character["knackIds"], character["knackSlotById"], knacks, character)
    assert used == 1
    assert row_dots(character, 0) == 2
    assert used + 1 <= 2
    assert used + 2 > 2
