"""Chargen catalog + concept-from-prompt LLM endpoint."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.chargen_catalog import build_chargen_catalog
from app.services.llm_concept_chargen import _merge_character_export, _specialty_eligible_skills


def test_build_chargen_catalog_includes_pantheons() -> None:
    from app.services.game_data import load_bundle

    bundle = load_bundle()
    cat = build_chargen_catalog(bundle, "deity:hero")
    assert cat["line"] == "deity"
    assert cat["tier"] == "hero"
    assert isinstance(cat["skills"], list) and len(cat["skills"]) >= 8
    assert isinstance(cat["pantheons"], list)


def test_merge_character_export_deeds() -> None:
    base = {"characterName": "A", "deeds": {"short": "s", "long": "l", "band": "b"}}
    over = {"deeds": {"short": "new short"}, "concept": "spy"}
    merged = _merge_character_export(base, over)
    assert merged["concept"] == "spy"
    assert merged["deeds"]["short"] == "new short"
    assert merged["deeds"]["long"] == "l"


def test_merge_character_export_ignores_mechanical_budgets() -> None:
    base = {
        "tier": "mortal",
        "legendRating": 0,
        "skills": {"athletics": 3},
        "attributesBeforeFavored": {"might": 3},
    }
    over = {
        "tier": "hero",
        "tierId": "hero",
        "legendRating": 3,
        "skills": {"athletics": 5},
        "attributesBeforeFavored": {"might": 5},
    }
    merged = _merge_character_export(base, over)
    assert merged["tier"] == "mortal"
    assert merged["legendRating"] == 0
    assert merged["skills"]["athletics"] == 3
    assert merged["attributesBeforeFavored"]["might"] == 3


def test_specialty_eligible_skills_from_mechanical() -> None:
    mechanical = {
        "skills": {"athletics": 3, "stealth": 2},
        "skillsIncludingFinishing": {"athletics": 4, "stealth": 2, "occult": 3},
    }
    rows = _specialty_eligible_skills(mechanical)
    ids = {r["id"] for r in rows}
    assert ids == {"athletics", "occult"}
    athletics = next(r for r in rows if r["id"] == "athletics")
    assert athletics["dots"] == 4


def test_merge_character_export_keeps_thematic_arrays() -> None:
    base = {"knackIds": ["a"], "boonIds": []}
    over = {"knackIds": ["b", "c"], "boonIds": ["x"]}
    merged = _merge_character_export(base, over)
    assert merged["knackIds"] == ["b", "c"]
    assert merged["boonIds"] == ["x"]


def test_character_from_concept_503_when_unconfigured(monkeypatch) -> None:
    monkeypatch.delenv("SCION_LLM_OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("SCION_LLM_XAI_API_KEY", raising=False)
    client = TestClient(app)
    res = client.post(
        "/api/llm/character-from-concept",
        json={"conceptPrompt": "test", "welcomeTrack": "deity:mortal", "mechanical": {"tier": "mortal"}},
    )
    assert res.status_code == 503


def test_character_from_concept_400_empty_mechanical(monkeypatch) -> None:
    monkeypatch.setenv("SCION_LLM_OPENAI_API_KEY", "test-key")
    client = TestClient(app)
    res = client.post(
        "/api/llm/character-from-concept",
        json={"conceptPrompt": "test", "welcomeTrack": "deity:mortal", "mechanical": {}},
    )
    assert res.status_code == 400


def test_character_from_concept_mock_llm(monkeypatch) -> None:
    monkeypatch.setenv("SCION_LLM_OPENAI_API_KEY", "test-key")
    mechanical = {
        "tier": "mortal",
        "characterName": "Skeleton",
        "deeds": {"short": "a", "long": "b", "band": "c"},
    }
    override = {
        "characterName": "Phoenix",
        "concept": "Street sorcerer",
        "deeds": {"short": "Find the relic"},
    }

    def fake_gen(*_a, **_k):
        return {
            "character": {**mechanical, **override, "deeds": {**mechanical["deeds"], **override["deeds"]}},
            "override": override,
            "usedCollection": False,
        }

    with patch("app.routers.llm.generate_character_from_concept", side_effect=fake_gen):
        client = TestClient(app)
        res = client.post(
            "/api/llm/character-from-concept",
            json={
                "conceptPrompt": "A street sorcerer in Lagos",
                "welcomeTrack": "deity:mortal",
                "mechanical": mechanical,
            },
        )
    assert res.status_code == 200
    body = res.json()
    assert body["character"]["characterName"] == "Phoenix"
    assert body["character"]["concept"] == "Street sorcerer"
    assert body["override"]["characterName"] == "Phoenix"
