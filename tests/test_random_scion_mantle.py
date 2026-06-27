"""Random Scion mantle extras (Legendary Titles, Omen, Titanic profile)."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANTLE = ROOT / "src" / "static" / "js" / "randomScionMantleExtras.js"
RANDOM = ROOT / "src" / "static" / "js" / "randomCharacterGenerator.js"
APP = ROOT / "src" / "static" / "js" / "app.js"
SHEET = ROOT / "src" / "static" / "js" / "characterSheetMcgLayout.js"


def test_mantle_module_exports_assign_helpers():
    js = MANTLE.read_text(encoding="utf-8")
    assert "export function assignLegendaryTitlesAndOmen" in js
    assert "export function assignDemigodBirthrightPickNotes" in js
    assert "export function assignTitanicProfileFallback" in js
    assert "export function assignScionMantleExtras" in js
    assert "Divine Fortitude" in js


def test_random_chargen_calls_mantle_extras():
    js = RANDOM.read_text(encoding="utf-8")
    assert "assignScionMantleExtras" in js


def test_app_exports_mantle_fields():
    js = APP.read_text(encoding="utf-8")
    assert "legendaryTitles:" in js
    assert "birthrightPickNotes" in js
    assert "appendReviewMantleFields" in js


def test_sheet_renders_legendary_titles_and_omen():
    js = SHEET.read_text(encoding="utf-8")
    assert "data.legendaryTitles" in js
    assert "data.omen" in js
