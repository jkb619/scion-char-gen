#!/usr/bin/env python3
"""Report tag ids referenced under data/*.json that are missing from tags.json."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
TAGS_PATH = DATA / "tags.json"


def collect_tag_ids(obj, out: set[str]) -> None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "tagIds" and isinstance(v, list):
                for x in v:
                    if isinstance(x, str) and x.strip():
                        out.add(x.strip())
            else:
                collect_tag_ids(v, out)
    elif isinstance(obj, list):
        for x in obj:
            collect_tag_ids(x, out)


def main() -> int:
    tags = json.loads(TAGS_PATH.read_text(encoding="utf-8"))
    defined = {k for k in tags if not k.startswith("_")}
    used: set[str] = set()
    for path in sorted(DATA.glob("*.json")):
        if path.name == "meta.json":
            continue
        try:
            collect_tag_ids(json.loads(path.read_text(encoding="utf-8")), used)
        except (json.JSONDecodeError, OSError) as e:
            print(path.name, "SKIP", e, file=sys.stderr)
    missing = sorted(used - defined)
    extra = sorted(defined - used)  # tags never referenced — informational only
    print("referenced:", len(used), "defined:", len(defined))
    if missing:
        print("MISSING (add to tags.json):", ", ".join(missing))
        return 1
    print("MISSING: none")
    print("unused tag keys (optional cleanup):", len(extra))
    return 0


if __name__ == "__main__":
    sys.exit(main())
