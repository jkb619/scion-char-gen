#!/usr/bin/env python3
"""Normalize knack rows: tier mortal|immortal only; callingSlotCost 1|2."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src" / "scripts"))

from extract_pb_knacks_to_json import normalize_knack_row  # noqa: E402

KNACKS = ROOT / "src" / "data" / "knacks.json"


def main() -> int:
    data = json.loads(KNACKS.read_text(encoding="utf-8"))
    meta = data.get("_meta", {})
    counts = {"mortal": 0, "immortal": 0, "slot1": 0, "slot2": 0}
    out: dict = {"_meta": meta}
    for key, row in data.items():
        if key == "_meta" or not isinstance(row, dict):
            continue
        norm = normalize_knack_row(row)
        counts[norm["tier"]] += 1
        if norm["callingSlotCost"] == 2:
            counts["slot2"] += 1
        else:
            counts["slot1"] += 1
        out[key] = norm
    elig = out["_meta"].setdefault("eligibility", {})
    elig["tier"] = "mortal | immortal (knack category). Origin shows mortal; Hero+ shows immortal."
    elig["callingSlotCost"] = (
        "Calling dots at Hero tier: 1 (default) or 2 (PB IMMORTAL lists). Demigod+ treat all as 1."
    )
    elig.pop("tierMin", None)
    elig.pop("knackKind", None)
    out["_meta"]["note"] = (
        "Knack categories: mortal | immortal only (Hero p.223). "
        "callingSlotCost encodes Hero-band 1- vs 2-dot knacks."
    )
    KNACKS.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(out) - 1} knacks: {counts}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
