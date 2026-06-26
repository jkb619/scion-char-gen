"""MotM Purviews step copy — Awareness Innate vs inverted Callings."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MOTM = ROOT / "src" / "data" / "masksOfTheMythos.json"
APP = ROOT / "src" / "static" / "js" / "app.js"
INNATE = ROOT / "src" / "static" / "js" / "purviewInnate.js"
HELP = ROOT / "src" / "static" / "js" / "fieldHelp.js"


def test_motm_bundle_has_purviews_step_callout():
    data = json.loads(MOTM.read_text(encoding="utf-8"))
    callout = data.get("purviewsStepCallout", "")
    assert "inverted Callings" in callout
    assert "Callings step" in callout
    assert "Awareness Innate" in callout
    innate = data.get("mythosInnatePowerCallout", "")
    assert "Awareness" in innate
    assert "one Innate Power" in innate


def test_app_references_motm_purviews_callout():
    app = APP.read_text(encoding="utf-8")
    assert "purviewsStepCallout" in app
    assert 'h.textContent = "Awareness Innate (optional)"' in app
    assert "Commit to Awareness Innate" in app
    assert '"-- or --"' not in app


def test_purview_innate_awareness_label():
    js = INNATE.read_text(encoding="utf-8")
    assert "Awareness Innate (MotM — optional alternative" in js


def test_field_help_motm_purview_hint():
    js = HELP.read_text(encoding="utf-8")
    assert '"purview-select-motm"' in js
    assert "Inverted Callings" in js
