"""Shared line + tier presentation for header, Welcome, and JSON export."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "static" / "js" / "app.js"


def test_track_tier_presentation_covers_all_lines():
    fn = APP.read_text(encoding="utf-8").split("function trackTierPresentation")[1].split("function updateHeaderTierDisplay")[0]
    assert 'welcomeLine: "dragon"' in fn or "dragonExportTierPresentation" in fn
    assert "Sorcerer" in fn
    assert "Titan" in fn
    assert "Deity" in fn
    assert "trackTierLabel" in fn
    assert "typicalLegendRange" in fn


def test_header_and_export_share_track_tier_presentation():
    app = APP.read_text(encoding="utf-8")
    header = app.split("function updateHeaderTierDisplay")[1].split("function scrollWizardStepIntoView")[0]
    assert "trackTierPresentation(character, bundle).trackTierLabel" in header
    export = app.split("function buildExportObject()")[1].split("function saveCharacterProgressFromReview")[0]
    assert "trackTierPresentation(character, bundle)" in export
