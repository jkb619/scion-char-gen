"""OpenAI-compatible chat completion for character flavor text."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

from app.services.llm_config import LlmProviderConfig


def chat_completion(cfg: LlmProviderConfig, messages: list[dict[str, str]], *, temperature: float = 0.85) -> str:
    url = f"{cfg.base_url.rstrip('/')}/chat/completions"
    body = {
        "model": cfg.model,
        "temperature": temperature,
        "messages": messages,
        "response_format": {"type": "json_object"},
    }
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {cfg.api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"LLM HTTP {exc.code}: {detail[:500]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"LLM request failed: {exc.reason}") from exc

    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("LLM response missing choices")
    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("LLM response missing message content")
    return content.strip()


def parse_flavor_json(raw: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("LLM returned non-JSON content") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError("LLM JSON must be an object")
    return parsed
