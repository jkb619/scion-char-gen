"""Random Mortal Sorcerer finishing / paraphernalia autogen."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SORCERER = ROOT / "src" / "static" / "js" / "randomSorcererChargen.js"
RANDOM = ROOT / "src" / "static" / "js" / "randomCharacterGenerator.js"


def test_sorcerer_random_module_covers_finishing_packages():
    js = SORCERER.read_text(encoding="utf-8")
    assert "assignSorcererMortalChargen" in js
    assert "assignSorcererHeroicChargen" in js
    assert "assignSorcererChargen" in js
    assert "four_paraphernalia" in js
    assert "two_techniques" in js
    assert "one_technique_two_paraphernalia" in js
    assert "pickBirthrightIdsForPointBudget" in js
    assert "workingIds" in js
    assert "sorcererMortalChargenComplete" in js
    assert "sorcererHeroicChargenComplete" in js
    assert "sorcerer_demigod" in js
    assert "primaryPowerSource" in js
    assert "assignSorcererLegendBoons" in js


def test_random_chargen_exports_specialties_helper():
    js = RANDOM.read_text(encoding="utf-8")
    assert "export function assignChargenSpecialties" in js


def test_random_chargen_wires_sorcerer_finishing():
    js = RANDOM.read_text(encoding="utf-8")
    assert "assignSorcererChargen" in js
