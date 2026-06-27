"""Dragon Heir JSON export uses Inheritance track, not Mortal tier."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "static" / "js" / "app.js"
DRAGON = ROOT / "src" / "static" / "js" / "chargen" / "DragonChargenWizard.js"


def test_dragon_export_tier_presentation_helper():
    js = DRAGON.read_text(encoding="utf-8")
    assert "export function dragonExportTierPresentation" in js
    fn = js.split("export function dragonExportTierPresentation")[1].split("export function buildDragonReviewSnapshot")[0]
    assert 'tier: "dragonHeir"' in fn
    assert "inheritance_" in fn
    assert "wizardSpineTier" in fn
    assert "Mortal/Origin" not in fn


def test_build_export_object_uses_track_tier_presentation():
    block = APP.read_text(encoding="utf-8").split("function buildExportObject()")[1].split("function saveCharacterProgressFromReview")[0]
    assert "trackTierPresentation(character, bundle)" in block
    dragon_branch = block.split("isDragonHeirChargen(character)")[1].split("const p = selectedPantheon")[0]
    assert "tierMeta?.name" not in dragon_branch


def test_import_recognizes_dragonheir_tier():
    block = APP.read_text(encoding="utf-8").split("function importCharacterFromExportPayload")[1].split("function pruneStaleKnackIds")[0]
    assert 'normalizedTierId(data.tier) === "dragonheir"' in block
    assert "inheritance_" in block and "\\d" in block
