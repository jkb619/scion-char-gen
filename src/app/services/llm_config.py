"""Load LLM API credentials from environment (Lightsail SSM → deploy env; local via SOPS exec-env)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from app.config import PROJECT_ROOT

_LOCAL_LLM_KEYS = PROJECT_ROOT / "secrets" / "llm-keys.local.yaml"


@dataclass(frozen=True)
class LlmProviderConfig:
    provider_id: str
    api_key: str
    base_url: str
    model: str


def xai_collection_id() -> str:
    """xAI Collections id for Scion 2e PDF RAG (console collection name often 'Scion 2e')."""
    return _env("SCION_LLM_XAI_COLLECTION_ID") or _env("SCION_LLM_SCION2E_COLLECTION_ID")


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


def llm_setup_hint() -> str | None:
    """Actionable hint when no provider API key is in the process environment."""
    if llm_configured():
        return None
    from app.config import ASSET_VERSION

    deployed = ASSET_VERSION != "dev" and not str(ASSET_VERSION).startswith("g")
    if deployed:
        return (
            "Production: LLM keys are injected from AWS SSM at deploy time. "
            "Run ./scripts/sync-llm-keys-to-ssm.sh (SOPS + AWS credentials), then make ls-deploy."
        )
    if _LOCAL_LLM_KEYS.is_file():
        return (
            f"Found {_LOCAL_LLM_KEYS.relative_to(PROJECT_ROOT)} but no SCION_LLM_* key loaded — "
            "check the file has SCION_LLM_XAI_API_KEY or SCION_LLM_OPENAI_API_KEY set, then restart the server."
        )
    return (
        "Local dev: copy secrets/llm-keys.local.yaml.example to secrets/llm-keys.local.yaml, "
        "set SCION_LLM_XAI_API_KEY (or OPENAI), restart the server. "
        "Or run: make run-with-llm (requires SOPS + AWS KMS access to secrets/llm-keys.yaml)."
    )


def bootstrap_llm_env() -> None:
    """Load SCION_LLM_* from secrets/llm-keys.local.yaml when not already in os.environ."""
    if llm_configured():
        return
    if not _LOCAL_LLM_KEYS.is_file():
        return
    try:
        import yaml

        raw = yaml.safe_load(_LOCAL_LLM_KEYS.read_text(encoding="utf-8"))
    except OSError:
        return
    except Exception:
        return
    if not isinstance(raw, dict):
        return
    for key, val in raw.items():
        if not isinstance(key, str) or not key.startswith("SCION_LLM_"):
            continue
        if _env(key):
            continue
        if val is None:
            continue
        text = str(val).strip()
        if text:
            os.environ[key] = text
