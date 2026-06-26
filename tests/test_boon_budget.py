"""Legend + Experience Boon purchase budget (Demigod+)."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "static" / "js" / "app.js"
BUDGET = ROOT / "src" / "static" / "js" / "boonBudget.js"


def test_boon_budget_module_legend_and_dominion():
    js = BUDGET.read_text(encoding="utf-8")
    assert "export function legendBoonSlotsUsed" in js
    assert "dominionLegendPurchaseCostForMark" in js
    assert "export function boonBudgetSnapshot" in js
    assert "export function experienceBoonIdSet" in js
    assert "export function applyDominionMarkPayment" in js
    assert "export function boonBelongsToPurview" in js
    assert "boonPrimaryPurview" in js


def test_render_boons_uses_legend_budget():
    app = APP.read_text(encoding="utf-8")
    render = app.split("function renderBoons(root)")[1].split("function renderDominionBoons")[0]
    assert "boonBudgetSnapshot(character, bundle)" in render
    assert "legendBoonSlotsRemaining(character)" in render
    assert "addExperienceBoonPick(bid)" in render
    assert "removeExperienceBoonPick(bid)" in render
    assert "experienceBoonIds" in app
    exp = app.split("function renderExpLeveling(root)")[1].split("function renderDominionBoons")[0]
    assert "appendExpBoonChip(bid, b)" in exp


def test_dominion_sacrifice_ui_and_exp_leveling():
    app = APP.read_text(encoding="utf-8")
    assert "function appendDominionBoonMarkingUi" in app
    assert "sacrificableBoonIds(character, pid, bundle)" in app
    assert "Both must belong to this Purview" in app
    assert "clearDominionMarkPayment(character, pid)" in app
    assert "dominionBoonForgoneByPurview" in app
    assert "exp-leveling-dominion-panel" in app
    assert "Forgo 2 Boons for Dominion" in app


def test_export_includes_boon_budget():
    app = APP.read_text(encoding="utf-8")
    assert "boonBudget: boonBudgetSnapshot(character, bundle)" in app
    assert "experienceBoonIds:" in app
    assert "dominionBoonForgoneByPurview:" in app
