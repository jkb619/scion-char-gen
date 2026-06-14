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
        "sheetExperienceSpentOnLines",
    ):
        assert f"export function {name}" in text
    assert "experiencePurchaseLog.push" in text


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
    assert "experiencePurchaseLog: []" in text


def test_export_includes_bump_maps():
    text = APP_JS.read_text(encoding="utf-8")
    assert "experienceAttributeBumps: { ...(character.experienceAttributeBumps || {}) }" in text
    assert "experienceSkillBumps: { ...(character.experienceSkillBumps || {}) }" in text
    assert "experiencePurchaseLog: [...(character.experiencePurchaseLog || [])]" in text


def test_review_sheet_spent_on_uses_purchase_log():
    mcg = (ROOT / "src" / "static" / "js" / "characterSheetMcgLayout.js").read_text(encoding="utf-8")
    dragon = (ROOT / "src" / "static" / "js" / "characterSheetDragonLayout.js").read_text(encoding="utf-8")
    for text in (mcg, dragon):
        assert "sheetExperienceSpentOnLines(data, bundle)" in text
        assert 'sl.textContent = "Spent on"' in text


def test_calling_knack_panel_includes_held_knacks():
    text = APP_JS.read_text(encoding="utf-8")
    assert "function callingKnackPanelEntryList" in text
    assert "function ensureHeldKnacksInCallingRowList" in text
    assert "function appendCallingRowKnackPoolChips" in text
    assert "function useCallingKnackThreeRowBuckets" in text
    assert "reconcileLockedKnackIds(character, bundle)" in text
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    assert "if (isPostHeroBandCallingTierId(t)) return true" in elig


def test_apply_path_math_preserves_xp_skill_dots_without_baseline():
    """Hero+ tiers null skillBaseline; nav attention must not wipe XP skill purchases."""
    text = APP_JS.read_text(encoding="utf-8")
    start = text.index("function applyPathMathToSkillDots()")
    block = text[start : start + 2200]
    assert "experienceSkillBumpCount(character, sid)" in block
    assert "abovePath" in block
    assert "po + abovePath" in block
    assert "chargenBump + xp" in block
    # Old bug: else branch assigned pathOnly only and dropped XP bumps.
    assert "character.skillDots[sid] = pathOnly[sid] ?? 0" not in block


def test_tier_advance_carries_experience_knacks_and_attr_display():
    text = APP_JS.read_text(encoding="utf-8")
    start = text.index("function applyTierAdvancementFromBundle()")
    block = text[start : start + 3200]
    assert "character.experienceKnackIds" in block
    assert "captureAttrBaselineAfterTierAdvanceExcludingXp()" in block
    assert "settleUnassignedHeldKnackSlots(character, bundle)" in block
    assert "repairUnmappedHeroKnackSlots(character, bundle)" in block
    assert "lockKnacksAtTierAdvance(character)" in block
    lock_idx = block.index("lockKnacksAtTierAdvance(character)")
    ensure_idx = block.index("ensureHeroKnackSlotAssignments(character, bundle)")
    assert lock_idx < ensure_idx
    assert "function attributesDisplayPreFavoredForAttributesTab()" in text
    assert "attributesDisplayPreFavoredForAttributesTab()" in text
    disp = text.split("function attributesDisplayPreFavoredForAttributesTab()")[1][:500]
    assert "!isOriginPlayTier(character.tier)" in disp
    assert "character.attributes[id]" in disp
    lock_fn = text.split("function postOriginMortalChargenLocked(character)")[1][:500]
    assert "tierAdvancementLog" in lock_fn
    assert "!attrLocked && isOriginPlayTier(character.tier)) normalizeCharacterAttributesToPools()" in text
    assert "if (attrLocked) maxFinal = Math.max(maxFinal, finalVal)" in text
    assert "experienceArenaExtraDelta(arena)" in text.split("function maxAttrRatingForArena(attrId, attrs)")[1][:600]


def test_exp_knacks_exclude_prior_chargen_picks():
    text = APP_JS.read_text(encoding="utf-8")
    elig = (ROOT / "src" / "static" / "js" / "eligibility.js").read_text(encoding="utf-8")
    assert "function knackOwnedFromPriorChargen" in text
    assert "knackOwnedFromPriorChargenPick(character, kid)" in text
    assert "if (knackOwnedFromPriorChargen(kid)) return false" in text
    assert "healSpuriousExperienceKnackIds" in text
    assert "if (!id || knackOwnedFromPriorChargen(id)) return false" in text
    assert "settleExperienceKnacksAfterTierAdvance(character, carriedKnackIds)" in text
    assert "settleLockedExperienceKnacks(character)" in text
    assert "export function settleExperienceKnacksAfterTierAdvance" in elig
    assert "carriedExperienceKnackIds" in elig
    assert "export function carriedExperienceKnackIdSet" in elig
    assert "export function settleLockedExperienceKnacks" in elig
    assert "export function knackOwnedFromPriorChargenPick" in elig
    idx = elig.index("export function knackOwnedFromPriorChargenPick")
    block = elig[idx : idx + 700]
    assert "isKnackLocked(character, id)" in block
