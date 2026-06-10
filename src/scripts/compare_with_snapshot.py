"""
Compare unified extractor output against the legacy snapshot.

Reads the legacy snapshot from ``src/data/_baselines/legacy_snapshot/`` and compares
it to the current state of data files in ``src/data/``. Reports:
  - Keys added (new extraction found more entries)
  - Keys removed (regression — entries present in legacy but missing in current)
  - Keys changed (same key but differing field values)

Usage:
    python src/scripts/compare_with_snapshot.py [--snapshot-dir DIR] [--data-dir DIR] [--verbose]

This script does NOT run the unified extractor itself. Run the extractor first, then
use this script to compare outputs. If the current data files don't exist (e.g., PDFs
are not available and the extractor produced no output), the script reports that
comparison couldn't be performed for those categories.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[2]
_DATA_DIR = _REPO_ROOT / "src" / "data"
_DEFAULT_SNAPSHOT_DIR = _DATA_DIR / "_baselines" / "legacy_snapshot"


@dataclass
class FileDiff:
    """Diff result for a single JSON file comparison."""

    relative_path: str
    snapshot_key_count: int = 0
    current_key_count: int = 0
    keys_added: list[str] = field(default_factory=list)
    keys_removed: list[str] = field(default_factory=list)
    keys_changed: list[str] = field(default_factory=list)
    status: str = "MATCH"  # MATCH | SUPERSET | REGRESSION | CHANGED | MISSING_CURRENT | MISSING_SNAPSHOT
    error: str | None = None


def _load_json(path: Path) -> dict[str, Any] | None:
    """Load a JSON file, returning None if it doesn't exist or is invalid."""
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        print(f"  [ERROR] Cannot read {path}: {e}", file=sys.stderr)
        return None


def _data_keys(data: dict[str, Any]) -> set[str]:
    """Extract data entry keys (excluding _meta and other underscore-prefixed keys)."""
    return {k for k in data.keys() if not k.startswith("_")}


def compare_json_files(
    snapshot_path: Path,
    current_path: Path,
    relative_path: str,
    *,
    verbose: bool = False,
) -> FileDiff:
    """
    Compare a snapshot JSON file against the current version.

    Returns a FileDiff describing the differences.
    """
    diff = FileDiff(relative_path=relative_path)

    snapshot_data = _load_json(snapshot_path)
    current_data = _load_json(current_path)

    # Handle missing files
    if snapshot_data is None and current_data is None:
        diff.status = "MISSING_BOTH"
        diff.error = "Neither snapshot nor current file exists"
        return diff

    if snapshot_data is None:
        diff.status = "MISSING_SNAPSHOT"
        diff.error = "Snapshot file not found (new file in current data)"
        if current_data:
            diff.current_key_count = len(_data_keys(current_data))
        return diff

    if current_data is None:
        diff.status = "MISSING_CURRENT"
        diff.error = "Current file not found (extractor may not have run or PDFs unavailable)"
        diff.snapshot_key_count = len(_data_keys(snapshot_data))
        return diff

    # Compare keys
    snapshot_keys = _data_keys(snapshot_data)
    current_keys = _data_keys(current_data)

    diff.snapshot_key_count = len(snapshot_keys)
    diff.current_key_count = len(current_keys)

    diff.keys_added = sorted(current_keys - snapshot_keys)
    diff.keys_removed = sorted(snapshot_keys - current_keys)

    # Check for value changes in shared keys
    shared_keys = snapshot_keys & current_keys
    for key in sorted(shared_keys):
        if snapshot_data[key] != current_data[key]:
            diff.keys_changed.append(key)

    # Determine overall status
    if diff.keys_removed:
        diff.status = "REGRESSION"
    elif diff.keys_changed and diff.keys_added:
        diff.status = "CHANGED"
    elif diff.keys_added and not diff.keys_changed:
        diff.status = "SUPERSET"
    elif diff.keys_changed:
        diff.status = "CHANGED"
    else:
        diff.status = "MATCH"

    return diff


def compare_all(
    snapshot_dir: Path,
    data_dir: Path,
    *,
    verbose: bool = False,
) -> list[FileDiff]:
    """
    Compare all files from the legacy snapshot against current data.

    Uses the snapshot's _manifest.json to determine which files to compare.
    """
    manifest_path = snapshot_dir / "_manifest.json"
    if not manifest_path.exists():
        print(f"[ERROR] No manifest found at {manifest_path}", file=sys.stderr)
        print("        Run snapshot_legacy_data.py first (task 9A.1).", file=sys.stderr)
        return []

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    files_to_compare = manifest.get("files_copied", [])

    if not files_to_compare:
        print("[WARN] Manifest lists no files to compare.")
        return []

    results: list[FileDiff] = []

    for rel_path in files_to_compare:
        snapshot_file = snapshot_dir / rel_path
        current_file = data_dir / rel_path

        diff = compare_json_files(
            snapshot_path=snapshot_file,
            current_path=current_file,
            relative_path=rel_path,
            verbose=verbose,
        )
        results.append(diff)

    return results


