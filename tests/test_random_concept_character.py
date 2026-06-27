"""Concept-from-prompt client wiring and validation module."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONCEPT = ROOT / "src" / "static" / "js" / "randomConceptCharacter.js"
APP = ROOT / "src" / "static" / "js" / "app.js"
PROGRESS = ROOT / "src" / "static" / "js" / "conceptGenProgress.js"


def test_concept_finalize_module_exports():
    js = CONCEPT.read_text(encoding="utf-8")
    assert "export function finalizeConceptCharacterFromSkeleton" in js
    assert "export function repairConceptMechanicalsFromSkeleton" in js
    assert "assignSorcererChargen" in js
    assert "assignCallingAndKnacks" in js
    assert "clearGenericSkillSpecialtyPlaceholders" in js
    assert "isGenericSkillSpecialtyLabel" in js
    assert "buildValidKnackList" in js


def test_app_wires_concept_finalize():
    js = APP.read_text(encoding="utf-8")
    assert "finalizeConceptCharacterFromSkeleton" in js
    assert "randomConceptCharacter.js" in js
    assert "repairConceptMechanicalsFromSkeleton" in js
    assert "runAutoCharacterFlavor" in js


def test_app_wires_concept_progress():
    js = APP.read_text(encoding="utf-8")
    assert "conceptGenProgress.js" in js
    assert "mountConceptGenProgress" in js
    assert "welcomeConceptProgress" in js


def test_concept_progress_module():
    js = PROGRESS.read_text(encoding="utf-8")
    assert "export function mountConceptGenProgress" in js
    assert "startCreep" in js
