"""Browser save/load for character JSON (Review save, Welcome load)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAVE_JS = ROOT / "src" / "static" / "js" / "characterSave.js"
APP_JS = ROOT / "src" / "static" / "js" / "app.js"


def test_character_save_module_exports():
    text = SAVE_JS.read_text(encoding="utf-8")
    for name in (
        "CHARACTER_SAVE_STORAGE_KEY",
        "buildSavePayload",
        "parseSavePayload",
        "saveCharacterJsonToLocalStorage",
        "loadCharacterJsonFromLocalStorage",
        "summarizeLocalSave",
        "downloadCharacterSaveJson",
    ):
        assert f"export function {name}" in text or f"export const {name}" in text


def test_parse_save_payload_wrapped_and_raw():
    text = SAVE_JS.read_text(encoding="utf-8")
    assert "obj.saveVersion === 1 && obj.character" in text
    assert "characterData: obj" in text


def test_review_has_save_button():
    app = APP_JS.read_text(encoding="utf-8")
    review = app.split("function renderReview(root)")[1].split("function buildExportObject()")[0]
    welcome = app.split("function renderWelcome(root)")[1].split("function renderConcept(root)")[0]
    assert "saveCharacterProgressFromReview" in review
    assert 'btnSave.textContent = "Save"' in review
    assert "welcome-save-panel" not in welcome
    assert "applyImportedCharacterPayload" in app
    export_fn = app.split("function buildExportObject()")[1].split("function applyImportedCharacterPayload")[0]
    assert "allowedBooks: [...allowedBooks]" in export_fn


def test_header_import_uses_shared_loader():
    app = APP_JS.read_text(encoding="utf-8")
    init = app.split("async function init()")[1]
    assert "applyImportedCharacterPayload(JSON.parse(text), { restoreStepIndex: false })" in init
    assert "buildSavePayload({" in init
    assert "downloadCharacterSaveJson(payload" in init