def print_report(results: list[FileDiff], *, verbose: bool = False) -> None:
    """Print a human-readable comparison report."""
    if not results:
        print("No files to compare.")
        return

    print("\n" + "=" * 70)
    print("  LEGACY SNAPSHOT vs CURRENT DATA — Comparison Report")
    print("=" * 70 + "\n")

    # Summary counts
    match_count = sum(1 for r in results if r.status == "MATCH")
    superset_count = sum(1 for r in results if r.status == "SUPERSET")
    regression_count = sum(1 for r in results if r.status == "REGRESSION")
    changed_count = sum(1 for r in results if r.status == "CHANGED")
    missing_current_count = sum(1 for r in results if r.status == "MISSING_CURRENT")
    missing_snapshot_count = sum(1 for r in results if r.status == "MISSING_SNAPSHOT")

    # Print per-file results
    for diff in results:
        status_icon = {
            "MATCH": "✓",
            "SUPERSET": "+",
            "REGRESSION": "✗",
            "CHANGED": "~",
            "MISSING_CURRENT": "?",
            "MISSING_SNAPSHOT": "★",
            "MISSING_BOTH": "-",
        }.get(diff.status, "?")

        print(f"  [{status_icon}] {diff.relative_path}")

        if diff.status == "MATCH":
            print(f"      MATCH — {diff.snapshot_key_count} entries identical")

        elif diff.status == "SUPERSET":
            print(f"      SUPERSET — {diff.snapshot_key_count} → {diff.current_key_count} entries "
                  f"(+{len(diff.keys_added)} new)")
            if verbose and diff.keys_added:
                for k in diff.keys_added[:10]:
                    print(f"        + {k}")
                if len(diff.keys_added) > 10:
                    print(f"        ... and {len(diff.keys_added) - 10} more")

        elif diff.status == "REGRESSION":
            print(f"      REGRESSION — {diff.snapshot_key_count} → {diff.current_key_count} entries "
                  f"(-{len(diff.keys_removed)} missing)")
            for k in diff.keys_removed[:10]:
                print(f"        - {k}")
            if len(diff.keys_removed) > 10:
                print(f"        ... and {len(diff.keys_removed) - 10} more")
            if diff.keys_added:
                print(f"      Also added: +{len(diff.keys_added)} new entries")

        elif diff.status == "CHANGED":
            print(f"      CHANGED — {len(diff.keys_changed)} entries differ, "
                  f"+{len(diff.keys_added)} added, -{len(diff.keys_removed)} removed")
            if verbose and diff.keys_changed:
                for k in diff.keys_changed[:10]:
                    print(f"        ~ {k}")
                if len(diff.keys_changed) > 10:
                    print(f"        ... and {len(diff.keys_changed) - 10} more")

        elif diff.status == "MISSING_CURRENT":
            print(f"      NOT FOUND — current file missing (extractor did not produce output)")
            print(f"      Snapshot had {diff.snapshot_key_count} entries")

        elif diff.status == "MISSING_SNAPSHOT":
            print(f"      NEW FILE — not present in snapshot ({diff.current_key_count} entries in current)")

        elif diff.status == "MISSING_BOTH":
            print(f"      SKIPPED — neither file exists")

        print()

    # Summary
    print("-" * 70)
    print("  Summary:")
    print(f"    MATCH:            {match_count}")
    print(f"    SUPERSET:         {superset_count} (new extractor found more — acceptable)")
    print(f"    REGRESSION:       {regression_count} (missing entries — needs investigation)")
    print(f"    CHANGED:          {changed_count} (field differences)")
    print(f"    MISSING CURRENT:  {missing_current_count} (extractor output not available)")
    print(f"    NEW FILES:        {missing_snapshot_count} (not in legacy snapshot)")
    print("-" * 70)

    if regression_count > 0:
        print("\n  ⚠️  REGRESSIONS DETECTED — legacy scripts should NOT be deleted yet.")
    elif missing_current_count > 0:
        print("\n  ℹ️  Some files could not be compared (PDFs may not be available).")
        print("     Run the unified extractor with PDFs present to perform a full comparison.")
    elif match_count + superset_count == len(results):
        print("\n  ✓ All files match or are supersets. Safe to proceed with legacy script removal.")
    print()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compare unified extractor output against the legacy snapshot."
    )
    parser.add_argument(
        "--snapshot-dir",
        type=Path,
        default=None,
        help=f"Path to the legacy snapshot directory (default: {_DEFAULT_SNAPSHOT_DIR})",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=None,
        help=f"Path to the current data directory (default: {_DATA_DIR})",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed per-key differences",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON (for programmatic consumption)",
    )
    args = parser.parse_args()

    snapshot_dir = args.snapshot_dir or _DEFAULT_SNAPSHOT_DIR
    data_dir = args.data_dir or _DATA_DIR

    if not snapshot_dir.exists():
        print(f"[ERROR] Snapshot directory not found: {snapshot_dir}", file=sys.stderr)
        print("        Run snapshot_legacy_data.py first (task 9A.1).", file=sys.stderr)
        return 1

    results = compare_all(snapshot_dir, data_dir, verbose=args.verbose)

    if not results:
        return 1

    if args.json:
        json_output = []
        for diff in results:
            json_output.append({
                "file": diff.relative_path,
                "status": diff.status,
                "snapshot_keys": diff.snapshot_key_count,
                "current_keys": diff.current_key_count,
                "added": diff.keys_added,
                "removed": diff.keys_removed,
                "changed": diff.keys_changed,
                "error": diff.error,
            })
        print(json.dumps(json_output, indent=2))
    else:
        print_report(results, verbose=args.verbose)

    # Exit code: 1 if regressions found, 0 otherwise
    has_regression = any(r.status == "REGRESSION" for r in results)
    return 1 if has_regression else 0


if __name__ == "__main__":
    sys.exit(main())
