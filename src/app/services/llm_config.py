"""Load LLM API credentials from environment (Lightsail SSM → deploy env; local via SOPS exec-env)."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class LlmProviderConfig:
    provider_id: str
    api_key: str
    base_url: str
    model: str


def _env(name: str) -> str:
    return os.environ.get(name, "").strip()


def llm_configured() -> bool:
    return bool(_pick_provider())


def configured_providers() -> list[str]:
    out: list[str] = []
    if _env("SCION_LLM_OPENAI_API_KEY"):
        out.append("openai")
    if _env("SCION_LLM_XAI_API_KEY"):
        out.append("xai")
    return out


def _pick_provider() -> LlmProviderConfig | None:
    default = _env("SCION_LLM_DEFAULT_PROVIDER").lower() or "openai"
    providers = {
        "openai": LlmProviderConfig(
            provider_id="openai",
            api_key=_env("SCION_LLM_OPENAI_API_KEY"),
            base_url=_env("SCION_LLM_OPENAI_BASE_URL") or "https://api.openai.com/v1",
            model=_env("SCION_LLM_OPENAI_MODEL") or "gpt-4o-mini",
        ),
        "xai": LlmProviderConfig(
            provider_id="xai",
            api_key=_env("SCION_LLM_XAI_API_KEY"),
            base_url=_env("SCION_LLM_XAI_BASE_URL") or "https://api.x.ai/v1",
            model=_env("SCION_LLM_XAI_MODEL") or "grok-2-latest",
        ),
    }
    preferred = providers.get(default)
    if preferred and preferred.api_key:
        return preferred
    for cfg in providers.values():
        if cfg.api_key:
            return cfg
    return None


def active_provider() -> LlmProviderConfig | None:
    return _pick_provider()
