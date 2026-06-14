"""Exp Leveling draft session — save on leave with confirmation."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_exp_leveling_session_module_exists():
    path = ROOT / "src" / "static" / "js" / "expLevelingSession.js"
    text = path.read_text(encoding="utf-8")
    assert "export function activateExpLevelingSession" in text
    assert "export function resolveLeaveExpLevelingStep" in text
    assert "export function resetExpLevelingSession" in text
    assert "LEAVE_CONFIRM_MESSAGE" in text
    assert "RESET_CONFIRM_MESSAGE" in text
    assert "structuredClone(currentCharacter)" in text


def test_app_wires_exp_leveling_leave_confirm():
    app = (ROOT / "src" / "static" / "js" / "app.js").read_text(encoding="utf-8")
    assert 'from "./expLevelingSession.js"' in app
    assert "activateExpLevelingSession(character)" in app
    assert "resolveLeaveExpLevelingStep(character)" in app
    assert "resetExpLevelingSession(character)" in app
    assert "RESET_CONFIRM_MESSAGE" in app
    assert 'fromStep === "expLeveling"' in app
    assert 'step === "expLeveling"' in app
    assert "expLevelingSessionDirty(character)" in app
    assert "exp-leveling-reset-btn" in app


def test_field_help_mentions_save_on_leave():
    help_js = (ROOT / "src" / "static" / "js" / "fieldHelp.js").read_text(encoding="utf-8")
    assert "prompted to save when leaving" in help_js
