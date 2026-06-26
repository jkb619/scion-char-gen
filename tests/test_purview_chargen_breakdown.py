"""Innate vs extra vs Dominion Purview breakdown on export / review."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "static" / "js" / "app.js"
PV = ROOT / "src" / "static" / "js" / "purviewDisplayName.js"
LAYOUT = ROOT / "src" / "static" / "js" / "characterSheetMcgLayout.js"


def test_purview_chargen_breakdown_module():
    js = PV.read_text(encoding="utf-8")
    assert "export function purviewChargenBreakdown" in js
    assert "export function purviewTrackingRoleLabel" in js
    assert "Dominion Boons (dominionBoonPurviewIds) are not innate Purviews" in js


def test_export_includes_purview_chargen_breakdown():
    app = APP.read_text(encoding="utf-8")
    assert "purviewChargenBreakdown:" in app
    assert "patron slots filled" in app


def test_review_sheet_labels_innate_and_dominion_separately():
    layout = LAYOUT.read_text(encoding="utf-8")
    assert "purviewChargenBreakdown(data, bundle)" in layout
    assert 'mcgLinedField("Tracked as"' in layout
    assert "Dominion Boons are not innate Purviews" in layout
    assert "if (dominionMarked.has(pid))" in layout
