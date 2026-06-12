"""Experience attribute/skill bump tracking (post-chargen advancement)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPERIENCE_JS = ROOT / "src" / "static" / "js" / "experience.js"
APP_JS = ROOT / "src" / "static" / "js" / "app.js"


def test_experience_js_exports_bump_helpers():
    text = EXPERIENCE_JS.read_text(encoding="utf-8")
    for name in (
        "ensureExperienceAdvancementBumps",
        "experienceAttributeBumpCount",
        "experienceSkillBumpCount",
        "recordExperienceAttributeBump",
        "recordExperienceSkillBump",
        "experienceAttributeBumpsTotal",
    ):
        assert f"export function {name}" in text


def test_app_js_excludes_xp_from_chargen_validation():
    text = APP_JS.read_text(encoding="utf-8")
    assert "experienceAttributeBumps" in text
    assert "experienceSkillBumps" in text
    assert "chargenOnlyAttributeBump" in text
    assert "experienceArenaExtraDelta" in text
    assert "chargenOnlySkillDots" in text
    assert "recordExperienceAttributeBump(character, attrMeta.id)" in text
    assert "recordExperienceSkillBump(character, sid)" in text


def test_default_character_shape_includes_bump_maps():
    text = APP_JS.read_text(encoding="utf-8")
    assert "experienceAttributeBumps: {}" in text
    assert "experienceSkillBumps: {}" in text


def test_export_includes_bump_maps():
    text = APP_JS.read_text(encoding="utf-8")
    assert "experienceAttributeBumps: { ...(character.experienceAttributeBumps || {}) }" in text
    assert "experienceSkillBumps: { ...(character.experienceSkillBumps || {}) }" in text


def test_calling_knack_panel_includes_held_knacks():
    text = APP_JS.read_text(encoding="utf-8")
    assert "function callingKnackPanelEntryList" in text
    assert "function ensureHeldKnacksInCallingRowList" in text
    assert "function appendCallingRowKnackPoolChips" in text
    assert "function useCallingKnackThreeRowBuckets" in text
    assert "reconcileLockedKnackIds(character, bundle)" in text
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    assert "if (isPostHeroBandCallingTierId(t)) return true" in elig


def test_exp_knacks_exclude_prior_chargen_picks():
    text = APP_JS.read_text(encoding="utf-8")
    assert "function knackOwnedFromPriorChargen" in text
    assert "if (knackOwnedFromPriorChargen(kid)) return false" in text
    assert "healSpuriousExperienceKnackIds" in text
    assert "if (!id || knackOwnedFromPriorChargen(id)) return false" in text
