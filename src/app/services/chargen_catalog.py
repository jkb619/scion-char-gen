"""Compact chargen catalog slices for LLM concept generation (ids + labels only)."""

from __future__ import annotations

from typing import Any


def _rows(table: dict[str, Any] | None, *, limit: int | None = None) -> list[dict[str, str]]:
    if not isinstance(table, dict):
        return []
    out: list[dict[str, str]] = []
    for key, row in table.items():
        if not isinstance(key, str) or key.startswith("_") or not isinstance(row, dict):
            continue
        name = str(row.get("name") or key).strip()
        out.append({"id": key, "name": name})
    out.sort(key=lambda x: x["name"].lower())
    if limit is not None:
        return out[:limit]
    return out


def _parse_welcome_track(track: str) -> tuple[str, str]:
    raw = (track or "deity:mortal").strip()
    if ":" not in raw:
        return "deity", raw or "mortal"
    line, payload = raw.split(":", 1)
    return line.strip().lower() or "deity", payload.strip() or "mortal"


def build_chargen_catalog(bundle: dict[str, Any], welcome_track: str) -> dict[str, Any]:
    """Tier-aware id lists the model may reference when customizing a mechanical skeleton."""
    line, payload = _parse_welcome_track(welcome_track)
    tier = payload if line == "sorcerer" else payload
    if line == "dragon":
        tier = f"dragon:{payload}"

    pantheons: list[dict[str, Any]] = []
    pants = bundle.get("pantheons")
    if isinstance(pants, dict):
        for pid, pant in pants.items():
            if not isinstance(pid, str) or pid.startswith("_") or not isinstance(pant, dict):
                continue
            deities = []
            for row in pant.get("deities") or []:
                if not isinstance(row, dict):
                    continue
                did = str(row.get("id") or "").strip()
                if not did:
                    continue
                callings = [str(c) for c in (row.get("callings") or []) if isinstance(c, str)]
                deities.append(
                    {
                        "id": did,
                        "name": str(row.get("name") or did),
                        "callings": callings[:8],
                    }
                )
            titans = []
            for row in pant.get("titans") or []:
                if not isinstance(row, dict):
                    continue
                tid = str(row.get("id") or "").strip()
                if not tid:
                    continue
                titans.append({"id": tid, "name": str(row.get("name") or tid)})
            pantheons.append(
                {
                    "id": pid,
                    "name": str(pant.get("name") or pid),
                    "signaturePurviewId": str(pant.get("signaturePurviewId") or "").strip(),
                    "deities": deities[:40],
                    "titans": titans[:24],
                }
            )
    pantheons.sort(key=lambda x: str(x.get("name", "")).lower())

    paths_table = bundle.get("paths") if isinstance(bundle.get("paths"), dict) else {}
    path_examples: dict[str, list[str]] = {"origin": [], "role": [], "society": []}
    for pk in path_examples:
        section = paths_table.get(pk)
        if not isinstance(section, dict):
            continue
        names: list[str] = []
        for k, row in section.items():
            if k.startswith("_") or not isinstance(row, dict):
                continue
            label = str(row.get("name") or row.get("phrase") or k).strip()
            if label:
                names.append(label[:120])
        path_examples[pk] = sorted(set(names))[:24]

    return {
        "welcomeTrack": welcome_track,
        "line": line,
        "tier": tier,
        "skills": _rows(bundle.get("skills")),
        "attributes": _rows(bundle.get("attributes")),
        "callings": _rows(bundle.get("callings")),
        "purviews": _rows(bundle.get("purviews"), limit=80),
        "knacks": _rows(bundle.get("knacks"), limit=120),
        "birthrights": _rows(bundle.get("birthrights"), limit=120),
        "boons": _rows(bundle.get("boons"), limit=120),
        "pantheons": pantheons,
        "pathPhraseExamples": path_examples,
    }
