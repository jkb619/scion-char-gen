"""Dominion Stunts catalog from Scion: Demigod."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data" / "dominionStunts.json"


def _load() -> dict:
    return json.loads(DATA.read_text(encoding="utf-8"))


def test_dominion_stunts_entry_count():
    data = _load()
    entries = [k for k in data if not k.startswith("_")]
    assert data["_meta"]["entryCount"] == len(entries)
    assert len(entries) == 93


def test_death_dominion_stunts_present():
    data = _load()
    death = [v for v in data.values() if isinstance(v, dict) and v.get("purview") == "death"]
    names = {v["name"] for v in death}
    assert names == {
        "Bring Them All Back to Life",
        "Chains of Damnation",
        "Enervating Aura",
        "The Reaper Smiles",
    }


def test_general_gift_of_power():
    data = _load()
    general = [
        v
        for k, v in data.items()
        if not k.startswith("_") and isinstance(v, dict) and v.get("purview") is None
    ]
    assert len(general) == 1
    assert general[0]["name"] == "Gift of Power"
