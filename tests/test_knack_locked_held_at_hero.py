"""Locked Origin knacks survive Hero-tier prune (mirrors eligibility.js)."""

from __future__ import annotations


def knack_locked_ids(character: dict) -> set[str]:
    raw = character.get("lockedKnackIds")
    if not isinstance(raw, list):
        return set()
    return {x for x in raw if isinstance(x, str) and x.strip()}


def should_keep_knack(kid: str, character: dict, eligible_at_hero: bool) -> bool:
    if kid in knack_locked_ids(character):
        return True
    return eligible_at_hero


def test_locked_mortal_knack_not_pruned_at_hero():
    character = {
        "tier": "hero",
        "knackIds": ["some_mortal_knack"],
        "lockedKnackIds": ["some_mortal_knack"],
    }
    assert should_keep_knack("some_mortal_knack", character, eligible_at_hero=False)


def test_unlocked_ineligible_pruned():
    character = {"tier": "hero", "knackIds": ["some_mortal_knack"], "lockedKnackIds": []}
    assert not should_keep_knack("some_mortal_knack", character, eligible_at_hero=False)
