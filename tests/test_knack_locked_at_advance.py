"""Knacks lock at tier advance (mirrors src/static/js/eligibility.js)."""

from __future__ import annotations


def knack_locked_id_set(character: dict) -> set[str]:
    raw = character.get("lockedKnackIds")
    if not isinstance(raw, list):
        return set()
    return {x for x in raw if isinstance(x, str) and x.strip() and not x.startswith("_")}


def is_knack_locked(character: dict, knack_id: str) -> bool:
    kid = str(knack_id or "").strip()
    return bool(kid and kid in knack_locked_id_set(character))


def lock_knacks_at_tier_advance(character: dict) -> None:
    locked = knack_locked_id_set(character)
    for kid in character.get("knackIds") or []:
        if isinstance(kid, str) and kid.strip():
            locked.add(kid)
    fin = (character.get("finishing") or {}).get("finishingKnackIds")
    if isinstance(fin, list):
        for kid in fin:
            if isinstance(kid, str) and kid.strip() and not kid.startswith("_"):
                locked.add(kid)
    character["lockedKnackIds"] = sorted(locked)


def test_lock_on_advance_includes_main_and_finishing():
    character = {
        "knackIds": ["sage_blockade_of_reason"],
        "finishing": {"finishingKnackIds": ["auraOfGreatness", "anotherKnack"]},
        "lockedKnackIds": [],
    }
    lock_knacks_at_tier_advance(character)
    assert is_knack_locked(character, "sage_blockade_of_reason")
    assert is_knack_locked(character, "auraOfGreatness")
    assert is_knack_locked(character, "anotherKnack")


def test_lock_is_cumulative_across_advances():
    character = {
        "knackIds": ["a", "b"],
        "finishing": {"finishingKnackIds": []},
        "lockedKnackIds": ["a"],
    }
    lock_knacks_at_tier_advance(character)
    assert is_knack_locked(character, "a")
    assert is_knack_locked(character, "b")
