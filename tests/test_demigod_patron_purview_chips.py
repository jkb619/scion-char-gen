"""Demigod+ patron Purviews in chip list; innate slots hide/restore chips."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "static" / "js" / "app.js"


def test_demigod_shows_patron_purviews_in_chip_list():
    render = APP.read_text(encoding="utf-8").split("function renderPurviews(root)")[1].split(
        "function renderBirthrights"
    )[0]
    assert "patronInnateSlots.has(pid)" in render
    assert "if (!demigodLike && patronOpts.length > 0 && patronSet.has(pid)) return false" in render


def test_innate_slot_change_strips_old_purview_for_chip_restore():
    app = APP.read_text(encoding="utf-8")
    fn = app.split("function commitPatronPurviewSlotChange(slotIndex, newVal)")[1].split(
        "function renderPatronPurviewPanel"
    )[0]
    assert "character.purviewIds = (character.purviewIds || []).filter((id) => id !== old)" in fn


def test_chip_on_excludes_innate_slot_purviews():
    render = APP.read_text(encoding="utf-8").split("function renderPurviews(root)")[1].split(
        "function renderBirthrights"
    )[0]
    assert "character.purviewIds.includes(pid) && !patronInnateSlots.has(pid)" in render
