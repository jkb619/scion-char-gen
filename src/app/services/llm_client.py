"""OpenAI-compatible chat completion and xAI Responses + Collections search."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

from app.services.llm_config import LlmProviderConfig


def chat_completion(
    cfg: LlmProviderConfig,
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.85,
    timeout_s: float = 90,
) -> str:
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
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
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


def _extract_responses_text(payload: dict[str, Any]) -> str:
    """Pull assistant text from xAI / OpenAI Responses API payload."""
    chunks: list[str] = []

    output = payload.get("output")
    if isinstance(output, list):
        for item in output:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "message":
                content = item.get("content")
                if isinstance(content, list):
                    for part in content:
                        if isinstance(part, dict):
                            text = part.get("text")
                            if isinstance(text, str) and text.strip():
                                chunks.append(text.strip())
                elif isinstance(content, str) and content.strip():
                    chunks.append(content.strip())
            elif item.get("type") == "output_text" and isinstance(item.get("text"), str):
                chunks.append(item["text"].strip())

    if not chunks:
        for key in ("output_text", "text"):
            val = payload.get(key)
            if isinstance(val, str) and val.strip():
                chunks.append(val.strip())

    if not chunks:
        choices = payload.get("choices")
        if isinstance(choices, list) and choices:
            msg = choices[0].get("message") if isinstance(choices[0], dict) else None
            if isinstance(msg, dict) and isinstance(msg.get("content"), str):
                chunks.append(msg["content"].strip())

    text = "\n".join(chunks).strip()
    if not text:
        raise RuntimeError("LLM responses payload missing assistant text")
    return text


def responses_with_collection_search(
    cfg: LlmProviderConfig,
    *,
    system: str,
    user: str,
    collection_id: str,
    timeout_s: float = 180,
) -> str:
    """xAI Responses API with file_search over a Collections vector store."""
    url = f"{cfg.base_url.rstrip('/')}/responses"
    body: dict[str, Any] = {
        "model": cfg.model,
        "input": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "tools": [
            {
                "type": "file_search",
                "vector_store_ids": [collection_id],
                "max_num_results": 12,
            }
        ],
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
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"LLM HTTP {exc.code}: {detail[:800]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"LLM request failed: {exc.reason}") from exc

    text = _extract_responses_text(payload)
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def parse_flavor_json(raw: str) -> dict[str, Any]:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError("LLM returned non-JSON content") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError("LLM JSON must be an object")
    return parsed
