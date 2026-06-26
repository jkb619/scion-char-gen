"""Tier XP budget bands (mirrors tierExperienceBudget.js)."""

from __future__ import annotations

import pytest

TIER_XP_BANDS = {
    "mortal": (0, 25),
    "hero": (40, 150),
    "demigod": (50, 200),
    "god": (40, 200),
}


def roll_tier_experience_pool(tier_id: str, rng_value: float) -> int:
    lo, hi = TIER_XP_BANDS.get(tier_id, (0, 25))
    span = hi - lo
    bias = 0.35 + rng_value * 0.3
    return max(0, round(lo + span * bias))


@pytest.mark.parametrize(
    "tier, rng, expected",
    [
        ("mortal", 0.0, 9),
        ("hero", 0.5, 95),
        ("demigod", 1.0, 148),
    ],
)
def test_roll_tier_experience_pool(tier: str, rng: float, expected: int) -> None:
    assert roll_tier_experience_pool(tier, rng) == expected


def test_parse_legend_range() -> None:
    from re import match

    def parse(range_text: str) -> tuple[int, int]:
        m = match(r"(\d+)\s*[–-]\s*(\d+)", range_text.strip())
        if not m:
            return 0, 1
        lo, hi = int(m.group(1)), int(m.group(2))
        return lo, max(lo, hi)

    assert parse("2–4") == (2, 4)
    assert parse("8-10+") == (8, 10)
