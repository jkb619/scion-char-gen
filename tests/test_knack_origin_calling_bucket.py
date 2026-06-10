"""Regression: Origin Calling knack chip groups (mirrors src/static/js/eligibility.js)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KNACKS_PATH = ROOT / "src" / "data" / "knacks.json"
CALLINGS_PATH = ROOT / "src" / "data" / "callings.json"

MYTHOS_INVERTED = {
    "creator": "destroyer",
    "destroyer": "creator",
    "guardian": "corruptor",
    "corruptor": "guardian",
    "healer": "defiler",
    "defiler": "healer",
    "lover": "adversary",
    "adversary": "lover",
    "leader": "tyrant",
    "tyrant": "leader",
    "sage": "cosmos",
    "cosmos": "sage",
    "warrior": "torturer",
    "torturer": "warrior",
}
MYTHOS_NORMAL = frozenset({"creator", "guardian", "healer", "lover", "leader", "sage", "warrior"})
MYTHOS_UNPAIRED = frozenset({"hunter", "judge", "liminal", "trickster"})


def mythos_twin(calling_id: str) -> str | None:
    return MYTHOS_INVERTED.get(calling_id)


def is_inverted_twin(calling_id: str) -> bool:
    twin = mythos_twin(calling_id)
    return bool(twin and twin in MYTHOS_NORMAL)


def expand_motm(knack: dict, callings: list[str]) -> list[str]:
    kid = str(knack.get("id") or "")
    if not kid.startswith("mythos_"):
        return callings
    pant = knack.get("pantheonAnyOf") or []
    if "mythos" not in pant:
        return callings
    out = set(callings)
    for cid in callings:
        twin = mythos_twin(cid)
        if twin:
            out.add(twin)
    return list(out)


def knack_raw_calling_list(knack: dict) -> list[str]:
    if knack.get("callingsAny") or knack.get("calling") == "any":
        return []
    raw = knack.get("callings") or ([knack["calling"]] if knack.get("calling") else [])
    return [x.strip() for x in raw if isinstance(x, str) and x.strip()]


def knack_may_use_pending_hero_row(knack: dict) -> bool:
    if knack.get("callingsAny") or knack.get("calling") == "any":
        return True
    raw = knack_raw_calling_list(knack)
    if not raw:
        return True
    return len(set(raw)) >= 2


def slot_row_calling_tokens(calling_id: str, character: dict) -> set[str]:
    cid = (calling_id or "").strip()
    if not cid:
        return set()
    out = {cid}
    mythos_pan = (character.get("pantheonId") or "").strip() == "mythos"
    twin = mythos_twin(cid)
    if twin and (mythos_pan or is_inverted_twin(cid)):
        out.add(twin)
    return out


def knack_calling_tokens_for_row_match(knack: dict, character: dict) -> set[str] | None:
    if knack.get("callingsAny") or knack.get("calling") == "any":
        return None
    raw = knack_raw_calling_list(knack)
    if not raw:
        return set()
    return set(expand_motm(knack, raw))


def origin_calling_knack_chip_group_key(knack: dict, character: dict) -> str:
    if knack.get("callingsAny") or knack.get("calling") == "any":
        return "any"
    kn_tok = knack_calling_tokens_for_row_match(knack, character)
    if kn_tok is None or len(kn_tok) == 0:
        return "any"
    cid = (character.get("callingId") or "").strip()
    if cid:
        row_tok = slot_row_calling_tokens(cid, character)
        for token in kn_tok:
            if token in row_tok:
                return "selected"
    if knack_may_use_pending_hero_row(knack):
        return "any"
    return "any"


def knack_rule_tier(knack: dict) -> str:
    t = str(knack.get("tier") or "").strip().lower()
    if t == "mortal":
        return "mortal"
    if t in ("immortal", "heroic"):
        return "immortal"
    kind = str(knack.get("knackKind") or "").strip().lower()
    tmin = str(knack.get("tierMin") or "").strip().lower()
    if kind == "mortal" or tmin == "mortal":
        return "mortal"
    return "immortal"


def knack_eligible_mortal(knack: dict, character: dict) -> bool:
    if knack.get("callingsAny") or knack.get("calling") == "any":
        pass
    else:
        allowed = set(expand_motm(knack, knack_raw_calling_list(knack)))
        char_callings = set()
        cid = (character.get("callingId") or "").strip()
        if cid:
            char_callings.add(cid)
        mythos_pan = (character.get("pantheonId") or "").strip() == "mythos"
        for c in list(char_callings):
            twin = mythos_twin(c)
            if twin and (mythos_pan or is_inverted_twin(c)):
                char_callings.add(twin)
        if allowed and not (allowed & char_callings):
            return False
    tr = 0
    kt = knack_rule_tier(knack)
    if tr == 0 and kt != "mortal":
        return False
    pant = knack.get("pantheonAnyOf")
    if pant and (character.get("pantheonId") or "") not in pant:
        return False
    return True


def test_mythos_psychic_attack_buckets_to_cosmos_not_general():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    knack = knacks["mythos_psychic_attack"]
    character = {
        "tier": "mortal",
        "callingId": "cosmos",
        "pantheonId": "mythos",
        "knackIds": [],
    }
    assert knack_rule_tier(knack) == "mortal"
    assert knack_eligible_mortal(knack, character)
    assert origin_calling_knack_chip_group_key(knack, character) == "selected"


def test_mythos_psychic_attack_not_eligible_without_mythos_pantheon():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    knack = knacks["mythos_psychic_attack"]
    character = {
        "tier": "mortal",
        "callingId": "cosmos",
        "pantheonId": "greek",
        "knackIds": [],
    }
    assert not knack_eligible_mortal(knack, character)


def test_origin_mortal_liminal_knacks_eligible_at_origin():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "mortal",
        "callingId": "liminal",
        "pantheonId": "greek",
        "knackIds": [],
    }
    mortal_liminal = [
        "liminal_beyond_memory",
        "liminal_complete_privacy",
        "liminal_experienced_traveler",
        "liminal_flatlander",
        "liminal_neither_the_minute_nor_the_hour",
        "liminal_unerring_delivery",
        "liminal_unobtrusive_visitor",
    ]
    for kid in mortal_liminal:
        assert knack_rule_tier(knacks[kid]) == "mortal", kid
        assert knack_eligible_mortal(knacks[kid], character), kid
        assert origin_calling_knack_chip_group_key(knacks[kid], character) == "selected", kid


DENIZEN_CALLING_IDS = frozenset({"c_sith", "kitsune", "satyr", "therianthrope", "wolf_warrior"})


def is_denizen_calling(calling_id: str, callings: dict) -> bool:
    cid = (calling_id or "").strip()
    if not cid:
        return False
    row = callings.get(cid)
    if isinstance(row, dict) and row.get("denizenCalling") is True:
        return True
    meta = callings.get("_meta") or {}
    listed = meta.get("denizenCallingIds") or []
    return cid in listed or cid in DENIZEN_CALLING_IDS


def calling_in_wizard_chooser(calling_id: str, callings: dict, mythos_pantheon: bool) -> bool:
    cid = (calling_id or "").strip()
    if not cid or cid.startswith("_") or cid not in callings:
        return False
    if is_denizen_calling(cid, callings):
        return False
    if mythos_pantheon:
        return True
    twin = mythos_twin(cid)
    return not bool(twin and twin in MYTHOS_NORMAL)


def test_mythos_calling_chooser_includes_standard_and_inverted():
    callings = {"sage": {}, "cosmos": {}, "liminal": {}}
    assert calling_in_wizard_chooser("sage", callings, True)
    assert calling_in_wizard_chooser("cosmos", callings, True)
    assert calling_in_wizard_chooser("liminal", callings, True)
    assert not calling_in_wizard_chooser("cosmos", callings, False)


def test_denizen_callings_excluded_from_chooser():
    callings = json.loads(CALLINGS_PATH.read_text(encoding="utf-8"))
    for cid in DENIZEN_CALLING_IDS:
        assert is_denizen_calling(cid, callings)
        assert not calling_in_wizard_chooser(cid, callings, True)
        assert not calling_in_wizard_chooser(cid, callings, False)


def test_motm_inverted_pairs_grant_standard_twin_knacks():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    cases = [
        ("destroyer", "creator", "creator_flawlessly_platonic_ideal"),
        ("corruptor", "guardian", "guardian_a_warning"),
        ("defiler", "healer", "healer_combat_medic"),
        ("adversary", "lover", "lover_lovers_intuition"),
        ("torturer", "warrior", "warrior_feat_of_arms"),
        ("tyrant", "leader", "leader_good_listener"),
    ]
    for inverted_id, standard_id, sample_kid in cases:
        assert sample_kid in knacks, sample_kid
        k = knacks[sample_kid]
        assert standard_id in (k.get("callings") or []), sample_kid
        character = {
            "tier": "hero",
            "callingId": inverted_id,
            "pantheonId": "mythos",
            "knackIds": [],
        }
        allowed = set(expand_motm(k, knack_raw_calling_list(k)))
        char_callings = {inverted_id}
        twin = mythos_twin(inverted_id)
        if twin:
            char_callings.add(twin)
        assert allowed & char_callings, (inverted_id, sample_kid)


def test_motm_unpaired_callings_have_no_twin_knack_access():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "mortal",
        "callingId": "liminal",
        "pantheonId": "mythos",
        "knackIds": [],
    }
    assert mythos_twin("liminal") is None
    leader_knack = knacks["leader_good_listener"]
    assert not knack_eligible_mortal(leader_knack, character)


def test_cosmos_origin_mortal_pool_inverted_and_standard():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "mortal",
        "callingId": "cosmos",
        "pantheonId": "mythos",
        "knackIds": [],
    }
    inverted = []
    standard = []
    for kid, k in knacks.items():
        if kid.startswith("_"):
            continue
        if not knack_eligible_mortal(k, character):
            continue
        if origin_calling_knack_chip_group_key(k, character) != "selected":
            continue
        if kid.startswith("mythos_"):
            inverted.append(kid)
        elif "sage" in (k.get("callings") or []):
            standard.append(kid)
    assert inverted == ["mythos_psychic_attack"]
    assert set(standard) == {
        "sage_blockade_of_reason",
        "sage_palace_of_memory",
        "sage_presence_of_magic",
    }


def test_origin_mortal_sage_knacks_show_for_cosmos_via_twin():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "mortal",
        "callingId": "cosmos",
        "pantheonId": "mythos",
        "knackIds": [],
    }
    for kid in (
        "sage_blockade_of_reason",
        "sage_palace_of_memory",
        "sage_presence_of_magic",
    ):
        k = knacks[kid]
        assert knack_rule_tier(k) == "mortal", kid
        assert knack_eligible_mortal(k, character), kid
        assert origin_calling_knack_chip_group_key(k, character) == "selected", kid


def test_origin_mortal_general_calling_knacks():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "mortal",
        "callingId": "cosmos",
        "pantheonId": "mythos",
        "knackIds": [],
    }
    for kid in (
        "auraOfGreatness",
        "bornToBeKings",
        "scentTheDivine",
        "somebodysWatchingMe",
    ):
        k = knacks[kid]
        assert knack_rule_tier(k) == "mortal", kid
        assert knack_eligible_mortal(k, character), kid
        assert origin_calling_knack_chip_group_key(k, character) == "any", kid


def test_aura_of_greatness_stays_general():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    knack = knacks["auraOfGreatness"]
    character = {
        "tier": "mortal",
        "callingId": "cosmos",
        "pantheonId": "mythos",
        "knackIds": [],
    }
    assert knack_rule_tier(knack) == "mortal"
    assert knack_eligible_mortal(knack, character)
    assert origin_calling_knack_chip_group_key(knack, character) == "any"


def test_knacks_json_uses_tier_not_tier_min():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    sample = 0
    for kid, row in knacks.items():
        if kid.startswith("_"):
            continue
        assert "tier" in row, kid
        assert row["tier"] in ("mortal", "immortal"), kid
        assert row["tier"] != "heroic", kid
        assert "callingSlotCost" in row, kid
        assert row["callingSlotCost"] in (1, 2), kid
        assert "tierMin" not in row, kid
        assert "knackKind" not in row, kid
        sample += 1
        if sample >= 20:
            break
