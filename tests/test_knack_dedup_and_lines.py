"""Knack catalog dedup and chargenLines tagging (PB primary; draconic in dragonKnacks.json)."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KNACKS_PATH = ROOT / "src" / "data" / "knacks.json"
DRAGON_KNACKS_PATH = ROOT / "src" / "data" / "dragonKnacks.json"

VALID_LINES = frozenset({"any", "deity", "titan", "sorcerer", "draconic", "denizen"})
SUPPLEMENT_PREFIXES = ("sm_", "tr_")


def _norm_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (name or "").lower())


def _callings_key(row: dict) -> frozenset[str]:
    if row.get("callingsAny") is True:
        return frozenset({"__any__"})
    return frozenset(row.get("callings") or [])


def test_all_knacks_have_chargen_lines():
    data = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    missing = []
    bad = []
    for kid, row in data.items():
        if kid.startswith("_") or not isinstance(row, dict):
            continue
        lines = row.get("chargenLines")
        if not isinstance(lines, list) or not lines:
            missing.append(kid)
            continue
        if any(line not in VALID_LINES for line in lines):
            bad.append(kid)
    assert not missing, f"knacks missing chargenLines: {missing[:10]}"
    assert not bad, f"knacks with invalid chargenLines: {bad[:10]}"


def test_no_supplement_duplicate_when_pb_general_match_exists():
    data = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    pb_general = {
        _norm_name(row.get("name"))
        for kid, row in data.items()
        if not kid.startswith("_")
        and isinstance(row, dict)
        and row.get("callingsAny") is True
        and "Pandoras_Box" in (row.get("source") or "")
    }
    offenders = []
    for kid, row in data.items():
        if not kid.startswith(SUPPLEMENT_PREFIXES):
            continue
        if row.get("callingsAny") is not True:
            continue
        if _norm_name(row.get("name")) in pb_general:
            offenders.append(kid)
    assert offenders == [], f"supplement duplicates of PB general knacks: {offenders}"


def test_beacon_of_power_single_entry():
    data = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    hits = [
        kid
        for kid, row in data.items()
        if not kid.startswith("_")
        and _norm_name(row.get("name")) == "beaconofpower"
    ]
    assert hits == ["beaconOfPower"], hits


def test_draconic_knacks_not_in_main_catalog():
    knacks = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    dragon = json.loads(DRAGON_KNACKS_PATH.read_text(encoding="utf-8"))
    overlap = [kid for kid in dragon if kid in knacks and not kid.startswith("_")]
    assert overlap == [], overlap
    assert "draconicMajesty" in dragon
    assert "draconicMajesty" not in knacks


def test_denizen_knacks_tagged_and_draconic_migrated():
    data = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    kitsune = data.get("kitsune_mortal_mask")
    assert kitsune and kitsune.get("chargenLines") == ["denizen"]
    dragon = json.loads(DRAGON_KNACKS_PATH.read_text(encoding="utf-8"))
    entry = dragon.get("draconicMajesty")
    assert entry and entry.get("chargenLines") == ["draconic"]
    assert "Pandoras_Box" in (entry.get("source") or "")


def test_non_mythos_duplicate_groups_are_empty():
    """MotM inverted twins may share names with standard Callings; other dupes should be gone."""
    data = json.loads(KNACKS_PATH.read_text(encoding="utf-8"))
    groups: dict[tuple, list[str]] = defaultdict(list)
    for kid, row in data.items():
        if kid.startswith("_") or not isinstance(row, dict):
            continue
        key = (_norm_name(row.get("name")), _callings_key(row), row.get("tier"))
        groups[key].append(kid)
    unexpected = []
    for _key, ids in groups.items():
        if len(ids) < 2:
            continue
        if all(i.startswith("mythos_") or any(j.startswith("mythos_") for j in ids) for i in ids):
            continue
        unexpected.append(ids)
    assert unexpected == [], unexpected
