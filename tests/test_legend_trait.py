"""Legend trait effects and Max Legend on export / review sheet."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "static" / "js" / "app.js"
LEGEND = ROOT / "src" / "static" / "js" / "legendTrait.js"
LAYOUT = ROOT / "src" / "static" / "js" / "characterSheetMcgLayout.js"


def test_legend_trait_module_demigod_caps_and_effects():
    js = LEGEND.read_text(encoding="utf-8")
    assert "demigod: 8" in js
    assert "god: 12" in js
    assert "export function legendTraitBoonPurchasesFromRating" in js
    assert "Math.floor(n / 2)" in js
    assert "dominionBoonPurviewBoonsForgone" in js


def test_export_includes_max_legend_and_trait_effects():
    app = APP.read_text(encoding="utf-8")
    assert "maxLegend: legendDotMaxForTier(character.tier)" in app
    assert "legendTraitEffects: legendTraitEffectsSummary" in app
    assert "dominionBoonLedger: dominionBoonLedgerSummary" in app


def test_review_sheet_shows_max_legend_and_trait_fields():
    layout = LAYOUT.read_text(encoding="utf-8")
    assert 'mcgLinedField("Max Legend"' in layout
    assert 'mcgLinedField("Boon purchases"' in layout
    assert 'mcgLinedField("Calling dots (even Legend)"' in layout
