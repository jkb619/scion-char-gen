"""Welcome step: Dragon line shows Inheritance, not Typical Legend."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "static" / "js" / "app.js"


def test_scion_export_uses_line_tier_presentation():
    app = APP.read_text(encoding="utf-8")
    assert "function trackTierPresentation" in app
    fn = app.split("function trackTierPresentation")[1].split("function updateHeaderTierDisplay")[0]
    assert "Deity-" in fn or "linePrefix" in fn
    assert "Sorcerer" in fn
    assert "Titan" in fn
    block = app.split("function buildExportObject()")[1].split("function saveCharacterProgressFromReview")[0]
    assert "trackTierPresentation(character, bundle)" in block
    assert "...tierHdr" in block or "const tierHdr = trackTierPresentation" in block


def test_welcome_intro_uses_track_tier_presentation():
    fn = APP.read_text(encoding="utf-8").split("function buildWelcomeIntroHtml")[1].split("function renderConcept")[0]
    assert "trackTierPresentation(character, bundle)" in fn
    assert "pres.trackTierLabel" in fn


def test_welcome_dragon_branch_uses_inheritance_not_legend():
    fn = APP.read_text(encoding="utf-8").split("function buildWelcomeIntroHtml")[1].split("function renderConcept")[0]
    dragon_branch = fn.split('pres.welcomeLine === "dragon"')[1].split("const t = bundle.tier")[0]
    assert "No Legend rating" in dragon_branch
    assert "Inheritance:" in dragon_branch
    assert "Typical Legend" not in dragon_branch


def test_render_welcome_uses_build_welcome_intro_html():
    block = APP.read_text(encoding="utf-8").split("function renderWelcome(root)")[1].split("function buildWelcomeIntroHtml")[0]
    assert "buildWelcomeIntroHtml(parts)" in block
