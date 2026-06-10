"""
Snapshot existing core game data files before running the unified extractor.

Copies the current state of all data files that the unified extractor will produce,
storing them in ``src/data/_baselines/legacy_snapshot/`` for later comparison.

Usage:
    python src/scripts/snapshot_legacy_data.py [--output-dir DIR]

The snapshot can then be diffed against the unified extractor's output to verify
equivalence (tasks 9A.2 and 9A.3).
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_DATA_DIR = _REPO_ROOT / "src" / "data"
_DEFAULT_SNAPSHOT_DIR = _DATA_DIR / "_baselines" / "legacy_snapshot"

# All data file paths relative to src/data/ that the unified extractor produces.
# These are the files we need to snapshot for comparison.
_TARGET_GLOBS: list[tuple[str, str]] = []

_TARGET_FILES: list[str] = [
    "boons.json",
    "knacks.json",
    "purviews.json",
    "callings.json",
    "birthrights.json",
    "equipment.json",
    "paths.json",
    "pantheons.json",
]


def snapshot_legacy_data(output_dir: Path | None = None) -> dict:
    """
    Copy existing game data files to a snapshot directory.

    Returns a manifest dict describing what was snapshotted.
    """
    snapshot_dir = output_dir or _DEFAULT_SNAPSHOT_DIR

    # Clean previous snapshot if it exists
    if snapshot_dir.exists():
        shutil.rmtree(snapshot_dir)
    snapshot_dir.mkdir(parents=True, exist_ok=True)

    manifest: dict = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source_dir": str(_DATA_DIR),
        "snapshot_dir": str(snapshot_dir),
        "files_copied": [],
        "files_missing": [],
    }

    # Copy glob-matched files (table fragments)
    for glob_pattern, dest_subdir in _TARGET_GLOBS:
        dest_path = snapshot_dir / dest_subdir
        dest_path.mkdir(parents=True, exist_ok=True)

        matched = sorted(_DATA_DIR.glob(glob_pattern))
        if not matched:
            manifest["files_missing"].append(f"{glob_pattern} (no files found)")
            print(f"  [SKIP] {glob_pattern} — no files found")
            continue

        for src_file in matched:
            dst_file = dest_path / src_file.name
            shutil.copy2(src_file, dst_file)
            rel = str(src_file.relative_to(_DATA_DIR))
            manifest["files_copied"].append(rel)
            print(f"  [COPY] {rel}")

    # Copy individual root-level data files
    for filename in _TARGET_FILES:
        src_file = _DATA_DIR / filename
        if not src_file.exists():
            manifest["files_missing"].append(filename)
            print(f"  [SKIP] {filename} — not found")
            continue

        dst_file = snapshot_dir / filename
        shutil.copy2(src_file, dst_file)
        manifest["files_copied"].append(filename)
        print(f"  [COPY] {filename}")

    # Write the manifest
    manifest_path = snapshot_dir / "_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(f"\nSnapshot complete: {len(manifest['files_copied'])} files copied, "
          f"{len(manifest['files_missing'])} missing")
    print(f"Output: {snapshot_dir}")

    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Snapshot existing game data files for comparison against the unified extractor."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help=f"Directory to store the snapshot (default: {_DEFAULT_SNAPSHOT_DIR})",
    )
    args = parser.parse_args()

    print("Snapshotting legacy game data files...")
    print(f"Source: {_DATA_DIR}\n")

    manifest = snapshot_legacy_data(args.output_dir)

    if not manifest["files_copied"]:
        print("\nWarning: No files were snapshotted. Data files may not exist yet.")
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
