"""LLM router status endpoint."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_llm_status_unconfigured(monkeypatch) -> None:
    monkeypatch.delenv("SCION_LLM_OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("SCION_LLM_XAI_API_KEY", raising=False)
    client = TestClient(app)
    res = client.get("/api/llm/status")
    assert res.status_code == 200
    body = res.json()
    assert body["configured"] is False
    assert body["providers"] == []


def test_character_flavor_builds_instructions(monkeypatch) -> None:
    monkeypatch.setenv("SCION_LLM_OPENAI_API_KEY", "test-key")
    from app.routers.llm import _build_field_instructions
    from app.routers.llm import CharacterFlavorRequest

    body = CharacterFlavorRequest(
        lineage="scion",
        tier="Hero",
        concept="street samurai",
        fieldModes={
            "concept": "enhance",
            "paths": {"origin": "generate", "role": "enhance", "society": "generate"},
        },
        paths={"origin": "", "role": "soldier", "society": ""},
    )
    text = _build_field_instructions(body)
    assert "ENHANCE" in text and "street samurai" in text
    assert "paths.origin" in text and "GENERATE" in text


def test_llm_character_flavor_503_when_unconfigured(monkeypatch) -> None:
    monkeypatch.delenv("SCION_LLM_OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("SCION_LLM_XAI_API_KEY", raising=False)
    client = TestClient(app)
    res = client.post("/api/llm/character-flavor", json={"tier": "Hero", "concept": "test"})
    assert res.status_code == 503
