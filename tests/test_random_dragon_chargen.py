"""Random Dragon Heir chargen completeness (spells, birthrights, knacks)."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DRAGON_RANDOM = ROOT / "src" / "static" / "js" / "randomDragonCharacter.js"


def test_random_dragon_fills_magic_spells_and_birthrights():
    js = DRAGON_RANDOM.read_text(encoding="utf-8")
    assert "assignDragonMagicAndSpells" in js
    assert "spellsByMagicId" in js
    assert "advancementSpells" in js
    assert "bonusSpell" in js
    assert "assignDragonBirthrights" in js
    assert "spent === target" in js or "spent === target" in js.replace(" ", "")
    assert "knackEligibleForCallingStep" in js
    assert "seedHeroKnackRowAssignments" in js
    assert "assignDragonDeedName" in js
    assert "dragonBirthrightCatalogIds" in js


def test_random_dragon_birthright_budget_is_seven_not_four():
    js = DRAGON_RANDOM.read_text(encoding="utf-8")
    assert "const target = 7" in js
    assert "spent + cost > 4" not in js
