"""Dominion Stunts on Review JSON and sheet."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "static" / "js" / "app.js"
EXPORT = ROOT / "src" / "static" / "js" / "dominionStuntsExport.js"
LAYOUT = ROOT / "src" / "static" / "js" / "characterSheetMcgLayout.js"
DOMINION = ROOT / "src" / "data" / "dominionStunts.json"


def test_export_module_and_build_export_object_include_dominion_stunts():
    export_js = EXPORT.read_text(encoding="utf-8")
    app = APP.read_text(encoding="utf-8")
    assert "export function buildDominionStuntExportPayload" in export_js
    assert "export function buildDominionStuntExportFromCharacter" in export_js
    assert "dominionStunts: snap.flat" in app
    assert "dominionStuntGroups: snap.groups" in app


def test_review_sheet_renders_dominion_stunts_section():
    layout = LAYOUT.read_text(encoding="utf-8")
    assert 'mcgSectionTitle("Dominion Stunts")' in layout
    assert "buildDominionStuntExportPayload(data, bundle)" in layout
    assert "cs-mcg-dominion-stunt-block" in layout


def test_dominion_stunt_payload_requires_dominion_boon_mark():
    """No Dominion Stunt rows until dominionBoonPurviewIds is non-empty; then only marked held Purviews."""
    export_js = EXPORT.read_text(encoding="utf-8")
    assert "if (dominionMarked.size === 0) return []" in export_js
    assert 'return ["_general", ...markedHeld]' in export_js
    stunts = json.loads(DOMINION.read_text(encoding="utf-8"))
    assert "general_dominion_gift_of_power" in stunts
    death = [k for k, v in stunts.items() if not k.startswith("_") and v.get("purview") == "death"]
    assert len(death) >= 1
