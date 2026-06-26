"""Mythos Cthulhu patron Purview list (MotM) and patron dropdown wiring."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PANTHEONS = ROOT / "src" / "data" / "pantheons.json"
APP = ROOT / "src" / "static" / "js" / "app.js"

CTHULHU_PURVIEWS = {
    "darkness",
    "death",
    "epicStamina",
    "epicStrength",
    "health",
    "water",
}


def test_cthulhu_patron_purviews_in_pantheons_json():
    data = json.loads(PANTHEONS.read_text(encoding="utf-8"))
    mythos = data["mythos"]
    cthulhu = next(d for d in mythos["deities"] if d["id"] == "cthulhu")
    got = set(cthulhu["purviews"])
    assert got == CTHULHU_PURVIEWS
    assert "chaos" not in got
    assert "epicPerception" not in got


def test_patron_pulldowns_use_parent_list_only():
    app = APP.read_text(encoding="utf-8")
    panel = app.split("function renderPatronPurviewPanel(mount)")[1].split("function arenaPools")[0]
    assert "prunePatronPurviewSlotsToParentList" in panel
    assert "for (const pid of parentOpts)" in panel
    assert "for (const pid of opts)" not in panel


def test_prune_patron_slots_to_parent_list_helper():
    app = APP.read_text(encoding="utf-8")
    assert "function prunePatronPurviewSlotsToParentList()" in app
    assert "const allowed = new Set(patronPurviewOptionIds())" in app
