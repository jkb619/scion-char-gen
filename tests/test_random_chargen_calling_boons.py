"""Random chargen: Demigod Calling dots and Legend boon budget wiring."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RANDOM = ROOT / "src" / "static" / "js" / "randomCharacterGenerator.js"
UTILS = ROOT / "src" / "static" / "js" / "randomChargenUtils.js"


def test_random_chargen_no_fifteen_dot_demigod_pattern():
    js = RANDOM.read_text(encoding="utf-8")
    assert "[5, 5, 5]" not in js
    assert "HERO_CREATION_CALLING_DOTS + legendTraitCallingDotsFromRating" in js


def test_legend_rolled_before_calling_and_boons():
    js = RANDOM.read_text(encoding="utf-8")
    legend_idx = js.index("character.legendRating = rollLegendRatingForTier(character.tier, bundle, rng);")
    calling_idx = js.index("assignCallingAndKnacks(character, bundle, rng);")
    boons_idx = js.index("assignPurviewsBirthrightsBoons(character, bundle, rng);")
    assert legend_idx < calling_idx < boons_idx


def test_distribute_three_row_calling_dots_helper():
    utils = UTILS.read_text(encoding="utf-8")
    assert "export function distributeThreeRowCallingDots" in utils
    assert "export const HERO_CREATION_CALLING_DOTS = 5" in utils
