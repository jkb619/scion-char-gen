"""Regression: Origin Calling knack chip groups (mirrors src/static/js/eligibility.js)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KNACKS_PATH = ROOT / "src" / "data" / "knacks.json"
CALLINGS_PATH = ROOT / "src" / "data" / "callings.json"
PANTHEONS_PATH = ROOT / "src" / "data" / "pantheons.json"

_CALLINGS_META = json.loads(CALLINGS_PATH.read_text(encoding="utf-8"))["_meta"]
MOTM_STANDARD_TO_INVERTED = dict(_CALLINGS_META["motmInvertedPairs"])
MYTHOS_INVERTED = {
    **MOTM_STANDARD_TO_INVERTED,
    **{inv: std for std, inv in MOTM_STANDARD_TO_INVERTED.items()},
}
MYTHOS_NORMAL = frozenset(MOTM_STANDARD_TO_INVERTED.keys())
MYTHOS_UNPAIRED = frozenset(_CALLINGS_META.get("motmUnpairedCallings") or [])


def character_has_motm_inverted_calling(character: dict) -> bool:
    cid = (character.get("callingId") or "").strip()
    if cid and is_inverted_twin(cid):
        return True
    slots = character.get("callingSlots")
    if isinstance(slots, list):
        for s in slots:
            if isinstance(s, dict):
                sid = (s.get("id") or "").strip()
                if sid and is_inverted_twin(sid):
                    return True
    return False


def parent_deity_pantheon_id(character: dict) -> str:
    patron = (character.get("parentDeityId") or "").strip()
    if not patron:
        return ""
    pantheons = json.loads(PANTHEONS_PATH.read_text(encoding="utf-8"))
    for pid, pant in pantheons.items():
        if not pid or pid.startswith("_") or not isinstance(pant, dict):
            continue
        for key in ("deities", "titans"):
            rows = pant.get(key) or []
            if any(isinstance(d, dict) and (d.get("id") or "").strip() == patron for d in rows):
                return pid
    return ""


def character_has_motm_standard_twin_calling(character: dict) -> bool:
    cid = (character.get("callingId") or "").strip()
    if cid and is_standard_twin(cid):
        return True
    slots = character.get("callingSlots")
    if isinstance(slots, list):
        for s in slots:
            if isinstance(s, dict):
                sid = (s.get("id") or "").strip()
                if sid and is_standard_twin(sid):
                    return True
    return False


def is_mythos_for_character(character: dict) -> bool:
    if (character.get("pantheonId") or "").strip() == "mythos":
        return True
    if character_has_motm_inverted_calling(character):
        return True
    return parent_deity_pantheon_id(character) == "mythos"


def pantheon_id_for_knack_gates(character: dict) -> str:
    pid = (character.get("pantheonId") or "").strip()
    if pid:
        return pid
    return "mythos" if is_mythos_for_character(character) else ""


def mythos_twin(calling_id: str) -> str | None:
    return MYTHOS_INVERTED.get(calling_id)


def is_inverted_twin(calling_id: str) -> bool:
    twin = mythos_twin(calling_id)
    return bool(twin and twin in MYTHOS_NORMAL)


def is_standard_twin(calling_id: str) -> bool:
    return (calling_id or "").strip() in MYTHOS_NORMAL


def motm_knack_access_twin(calling_id: str, mythos_pantheon: bool) -> str | None:
    cid = (calling_id or "").strip()
    twin = mythos_twin(cid)
    if not twin:
        return None
    if mythos_pantheon:
        return twin
    if is_inverted_twin(cid):
        return twin
    return None


def expand_motm_knack_access(knack: dict, callings: list[str], character: dict) -> list[str]:
    mythos_pan = (
        is_mythos_for_character(character)
        or character_has_motm_inverted_calling(character)
        or (
            character_has_motm_standard_twin_calling(character)
            and parent_deity_pantheon_id(character) == "mythos"
        )
    )
    kid = str(knack.get("id") or "")
    pant = knack.get("pantheonAnyOf") or []
    motm_knack = kid.startswith("mythos_") or "mythos" in pant
    out = set(callings)
    if motm_knack or mythos_pan:
        for cid in callings:
            twin = mythos_twin(cid)
            if twin:
                out.add(twin)
    else:
        for cid in callings:
            if is_inverted_twin(cid):
                twin = mythos_twin(cid)
                if twin:
                    out.add(twin)
    return list(out)


def expand_motm(knack: dict, callings: list[str], character: dict | None = None) -> list[str]:
    if character is None:
        character = {}
    return expand_motm_knack_access(knack, callings, character)


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
    mythos_pan = is_mythos_for_character(character)
    twin = motm_knack_access_twin(cid, mythos_pan)
    if twin:
        out.add(twin)
    return out


def knack_calling_tokens_for_row_match(knack: dict, character: dict) -> set[str] | None:
    if knack.get("callingsAny") or knack.get("calling") == "any":
        return None
    raw = knack_raw_calling_list(knack)
    if not raw:
        return set()
    return set(expand_motm_knack_access(knack, raw, character))


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
    if t in ("mortal", "heroic", "immortal"):
        return t
    kind = str(knack.get("knackKind") or "").strip().lower()
    tmin = str(knack.get("tierMin") or "").strip().lower()
    if kind == "mortal" or tmin == "mortal":
        return "mortal"
    if kind == "heroic" or tmin == "hero":
        return "heroic"
    return "immortal"


def knack_origin_mortal_pick(knack: dict) -> bool:
    return knack.get("originMortal") is True


def motm_inverted_chargen_knack_at_origin(knack: dict, character: dict) -> bool:
    if not is_mythos_for_character(character):
        return False
    kid = str(knack.get("id") or "")
    pant = knack.get("pantheonAnyOf") or []
    if not kid.startswith("mythos_") and "mythos" not in pant:
        return False
    raw = knack_raw_calling_list(knack)
    if not raw:
        return False
    expanded = set(expand_motm_knack_access(knack, raw, character))
    char_callings = set()
    cid = (character.get("callingId") or "").strip()
    if cid:
        char_callings.add(cid)
    for c in list(char_callings):
        twin = motm_knack_access_twin(c, True)
        if twin:
            char_callings.add(twin)
    if not (expanded & char_callings):
        return False
    return knack_rule_tier(knack) == "heroic"


def tier_rank(tier: str | None) -> int:
    t = (tier or "mortal").strip().lower()
    return 0 if t in ("mortal", "origin") else 1


def knack_eligible(knack: dict, character: dict) -> bool:
    if knack.get("callingsAny") or knack.get("calling") == "any":
        pass
    else:
        allowed = set(expand_motm_knack_access(knack, knack_raw_calling_list(knack), character))
        char_callings = set()
        cid = (character.get("callingId") or "").strip()
        if cid:
            char_callings.add(cid)
        mythos_pan = is_mythos_for_character(character)
        for c in list(char_callings):
            twin = motm_knack_access_twin(c, mythos_pan)
            if twin:
                char_callings.add(twin)
        if allowed and not (allowed & char_callings):
            return False
    tr = tier_rank(character.get("tier"))
    kt = knack_rule_tier(knack)
    if tr == 0:
        if kt == "immortal":
            return False
        if kt != "mortal" and not knack_origin_mortal_pick(knack):
            if not motm_inverted_chargen_knack_at_origin(knack, character):
                return False
    elif kt == "mortal":
        return False
    pant = knack.get("pantheonAnyOf")
    if pant:
        pg = pantheon_id_for_knack_gates(character)
        if not pg or pg not in pant:
            return False
    return True


def knack_eligible_mortal(knack: dict, character: dict) -> bool:
    if knack.get("callingsAny") or knack.get("calling") == "any":
        pass
    else:
        allowed = set(expand_motm_knack_access(knack, knack_raw_calling_list(knack), character))
        char_callings = set()
        cid = (character.get("callingId") or "").strip()
        if cid:
            char_callings.add(cid)
        mythos_pan = is_mythos_for_character(character)
        for c in list(char_callings):
            twin = motm_knack_access_twin(c, mythos_pan)
            if twin:
                char_callings.add(twin)
        if allowed and not (allowed & char_callings):
            return False
    kt = knack_rule_tier(knack)
    if kt == "immortal":
        return False
    if kt != "mortal" and not knack_origin_mortal_pick(knack):
        if not motm_inverted_chargen_knack_at_origin(knack, character):
            return False
    pant = knack.get("pantheonAnyOf")
    if pant:
        pg = pantheon_id_for_knack_gates(character)
        if not pg or pg not in pant:
            return False
    return True


def test_mythos_psychic_attack_buckets_to_cosmos_not_general():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    knack = knacks["mythos_psychic_attack"]
    assert knack_rule_tier(knack) == "heroic"
    origin_character = {
        "tier": "mortal",
        "callingId": "cosmos",
        "pantheonId": "mythos",
        "knackIds": [],
    }
    assert knack_eligible_mortal(knack, origin_character)
    hero_character = {
        "tier": "hero",
        "callingId": "cosmos",
        "pantheonId": "mythos",
        "knackIds": [],
    }
    assert knack_rule_tier(knack) != "mortal"
    assert origin_calling_knack_chip_group_key(knack, hero_character) == "selected"


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
        assert knack_rule_tier(knacks[kid]) == "heroic", kid
        assert knacks[kid].get("originMortal") is True, kid
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


def test_motm_standard_calling_grants_inverted_twin_knacks():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    assert motm_knack_access_twin("sage", True) == "cosmos"
    hero_character = {
        "tier": "hero",
        "callingId": "sage",
        "pantheonId": "mythos",
        "knackIds": [],
    }
    knack = knacks["mythos_psychic_attack"]
    assert knack_rule_tier(knack) == "heroic"
    assert origin_calling_knack_chip_group_key(knack, hero_character) == "selected"


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
        mythos_pan = True
        char_callings = {inverted_id}
        twin = motm_knack_access_twin(inverted_id, mythos_pan)
        if twin:
            char_callings.add(twin)
        assert allowed & char_callings, (inverted_id, sample_kid)

    for standard_id, inverted_id, sample_kid in (
        ("sage", "cosmos", "mythos_psychic_attack"),
        ("creator", "destroyer", "mythos_rust_and_decay"),
        ("leader", "tyrant", "mythos_harsh_words"),
    ):
        k = knacks[sample_kid]
        allowed = set(expand_motm(k, knack_raw_calling_list(k)))
        char_callings = {standard_id, motm_knack_access_twin(standard_id, True)}
        assert allowed & char_callings, (standard_id, sample_kid)


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
    assert "mythos_psychic_attack" in inverted
    assert "sage_blockade_of_reason" in standard
    assert len(standard) >= 7
    assert all(knacks[k].get("originMortal") for k in standard)


def _first_origin_mortal_knack(knacks: dict, calling_id: str) -> str | None:
    for kid, row in knacks.items():
        if kid.startswith("_"):
            continue
        if not row.get("originMortal"):
            continue
        if calling_id in knack_raw_calling_list(row):
            return kid
    return None


def _first_standard_heroic_knack(knacks: dict, calling_id: str) -> str | None:
    for kid, row in knacks.items():
        if kid.startswith("_") or kid.startswith("mythos_"):
            continue
        if knack_rule_tier(row) != "heroic" or row.get("originMortal"):
            continue
        if knack_raw_calling_list(row) == [calling_id]:
            return kid
    return None


def _first_mythos_heroic_knack(knacks: dict, standard_id: str, inverted_id: str) -> str | None:
    for kid, row in knacks.items():
        if not kid.startswith("mythos_") or knack_rule_tier(row) != "heroic":
            continue
        expanded = set(expand_motm(row, knack_raw_calling_list(row)))
        if standard_id in expanded or inverted_id in expanded:
            return kid
    return None


def test_all_motm_inverted_callings_reach_standard_twin_knacks():
    """Every inverted Calling reaches its standard twin’s Origin + Heroic PB knacks on Mythos."""
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    for standard_id, inverted_id in MOTM_STANDARD_TO_INVERTED.items():
        origin_kid = _first_origin_mortal_knack(knacks, standard_id)
        heroic_kid = _first_standard_heroic_knack(knacks, standard_id)
        assert origin_kid, f"no originMortal knack for {standard_id}"
        assert heroic_kid, f"no heroic PB knack for {standard_id}"
        origin_char = {
            "tier": "mortal",
            "callingId": inverted_id,
            "pantheonId": "mythos",
            "knackIds": [],
        }
        hero_char = {**origin_char, "tier": "hero"}
        assert knack_eligible(knacks[origin_kid], origin_char), inverted_id
        assert origin_calling_knack_chip_group_key(knacks[origin_kid], origin_char) == "selected"
        assert knack_eligible(knacks[heroic_kid], hero_char), inverted_id
        assert origin_calling_knack_chip_group_key(knacks[heroic_kid], hero_char) == "selected"


def test_all_motm_standard_callings_reach_inverted_mythos_knacks():
    """Every standard Calling in a pair reaches inverted Mythos Heroic knacks on the Mythos pantheon."""
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    for standard_id, inverted_id in MOTM_STANDARD_TO_INVERTED.items():
        mythos_kid = _first_mythos_heroic_knack(knacks, standard_id, inverted_id)
        assert mythos_kid, f"no mythos heroic knack for {standard_id}/{inverted_id}"
        for calling_id in (standard_id, inverted_id):
            origin_char = {
                "tier": "mortal",
                "callingId": calling_id,
                "pantheonId": "mythos",
                "knackIds": [],
            }
            hero_char = {**origin_char, "tier": "hero"}
            row = knacks[mythos_kid]
            assert knack_eligible(row, origin_char), calling_id
            assert knack_eligible(row, hero_char), calling_id
            assert origin_calling_knack_chip_group_key(row, hero_char) == "selected"


def test_origin_mythos_blocks_immortal_inverted_knacks():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    cosmos_origin = {
        "tier": "mortal",
        "callingId": "cosmos",
        "pantheonId": "mythos",
        "knackIds": [],
    }
    infinite = knacks["mythos_infinite_knowledge"]
    assert knack_rule_tier(infinite) == "immortal"
    assert not knack_eligible(infinite, cosmos_origin)
    psychic = knacks["mythos_psychic_attack"]
    assert knack_eligible(psychic, cosmos_origin)
    sage_immortal = knacks.get("sage_infinite_knowledge")
    if sage_immortal:
        assert knack_rule_tier(sage_immortal) == "immortal"
        assert not knack_eligible(sage_immortal, {**cosmos_origin, "callingId": "sage"})


def _player_calling_ids(callings: dict) -> list[str]:
    meta = callings.get("_meta") or {}
    denizen = set(meta.get("denizenCallingIds") or [])
    out = []
    for cid, row in callings.items():
        if cid.startswith("_"):
            continue
        if not isinstance(row, dict):
            continue
        if row.get("denizenCalling") or cid in denizen:
            continue
        out.append(cid)
    return sorted(out)


def test_no_immortal_knack_eligible_at_origin_for_any_calling():
    """Origin: one Heroic knack only — no Calling may pick any Immortal row (PB, MotM, or supplement)."""
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    callings = json.loads(CALLINGS_PATH.read_text(encoding="utf-8"))
    immortal_ids = [
        kid
        for kid, row in knacks.items()
        if not kid.startswith("_") and knack_rule_tier(row) == "immortal"
    ]
    assert immortal_ids, "expected immortal knack rows in catalog"
    mythos_immortal = [kid for kid in immortal_ids if kid.startswith("mythos_")]
    assert mythos_immortal, "expected MotM immortal inverted knacks"
    for pantheon_id in ("mythos", "greek", "loa", ""):
        for calling_id in _player_calling_ids(callings):
            for tier in ("mortal", "origin"):
                character = {
                    "tier": tier,
                    "callingId": calling_id,
                    "pantheonId": pantheon_id,
                    "knackIds": [],
                }
                for kid in immortal_ids:
                    assert not knack_eligible(knacks[kid], character), (
                        f"{kid} must not be Origin-eligible for {calling_id} "
                        f"(tier={tier}, pantheon={pantheon_id!r})"
                    )


def test_motm_inverted_off_mythos_still_reaches_standard_not_inverted_mythos():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    destroyer = {
        "tier": "hero",
        "callingId": "destroyer",
        "pantheonId": "greek",
        "knackIds": [],
    }
    assert knack_eligible(knacks["creator_flawlessly_platonic_ideal"], destroyer)
    assert not knack_eligible(knacks["mythos_rust_and_decay"], destroyer)


def test_sage_origin_mythos_subpool_includes_psychic_attack():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "mortal",
        "callingId": "sage",
        "pantheonId": "mythos",
        "knackIds": [],
    }
    inverted = []
    standard = []
    for kid, row in knacks.items():
        if kid.startswith("_"):
            continue
        if not knack_eligible_mortal(row, character):
            continue
        if origin_calling_knack_chip_group_key(row, character) != "selected":
            continue
        sub = motm_inverted_knack_subpool_key(row, character, "sage", kid)
        if sub == "inverted":
            inverted.append(kid)
        elif sub == "standard-twin":
            standard.append(kid)
    inverted, standard = dedupe_motm_twin_knack_subpool_lists(
        [(k, knacks[k]) for k in inverted],
        [(k, knacks[k]) for k in standard],
        "sage",
    )
    assert "mythos_psychic_attack" in [kid for kid, _ in inverted]
    assert len(standard) >= 7


def test_sage_mythos_patron_without_pantheon_id_shows_inverted_knacks():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "mortal",
        "callingId": "sage",
        "pantheonId": "",
        "parentDeityId": "greenishFlame",
        "knackIds": [],
    }
    assert is_mythos_for_character(character)
    assert knack_eligible_mortal(knacks["mythos_psychic_attack"], character)
    sub = motm_inverted_knack_subpool_key(
        knacks["mythos_psychic_attack"], character, "sage", "mythos_psychic_attack"
    )
    assert sub == "inverted"


def test_greek_sage_does_not_get_mythos_inverted_knacks():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "mortal",
        "callingId": "sage",
        "pantheonId": "greek",
        "parentDeityId": "zeus",
        "knackIds": [],
    }
    assert not is_mythos_for_character(character)
    assert not knack_eligible_mortal(knacks["mythos_psychic_attack"], character)


def test_sage_origin_mythos_shows_inverted_cosmos_knacks():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "mortal",
        "callingId": "sage",
        "pantheonId": "mythos",
        "knackIds": [],
    }
    assert knack_eligible_mortal(knacks["mythos_psychic_attack"], character)
    assert origin_calling_knack_chip_group_key(knacks["mythos_psychic_attack"], character) == "selected"
    assert not knack_eligible_mortal(
        knacks["mythos_psychic_attack"],
        {**character, "pantheonId": "loa"},
    )


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
        "sage_master_of_the_world",
        "sage_palace_of_memory",
        "sage_presence_of_magic",
        "sage_office_hours",
        "sage_omniglot_translation",
        "sage_speed_reading",
    ):
        k = knacks[kid]
        assert knack_rule_tier(k) == "heroic", kid
        assert k.get("originMortal") is True, kid
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
        assert knack_rule_tier(k) == "heroic", kid
        assert k.get("originMortal") is True, kid
        assert knack_eligible_mortal(k, character), kid
        assert origin_calling_knack_chip_group_key(k, character) == "any", kid


def motm_inverted_knack_subpool_key(knack: dict, character: dict, row_calling_id: str, knack_id: str) -> str | None:
    cid = (row_calling_id or character.get("callingId") or "").strip()
    if not cid:
        return None
    twin = mythos_twin(cid)
    if not twin or (not is_inverted_twin(cid) and not is_standard_twin(cid)):
        return None
    inverted_id = cid if is_inverted_twin(cid) else twin
    standard_id = cid if is_standard_twin(cid) else twin
    kid = (knack_id or knack.get("id") or "").strip()
    pant = knack.get("pantheonAnyOf") or []
    if kid.startswith("mythos_") and "mythos" in pant:
        return "inverted"
    raw = knack_raw_calling_list(knack)
    if inverted_id in raw and standard_id in raw:
        if is_inverted_twin(cid):
            return "inverted"
        if is_standard_twin(cid):
            return "standard-twin"
    if standard_id in raw:
        return "standard-twin"
    if inverted_id in raw:
        return "inverted"
    return None


def dedupe_motm_twin_knack_subpool_lists(
    inverted: list[tuple[str, dict]],
    standard: list[tuple[str, dict]],
    anchor_calling_id: str,
) -> tuple[list[tuple[str, dict]], list[tuple[str, dict]]]:
    def name_key(entry: tuple[str, dict]) -> str:
        kid, row = entry
        return str(row.get("name") or kid).strip().lower()

    inv_names = {name_key(e) for e in inverted}
    std_names = {name_key(e) for e in standard}
    dup = inv_names & std_names
    if not dup:
        return inverted, standard
    if is_inverted_twin(anchor_calling_id):
        return inverted, [e for e in standard if name_key(e) not in dup]
    return [e for e in inverted if name_key(e) not in dup], standard


def test_motm_plague_bearer_shows_once_for_defiler():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {"tier": "hero", "callingId": "defiler", "pantheonId": "mythos", "knackIds": []}
    entries = [
        ("mythos_plague_bearer", knacks["mythos_plague_bearer"]),
        ("healer_plague_bearer", knacks["healer_plague_bearer"]),
    ]
    inverted = []
    standard = []
    for kid, row in entries:
        sub = motm_inverted_knack_subpool_key(row, character, "defiler", kid)
        if sub == "inverted":
            inverted.append((kid, row))
        elif sub == "standard-twin":
            standard.append((kid, row))
    inverted, standard = dedupe_motm_twin_knack_subpool_lists(inverted, standard, "defiler")
    assert [kid for kid, _ in inverted] == ["mythos_plague_bearer"]
    assert standard == []


def test_motm_plague_bearer_shows_once_for_healer():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {"tier": "hero", "callingId": "healer", "pantheonId": "mythos", "knackIds": []}
    entries = [
        ("mythos_plague_bearer", knacks["mythos_plague_bearer"]),
        ("healer_plague_bearer", knacks["healer_plague_bearer"]),
    ]
    inverted = []
    standard = []
    for kid, row in entries:
        sub = motm_inverted_knack_subpool_key(row, character, "healer", kid)
        if sub == "inverted":
            inverted.append((kid, row))
        elif sub == "standard-twin":
            standard.append((kid, row))
    inverted, standard = dedupe_motm_twin_knack_subpool_lists(inverted, standard, "healer")
    assert [kid for kid, _ in standard] == ["healer_plague_bearer"]
    assert inverted == []


def test_aura_of_greatness_stays_general():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    knack = knacks["auraOfGreatness"]
    character = {
        "tier": "mortal",
        "callingId": "cosmos",
        "pantheonId": "mythos",
        "knackIds": [],
    }
    assert knack_rule_tier(knack) == "heroic"
    assert knack.get("originMortal") is True
    assert knack_eligible_mortal(knack, character)
    assert origin_calling_knack_chip_group_key(knack, character) == "any"


SAGE_HEROIC_KNACK_IDS = frozenset(
    {
        "sage_blockade_of_reason",
        "sage_master_of_the_world",
        "sage_palace_of_memory",
        "sage_presence_of_magic",
        "sage_office_hours",
        "sage_omniglot_translation",
        "sage_speed_reading",
    }
)


def test_guardian_origin_mortal_knacks_eligible():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "mortal",
        "callingId": "guardian",
        "pantheonId": "greek",
        "knackIds": [],
    }
    for kid in (
        "guardian_a_fortress",
        "guardian_a_purpose",
        "guardian_a_sentinel",
        "guardian_a_talisman",
        "guardian_a_vigil",
        "guardian_a_warning",
    ):
        row = knacks[kid]
        assert row.get("originMortal") is True, kid
        assert knack_rule_tier(row) == "heroic", kid
        assert knack_eligible_mortal(row, character), kid
        assert origin_calling_knack_chip_group_key(row, character) == "selected", kid


def test_sage_heroic_knacks_use_pb_heroic_band():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    for kid in SAGE_HEROIC_KNACK_IDS:
        row = knacks[kid]
        assert row["tier"] == "heroic", kid
        assert row["callingSlotCost"] == 1, kid
    for origin_kid in (
        "sage_blockade_of_reason",
        "sage_palace_of_memory",
        "sage_presence_of_magic",
    ):
        assert knacks[origin_kid].get("originMortal") is True


ORIGIN_MORTAL_CALLING_SAMPLES = {
    "creator": "creator_innate_toolkit",
    "healer": "healer_combat_medic",
    "hunter": "hunter_apex_predator",
    "judge": "judge_objection",
    "leader": "leader_good_listener",
    "lover": "lover_fluid_appeal",
    "trickster": "trickster_light_fingered",
    "warrior": "warrior_tempered",
}


def test_origin_mortal_knacks_all_core_callings():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    for calling_id, sample_kid in ORIGIN_MORTAL_CALLING_SAMPLES.items():
        assert sample_kid in knacks, sample_kid
        row = knacks[sample_kid]
        assert row.get("originMortal") is True, sample_kid
        assert row["tier"] == "heroic", sample_kid
        character = {"tier": "mortal", "callingId": calling_id, "knackIds": []}
        assert knack_eligible_mortal(row, character), sample_kid


def test_pb_knacks_use_heroic_or_immortal_tier():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    for kid, row in knacks.items():
        if kid.startswith("_") or any(kid.startswith(p) for p in ("sm_", "tr_", "mythos_")):
            continue
        assert row["tier"] in ("heroic", "immortal"), kid


def hero_knack_chip_bucket_key(knack: dict, character: dict) -> int | str:
    """Mirror eligibility.js heroKnackChipBucketKey."""
    slots = character.get("callingSlots") or []
    if len(slots) != 3:
        return "any"

    def row_matches(ri: int) -> bool:
        row_id = (slots[ri].get("id") or "").strip()
        if not row_id:
            return knack_may_use_pending_hero_row(knack)
        kn_tok = knack_calling_tokens_for_row_match(knack, character)
        if kn_tok is None:
            return True
        row_tok = slot_row_calling_tokens(row_id, character)
        return any(t in row_tok for t in kn_tok)

    raw = knack_raw_calling_list(knack)
    kid = str(knack.get("id") or "")
    pant = knack.get("pantheonAnyOf") or []
    for ri in range(3):
        row_id = (slots[ri].get("id") or "").strip()
        if row_id and row_id in raw and row_matches(ri):
            return ri
    if kid.startswith("mythos_") and "mythos" in pant:
        for ri in range(3):
            row_id = (slots[ri].get("id") or "").strip()
            if row_id and is_inverted_twin(row_id) and row_matches(ri):
                return ri
    for ri in range(3):
        if (slots[ri].get("id") or "").strip() and row_matches(ri):
            return ri
    for ri in range(3):
        if not (slots[ri].get("id") or "").strip() and row_matches(ri):
            return ri
    return "any"


def hero_knack_chip_panel_bucket_keys(knack: dict, character: dict) -> list:
    """Mirror eligibility.js heroKnackChipPanelBucketKeys."""
    primary = hero_knack_chip_bucket_key(knack, character)
    keys = {primary}
    if primary == "any" or not is_mythos_for_character(character):
        return sorted(keys, key=lambda x: (1, x) if x == "any" else (0, x))
    slots = character.get("callingSlots") or []
    primary_row_id = (slots[primary].get("id") or "").strip()
    twin = mythos_twin(primary_row_id)
    if not twin:
        return list(keys)
    for ri in range(3):
        if ri == primary:
            continue
        row_id = (slots[ri].get("id") or "").strip()
        if row_id != twin:
            continue
        kn_tok = knack_calling_tokens_for_row_match(knack, character)
        if kn_tok is None:
            keys.add(ri)
            continue
        row_tok = slot_row_calling_tokens(row_id, character)
        if any(t in row_tok for t in kn_tok):
            keys.add(ri)
    return sorted(keys, key=lambda x: (1, x) if x == "any" else (0, x))


def test_motm_cosmos_row_shows_sage_pool_when_sage_on_another_row():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "hero",
        "pantheonId": "mythos",
        "callingId": "sage",
        "callingSlots": [
            {"id": "sage", "dots": 1},
            {"id": "", "dots": 1},
            {"id": "cosmos", "dots": 1},
        ],
        "knackIds": [],
    }
    blockade = knacks["sage_blockade_of_reason"]
    psychic = knacks["mythos_psychic_attack"]
    assert hero_knack_chip_panel_bucket_keys(blockade, character) == [0, 2]
    assert hero_knack_chip_panel_bucket_keys(psychic, character) == [0, 2]


def test_motm_cosmos_only_row_shows_twin_pool():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "hero",
        "pantheonId": "mythos",
        "callingId": "cosmos",
        "callingSlots": [
            {"id": "", "dots": 1},
            {"id": "", "dots": 1},
            {"id": "cosmos", "dots": 1},
        ],
        "knackIds": [],
    }
    blockade = knacks["sage_blockade_of_reason"]
    psychic = knacks["mythos_psychic_attack"]
    assert hero_knack_chip_panel_bucket_keys(blockade, character) == [2]
    assert hero_knack_chip_panel_bucket_keys(psychic, character) == [2]


def test_cosmos_motm_subpool_splits_sage_and_inverted():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "mortal",
        "callingId": "cosmos",
        "pantheonId": "mythos",
        "knackIds": [],
    }
    inverted = []
    standard = []
    for kid, row in knacks.items():
        if kid.startswith("_"):
            continue
        if not knack_eligible_mortal(row, character):
            continue
        if origin_calling_knack_chip_group_key(row, character) != "selected":
            continue
        sub = motm_inverted_knack_subpool_key(row, character, "cosmos", kid)
        if sub == "inverted":
            inverted.append(kid)
        elif sub == "standard-twin":
            standard.append(kid)
    assert "mythos_psychic_attack" in inverted
    assert len(standard) >= 7
    assert all(kid.startswith("sage_") for kid in standard)


def test_cosmos_calling_only_implies_mythos_for_sage_knacks():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "mortal",
        "callingId": "cosmos",
        "pantheonId": "",
        "parentDeityId": "",
        "knackIds": [],
    }
    assert is_mythos_for_character(character)
    assert knack_eligible_mortal(knacks["sage_blockade_of_reason"], character)
    assert knack_eligible_mortal(knacks["mythos_psychic_attack"], character)


def test_sage_origin_knack_eligible_for_cosmos_via_knack_side_twin_expand():
    """PB Sage Mortal rows list callings: [sage] only — Cosmos must match via MotM twin on the knack row."""
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "mortal",
        "callingId": "cosmos",
        "pantheonId": "mythos",
        "parentDeityId": "cthulhu",
        "knackIds": [],
    }
    sage_knack = knacks["sage_blockade_of_reason"]
    assert "cosmos" in expand_motm_knack_access(sage_knack, ["sage"], character)
    assert knack_eligible_mortal(sage_knack, character)


def is_hero_band_calling_tier_id(tier_id: str) -> bool:
    """Mirror eligibility.js isHeroBandCallingTierId."""
    t = (tier_id or "mortal").strip().lower()
    return t in ("hero", "titanic", "sorcerer_hero")


def hero_uses_calling_slot_rows(character: dict) -> bool:
    """Mirror eligibility.js heroUsesCallingSlotRows (deity + Titan line)."""
    tier = (character.get("tier") or "mortal").strip().lower()
    if is_hero_band_calling_tier_id(tier):
        return True
    return tier in ("demigod", "god", "sorcerer_demigod", "sorcerer_god")


def test_titanic_uses_calling_slot_rows():
    assert hero_uses_calling_slot_rows({"tier": "titanic", "patronKind": "titan", "callingSlots": None})


def test_demigod_and_god_always_use_calling_slot_rows():
    for tier in ("demigod", "god", "sorcerer_demigod", "sorcerer_god"):
        assert hero_uses_calling_slot_rows({"tier": tier, "callingSlots": None})


def test_demigod_cosmos_locked_psychic_attack_buckets_to_primary_row():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "demigod",
        "callingId": "cosmos",
        "parentDeityId": "cthulhu",
        "knackIds": ["mythos_psychic_attack"],
        "lockedKnackIds": ["mythos_psychic_attack"],
        "knackSlotById": {"mythos_psychic_attack": 0},
        "callingSlots": [
            {"id": "cosmos", "dots": 2},
            {"id": "liminal", "dots": 1},
            {"id": "monster", "dots": 1},
        ],
    }
    row = knacks["mythos_psychic_attack"]
    assert hero_uses_calling_slot_rows(character)
    assert motm_inverted_knack_subpool_key(row, character, "cosmos", "mythos_psychic_attack") == "inverted"
    assert hero_knack_chip_panel_bucket_keys(row, character) == [0]


def test_god_cosmos_locked_psychic_attack_buckets_to_primary_row():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "god",
        "callingId": "cosmos",
        "parentDeityId": "cthulhu",
        "knackIds": ["mythos_psychic_attack"],
        "lockedKnackIds": ["mythos_psychic_attack"],
        "knackSlotById": {"mythos_psychic_attack": 0},
        "callingSlots": [
            {"id": "cosmos", "dots": 3},
            {"id": "liminal", "dots": 2},
            {"id": "monster", "dots": 2},
        ],
    }
    row = knacks["mythos_psychic_attack"]
    assert hero_uses_calling_slot_rows(character)
    assert hero_knack_chip_panel_bucket_keys(row, character) == [0]


def test_hero_cosmos_locked_psychic_attack_classifies_inverted_pool():
    """Locked Origin Cosmos pick must land in the inverted (Cosmos) peer pool at Hero."""
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "hero",
        "callingId": "cosmos",
        "parentDeityId": "cthulhu",
        "pantheonId": "",
        "knackIds": ["mythos_psychic_attack"],
        "lockedKnackIds": ["mythos_psychic_attack"],
        "knackSlotById": {"mythos_psychic_attack": 0},
        "callingSlots": [
            {"id": "cosmos", "dots": 1},
            {"id": "", "dots": 1},
            {"id": "", "dots": 1},
        ],
    }
    row = knacks["mythos_psychic_attack"]
    assert is_mythos_for_character(character)
    assert motm_inverted_knack_subpool_key(row, character, "cosmos", "mythos_psychic_attack") == "inverted"
    assert hero_knack_chip_panel_bucket_keys(row, character) == [0]


def test_titanic_cosmos_locked_psychic_attack_buckets_to_primary_row():
    """Titan line hero-band: locked Origin Cosmos knack stays visible on row 0 at Titanic."""
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "titanic",
        "patronKind": "titan",
        "callingId": "cosmos",
        "parentDeityId": "cthulhu",
        "pantheonId": "",
        "knackIds": ["mythos_psychic_attack"],
        "lockedKnackIds": ["mythos_psychic_attack"],
        "knackSlotById": {"mythos_psychic_attack": 0},
        "callingSlots": [
            {"id": "cosmos", "dots": 1},
            {"id": "destroyer", "dots": 2},
            {"id": "monster", "dots": 2},
        ],
    }
    row = knacks["mythos_psychic_attack"]
    assert hero_uses_calling_slot_rows(character)
    assert motm_inverted_knack_subpool_key(row, character, "cosmos", "mythos_psychic_attack") == "inverted"
    assert hero_knack_chip_panel_bucket_keys(row, character) == [0]


def test_titan_line_demigod_destroyer_locked_mythos_knack_buckets_to_primary_row():
    """Titan welcome line at Demigod: locked inverted Destroyer knack stays on the primary row."""
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "demigod",
        "patronKind": "titan",
        "callingId": "destroyer",
        "parentDeityId": "titan_surtr",
        "pantheonId": "aesir",
        "knackIds": ["mythos_rust_and_decay"],
        "lockedKnackIds": ["mythos_rust_and_decay"],
        "knackSlotById": {"mythos_rust_and_decay": 0},
        "callingSlots": [
            {"id": "destroyer", "dots": 5},
            {"id": "warrior", "dots": 5},
            {"id": "tyrant", "dots": 5},
        ],
    }
    row = knacks["mythos_rust_and_decay"]
    assert hero_uses_calling_slot_rows(character)
    assert motm_inverted_knack_subpool_key(row, character, "destroyer", "mythos_rust_and_decay") == "inverted"
    assert hero_knack_chip_panel_bucket_keys(row, character) == [0]


def test_titan_line_god_cosmos_locked_psychic_attack_buckets_to_primary_row():
    """Titan line at God: same three-row locked MotM knack display as deity line."""
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "god",
        "patronKind": "titan",
        "callingId": "cosmos",
        "parentDeityId": "cthulhu",
        "knackIds": ["mythos_psychic_attack"],
        "lockedKnackIds": ["mythos_psychic_attack"],
        "knackSlotById": {"mythos_psychic_attack": 0},
        "callingSlots": [
            {"id": "cosmos", "dots": 5},
            {"id": "destroyer", "dots": 5},
            {"id": "monster", "dots": 5},
        ],
    }
    row = knacks["mythos_psychic_attack"]
    assert hero_uses_calling_slot_rows(character)
    assert hero_knack_chip_panel_bucket_keys(row, character) == [0]


def test_cthulhu_mortal_cosmos_knacks_without_explicit_pantheon():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "mortal",
        "callingId": "cosmos",
        "parentDeityId": "cthulhu",
        "pantheonId": "",
        "knackIds": [],
    }
    assert is_mythos_for_character(character)
    assert knack_eligible_mortal(knacks["mythos_psychic_attack"], character)
    assert knack_eligible_mortal(knacks["sage_blockade_of_reason"], character)
    assert origin_calling_knack_chip_group_key(knacks["sage_blockade_of_reason"], character) == "selected"
    assert origin_calling_knack_chip_group_key(knacks["mythos_psychic_attack"], character) == "selected"


def test_cthulhu_mortal_liminal_knacks_without_explicit_pantheon():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    character = {
        "tier": "mortal",
        "callingId": "liminal",
        "parentDeityId": "cthulhu",
        "pantheonId": "",
        "knackIds": [],
    }
    assert knack_eligible_mortal(knacks["mythos_the_gate_and_key"], character)
    assert knack_eligible_mortal(knacks["liminal_beyond_memory"], character)


def test_cthulhu_patron_callings_do_not_add_sage():
    pantheons = json.loads((ROOT / "src/data/pantheons.json").read_text(encoding="utf-8"))
    cthulhu = next(d for d in pantheons["mythos"]["deities"] if d["id"] == "cthulhu")
    assert "cosmos" in cthulhu["callings"]
    assert "sage" not in cthulhu["callings"]
    seen: set[str] = set()
    mapped: list[str] = []
    for cid in cthulhu["callings"]:
        inverted = mythos_twin(cid) if is_standard_twin(cid) else cid
        if inverted and inverted not in seen:
            seen.add(inverted)
            mapped.append(inverted)
        if cid not in seen:
            seen.add(cid)
            mapped.append(cid)
    assert "cosmos" in mapped
    assert "sage" not in mapped


def test_knacks_json_uses_tier_not_tier_min():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    sample = 0
    for kid, row in knacks.items():
        if kid.startswith("_"):
            continue
        assert "tier" in row, kid
        assert row["tier"] in ("heroic", "immortal"), kid
        assert "callingSlotCost" in row, kid
        assert row["callingSlotCost"] in (1, 2), kid
        assert "tierMin" not in row, kid
        assert "knackKind" not in row, kid
        sample += 1
        if sample >= 20:
            break
