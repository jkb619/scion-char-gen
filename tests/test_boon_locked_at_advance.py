"""Boons locked at tier advance — Hero picks survive Demigod Legend budget heal."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "static" / "js" / "app.js"
BUDGET = ROOT / "src" / "static" / "js" / "boonBudget.js"


def test_boon_lock_helpers_exported():
    js = BUDGET.read_text(encoding="utf-8")
    assert "export function boonLockedIdSet" in js
    assert "export function isBoonLocked" in js
    assert "export function boonCountsAgainstLegendBudget" in js
    assert "export function lockBoonsAtTierAdvance" in js


def test_tier_advance_locks_boons():
    app = APP.read_text(encoding="utf-8")
    advance = app.split("function applyTierAdvancementFromBundle()")[1].split("function renderAppMainTabs")[0]
    assert "carriedBoonIds" in advance
    assert "lockBoonsAtTierAdvance(character)" in advance
    assert "lockedBoonIds" in advance


def test_prune_stale_boons_respects_locked():
    app = APP.read_text(encoding="utf-8")
    prune = app.split("function pruneStaleBoonIds()")[1].split("function finishingBirthrightPointsUsed")[0]
    assert "isBoonLocked(character, id)" in prune
    assert "boonCountsAgainstLegendBudget(character, id)" in prune


def test_render_boons_locked_chip():
    app = APP.read_text(encoding="utf-8")
    render = app.split("function renderBoons(root)")[1].split("function renderDominionBoons")[0]
    assert "isBoonLocked(character, bid)" in render
    assert "chip-knack-locked" in render


def test_heal_locked_boons_from_tier_log():
    app = APP.read_text(encoding="utf-8")
    assert "function healLockedBoonIdsFromTierAdvancement" in app
    assert "function reconcileLockedBoonIds" in app
    heal = app.split("function normalizeCharacterStateAfterLoad()")[1].split("function persistPathsPhrasesFromDom")[0]
    assert "healLockedBoonIdsFromTierAdvancement()" in heal


def test_hero_death_boons_not_legend_budget_exempt_until_locked():
    """Mirrors boonCountsAgainstLegendBudget — unlocked Hero picks count at Demigod."""
    budget = BUDGET.read_text(encoding="utf-8")
    assert "if (isBoonLocked(character, id)) return false" in budget


def test_demigod_prune_keeps_locked_death_boons():
    """Simulate prune: locked Hero Boons stay when Legend budget is 0."""
    knacks_path = ROOT / "src/data/knacks.json"
    _ = knacks_path  # anchor data dir
    boons_path = ROOT / "src/data/boons.json"
    assert boons_path.is_file()
    boons = json.loads(boons_path.read_text(encoding="utf-8"))
    assert "death_dot_01" in boons
    assert "death_dot_02" in boons
    character = {
        "tier": "demigod",
        "legendRating": 0,
        "boonIds": ["death_dot_01", "death_dot_02"],
        "lockedBoonIds": ["death_dot_01", "death_dot_02"],
        "experienceBoonIds": [],
    }

    def counts_against(char: dict, bid: str) -> bool:
        if bid in set(char.get("experienceBoonIds") or []):
            return False
        if bid in set(char.get("lockedBoonIds") or []):
            return False
        return True

    def slots_used(char: dict) -> int:
        return sum(1 for bid in char.get("boonIds") or [] if counts_against(char, bid))

    ids = list(character["boonIds"])
    total = max(0, round(int(character.get("legendRating") or 0)))
    while ids and any(counts_against(character, i) for i in ids) and slots_used({**character, "boonIds": ids}) > total:
        removed = False
        for i in range(len(ids) - 1, -1, -1):
            bid = ids[i]
            if bid in set(character.get("lockedBoonIds") or []):
                continue
            if counts_against(character, bid):
                ids.pop(i)
                removed = True
                break
        if not removed:
            break
    assert ids == ["death_dot_01", "death_dot_02"]
