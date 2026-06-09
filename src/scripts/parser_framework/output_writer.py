"""JSON output writer for the PDF Parser Framework.

Writes extracted entries as formatted JSON matching existing script conventions:
- UTF-8 encoding with 2-space indentation and trailing newline
- ensure_ascii=False to preserve Unicode characters
- Output paths relative to repo root

Public API:
    write_output(entries, output_path, dry_run=False) -> OutputSummary
    format_json(entries) -> str
    compute_changes(entries, output_path) -> tuple[int, int]
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass
class OutputSummary:
    """Summary of a write_output operation."""

    output_path: Path
    entry_count: int
    changed_count: int
    written: bool


def format_json(entries: dict) -> str:
    """Format a dict as JSON matching existing script conventions.

    Returns a UTF-8 string with 2-space indentation, ensure_ascii=False,
    and a trailing newline character.
    """
    return json.dumps(entries, indent=2, ensure_ascii=False) + "\n"


def compute_changes(entries: dict, output_path: Path) -> tuple[int, int]:
    """Compare entries against the existing file at output_path.

    Returns:
        (entry_count, changed_count) where entry_count is the number of
        non-meta keys in entries, and changed_count is the number of keys
        that differ from the existing file (or entry_count if no file exists).
    """
    # Count non-meta entries
    entry_count = sum(1 for k in entries if not k.startswith("_"))

    if not output_path.exists():
        # All entries are "changed" (new) if no file exists
        return entry_count, entry_count

    try:
        existing_text = output_path.read_text(encoding="utf-8")
        existing = json.loads(existing_text)
    except (json.JSONDecodeError, OSError):
        # Treat unreadable/corrupt file as if all entries are new
        return entry_count, entry_count

    if not isinstance(existing, dict):
        return entry_count, entry_count

    # Count keys that differ between current and existing
    changed = 0
    all_keys = set(k for k in entries if not k.startswith("_")) | set(
        k for k in existing if not k.startswith("_")
    )

    for key in all_keys:
        old_val = existing.get(key)
        new_val = entries.get(key)
        if old_val != new_val:
            changed += 1

    return entry_count, changed


def write_output(
    entries: dict,
    output_path: Path,
    dry_run: bool = False,
) -> OutputSummary:
    """Write extracted entries as formatted JSON to the specified path.

    In dry-run mode, prints a summary line without writing any files.

    Args:
        entries: Dict of extracted entries (may include _meta key).
        output_path: Absolute path where JSON should be written.
        dry_run: If True, print summary without writing.

    Returns:
        OutputSummary with path, counts, and whether the file was written.
    """
    entry_count, changed_count = compute_changes(entries, output_path)

    if dry_run:
        print(f"{output_path}: {entry_count} entries, {changed_count} changed")
        return OutputSummary(
            output_path=output_path,
            entry_count=entry_count,
            changed_count=changed_count,
            written=False,
        )

    # Ensure parent directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write formatted JSON
    output_path.write_text(format_json(entries), encoding="utf-8")

    return OutputSummary(
        output_path=output_path,
        entry_count=entry_count,
        changed_count=changed_count,
        written=True,
    )
