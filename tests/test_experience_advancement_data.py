"""Experience advancement costs (Origin p. 113)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data" / "experienceAdvancement.json"


def test_origin_core_costs():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    costs = data["costs"]
    assert costs["skill"]["cost"] == 5
    assert costs["attribute"]["cost"] == 10
    assert costs["knack"]["cost"] == 10
    assert costs["specialty"]["cost"] == 3
    assert costs["birthright"]["cost"] == 5
    assert costs["favoredApproach"]["cost"] == 15
