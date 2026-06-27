"""LLM env bootstrap from secrets/llm-keys.local.yaml."""

from __future__ import annotations

import os
from pathlib import Path

import pytest


def test_bootstrap_llm_env_loads_local_yaml(monkeypatch, tmp_path: Path) -> None:
    import app.services.llm_config as cfg

    monkeypatch.delenv("SCION_LLM_OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("SCION_LLM_XAI_API_KEY", raising=False)
    local = tmp_path / "secrets" / "llm-keys.local.yaml"
    local.parent.mkdir(parents=True)
    local.write_text(
        "SCION_LLM_DEFAULT_PROVIDER: xai\nSCION_LLM_XAI_API_KEY: test-local-key\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(cfg, "_LOCAL_LLM_KEYS", local)
    cfg.bootstrap_llm_env()
    assert cfg.llm_configured()
    assert cfg.active_provider() is not None
    assert cfg.active_provider().provider_id == "xai"


def test_bootstrap_llm_env_skips_when_already_configured(monkeypatch, tmp_path: Path) -> None:
    import app.services.llm_config as cfg

    for name in list(os.environ):
        if name.startswith("SCION_LLM_"):
            monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("SCION_LLM_DEFAULT_PROVIDER", "openai")
    monkeypatch.setenv("SCION_LLM_OPENAI_API_KEY", "existing")
    local = tmp_path / "secrets" / "llm-keys.local.yaml"
    local.parent.mkdir(parents=True)
    local.write_text("SCION_LLM_XAI_API_KEY: should-not-load\n", encoding="utf-8")
    monkeypatch.setattr(cfg, "_LOCAL_LLM_KEYS", local)
    cfg.bootstrap_llm_env()
    assert cfg.llm_configured()
    assert cfg.active_provider() is not None
    assert cfg.active_provider().provider_id == "openai"
    assert os.environ.get("SCION_LLM_XAI_API_KEY", "") != "should-not-load"


def test_llm_status_includes_setup_hint_when_unconfigured(monkeypatch) -> None:
    monkeypatch.delenv("SCION_LLM_OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("SCION_LLM_XAI_API_KEY", raising=False)
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    res = client.get("/api/llm/status")
    assert res.status_code == 200
    body = res.json()
    assert body["configured"] is False
    assert body.get("setupHint")
