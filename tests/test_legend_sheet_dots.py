"""Legend / Awareness rating fills dots on the Review character sheet."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POOLS = ROOT / "src" / "static" / "js" / "characterSheetLegendPools.js"
MCG = ROOT / "src" / "static" / "js" / "characterSheetMcgLayout.js"


def test_legend_pools_fill_rating_on_dots():
    js = POOLS.read_text(encoding="utf-8")
    assert "void filled" not in js
    assert "i <= rating ? \" on\"" in js
    assert "onAwarenessDotClick" in js


def test_mcg_layout_passes_legend_rating_to_dots():
    js = MCG.read_text(encoding="utf-8")
    assert "appendLegendAwarenessDotsWithPools(legDotsCell, lv, legendMax" in js


def test_review_sheet_hooks_sync_awareness_dots():
    app = (ROOT / "src" / "static" / "js" / "app.js").read_text(encoding="utf-8")
    assert "onAwarenessDotClick:" in app
    assert "onLegendDotClick:" in app
