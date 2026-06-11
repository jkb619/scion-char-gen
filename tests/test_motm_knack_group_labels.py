"""MotM knack group / subpool labels (mirrors eligibility.js helpers)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CALLINGS_PATH = ROOT / "src/data/callings.json"


def load_motm_pairs() -> dict[str, str]:
    data = json.loads(CALLINGS_PATH.read_text(encoding="utf-8"))
    pairs = data.get("_meta", {}).get("motmInvertedPairs", {})
    out: dict[str, str] = {}
    for std, inv in pairs.items():
        out[std] = inv
        out[inv] = std
    return out


def motm_calling_pair_for_row(calling_id: str, callings: dict) -> dict | None:
    pairs = load_motm_pairs()
    cid = str(calling_id or "").strip()
    if not cid or cid not in pairs:
        return None
    twin = pairs[cid]
    inverted_id = cid if cid in {inv for inv in pairs.values()} else twin
    standard_id = twin if inverted_id == cid else cid
    if inverted_id == standard_id:
        return None
    return {
        "invertedId": inverted_id,
        "standardId": standard_id,
        "invName": callings.get(inverted_id, {}).get("name", inverted_id),
        "stdName": callings.get(standard_id, {}).get("name", standard_id),
    }


def motm_knack_subpool_section_title(sub_key: str, pair: dict, anchor: str) -> str:
    if sub_key == "inverted":
        tag = "your Calling" if anchor == pair["invertedId"] else "MotM inverted"
        return f"Inverted — {pair['invName']} ({tag})"
    if sub_key == "standard-twin":
        tag = "your Calling" if anchor == pair["standardId"] else "standard twin"
        return f"{pair['stdName']} ({tag})"
    return ""


def test_cosmos_row_labels_inverted_as_yours():
    callings = json.loads(CALLINGS_PATH.read_text(encoding="utf-8"))
    pair = motm_calling_pair_for_row("cosmos", callings)
    assert pair is not None
    assert pair["invertedId"] == "cosmos"
    assert pair["standardId"] == "sage"
    assert motm_knack_subpool_section_title("inverted", pair, "cosmos") == "Inverted — Cosmos (your Calling)"
    assert motm_knack_subpool_section_title("standard-twin", pair, "cosmos") == "Sage (standard twin)"
