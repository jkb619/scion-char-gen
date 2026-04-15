#!/usr/bin/env python3
"""Flag catalog Boons that look sheet-broken (empty description or no labeled Cost line)."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))
from app.services.data_tables import primary_write_path

BOONS_PATH = primary_write_path("boons")
_COST_LABEL = re.compile(r"\bCost\s*:\s*", re.I)


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else BOONS_PATH
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        print("Expected object root", file=sys.stderr)
        return 2
    issues: list[str] = []
    for bid, entry in sorted(raw.items(), key=lambda kv: kv[0]):
        if str(bid).startswith("_") or not isinstance(entry, dict):
            continue
        desc = str(entry.get("description") or "").strip()
        cost = str(entry.get("cost") or "").strip()
        mech = str(entry.get("mechanicalEffects") or "")
        reasons: list[str] = []
        if not desc:
            reasons.append("empty description")
        if not cost and not _COST_LABEL.search(mech):
            reasons.append("no Cost: in mechanicalEffects and empty cost")
        if reasons:
            issues.append(f"{bid}: {', '.join(reasons)}")
    if issues:
        print(f"{path}: {len(issues)} boon(s) need attention\n")
        print("\n".join(issues))
        return 1
    print(f"{path}: OK (all catalog entries have description and Cost data)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
