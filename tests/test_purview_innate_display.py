"""Purview innate preview copy (wizard / sheet)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PURVIEWS = ROOT / "src" / "data" / "purviews.json"
INNATE_JS = ROOT / "src" / "static" / "js" / "purviewInnate.js"

LADDER = "Standard Purview ladder (up to 12 Boons) per tier and Legend."


def test_purview_innate_text_skips_ladder_placeholder_fallback():
    js = INNATE_JS.read_text(encoding="utf-8")
    assert "PURVIEW_LADDER_PLACEHOLDER" in js
    assert 'mech !== PURVIEW_LADDER_PLACEHOLDER' in js


def test_epic_perception_has_innate_summary_not_ladder_only():
    purviews = json.loads(PURVIEWS.read_text(encoding="utf-8"))
    ep = purviews["epicPerception"]
    summary = ep.get("purviewInnateSummary", "")
    assert summary
    assert "mundane attempts at surprise" in summary
    assert LADDER not in summary


def test_epic_strength_has_hero_innate_summary():
    purviews = json.loads(PURVIEWS.read_text(encoding="utf-8"))
    summary = purviews["epicStrength"].get("purviewInnateSummary", "")
    assert "+1 Scale" in summary
    assert "Might in place of Presence" in summary
    assert LADDER not in summary


def test_purview_innate_awareness_only_on_parent_list():
    app = (ROOT / "src" / "static" / "js" / "app.js").read_text(encoding="utf-8")
    fn = app.split("function appendPurviewInnateDetails(container, purviewId)")[1].split("/** Line shown for each divine parent")[0]
    assert "patronPurviewOptionIds().includes(pid)" in fn
    assert "mythosPantheon: mythos && onParentList" in fn


def test_epic_charisma_has_innate_summary():
    purviews = json.loads(PURVIEWS.read_text(encoding="utf-8"))
    summary = purviews["epicCharisma"].get("purviewInnateSummary", "")
    assert "Consolation" in summary
    assert "Presence or Manipulation" in summary
