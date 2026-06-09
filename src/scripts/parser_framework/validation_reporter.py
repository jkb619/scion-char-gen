"""Validation Reporter — baseline comparison and regression detection.

Compares current extraction output against a stored baseline snapshot,
detects regressions (missing keys, new keys, changed content hashes),
and emits a structured ValidationReport.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from parser_framework.models import BookSpec, FlaggedEntry, ValidationReport


def compute_content_hash(entry: dict) -> str:
    """Compute SHA-256 hash of the canonical JSON representation of an entry.

    Serializes the entry dict with sorted keys and no indentation, then
    computes the SHA-256 hex digest of the UTF-8 encoded string.
    """
    canonical = json.dumps(entry, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def load_baseline(path: Path) -> dict | None:
    """Load an existing baseline snapshot from disk.

    Returns the parsed dict if the file exists and is valid JSON,
    or None if the file does not exist.
    """
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_baseline(path: Path, entries: dict) -> None:
    """Write a new baseline snapshot to disk.

    Builds the baseline dict from the entries, including book_id and
    table_name derived from the path, a generation timestamp, entry count,
    and per-entry hash + field names.

    Creates parent directories if needed. Writes UTF-8 JSON with 2-space
    indentation and a trailing newline.
    """
    # Derive book_id and table_name from path structure:
    # path is expected to be <baseline_dir>/<book_id>/<table_name>.json
    table_name = path.stem
    book_id = path.parent.name

    baseline_entries: dict[str, dict] = {}
    for key, value in entries.items():
        baseline_entries[key] = {
            "hash": compute_content_hash(value),
            "fields": sorted(value.keys()) if isinstance(value, dict) else [],
        }

    baseline = {
        "book_id": book_id,
        "table_name": table_name,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "entry_count": len(entries),
        "entries": baseline_entries,
    }

    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(baseline, f, indent=2)
        f.write("\n")


def validate(
    spec: BookSpec,
    entries: dict,
    baseline_dir: Path,
    update: bool = False,
    has_errors: bool = False,
) -> ValidationReport:
    """Compare extraction output against stored baseline and detect regressions.

    Args:
        spec: The BookSpec for the current extraction.
        entries: The current extraction output (key → field dict).
        baseline_dir: Root directory for baseline snapshots.
        update: If True, overwrite the baseline after comparison.
        has_errors: If True, skip validation (extraction had errors).

    Returns:
        A ValidationReport with regression details and status.
    """
    # Derive table_name from spec.output_path (filename without extension)
    output_path = Path(spec.output_path)
    table_name = output_path.stem

    timestamp = datetime.now(timezone.utc).isoformat()
    baseline_path = baseline_dir / spec.book_id / f"{table_name}.json"

    # If extraction had errors, skip validation entirely
    if has_errors:
        return ValidationReport(
            book_id=spec.book_id,
            table_name=table_name,
            timestamp=timestamp,
            total_entries=len(entries),
            regressions={"missing_entry": 0, "new_entry": 0, "content_changed": 0},
            flagged=[],
            status="skipped_due_to_errors",
        )

    # If entries is empty, treat as errors condition
    if not entries:
        return ValidationReport(
            book_id=spec.book_id,
            table_name=table_name,
            timestamp=timestamp,
            total_entries=0,
            regressions={"missing_entry": 0, "new_entry": 0, "content_changed": 0},
            flagged=[],
            status="skipped_due_to_errors",
        )

    # Load existing baseline
    existing_baseline = load_baseline(baseline_path)

    # If no baseline exists, create one and report zero regressions
    if existing_baseline is None:
        save_baseline(baseline_path, entries)
        return ValidationReport(
            book_id=spec.book_id,
            table_name=table_name,
            timestamp=timestamp,
            total_entries=len(entries),
            regressions={"missing_entry": 0, "new_entry": 0, "content_changed": 0},
            flagged=[],
            status="ok",
        )

    # Compare current entries against baseline
    baseline_entries = existing_baseline.get("entries", {})
    baseline_keys = set(baseline_entries.keys())
    current_keys = set(entries.keys())

    flagged: list[FlaggedEntry] = []

    # Keys in baseline but not in current → missing_entry
    for key in sorted(baseline_keys - current_keys):
        flagged.append(
            FlaggedEntry(
                key=key,
                severity="missing_entry",
                old_hash=baseline_entries[key].get("hash"),
                new_hash=None,
            )
        )

    # Keys in current but not in baseline → new_entry
    for key in sorted(current_keys - baseline_keys):
        flagged.append(
            FlaggedEntry(
                key=key,
                severity="new_entry",
                old_hash=None,
                new_hash=compute_content_hash(entries[key]),
            )
        )

    # Keys in both where content hash differs → content_changed
    for key in sorted(baseline_keys & current_keys):
        old_hash = baseline_entries[key].get("hash")
        new_hash = compute_content_hash(entries[key])
        if old_hash != new_hash:
            flagged.append(
                FlaggedEntry(
                    key=key,
                    severity="content_changed",
                    old_hash=old_hash,
                    new_hash=new_hash,
                )
            )

    # Count regressions by severity
    regressions = {"missing_entry": 0, "new_entry": 0, "content_changed": 0}
    for entry in flagged:
        regressions[entry.severity] += 1

    # Determine status
    if regressions["missing_entry"] > 0 or regressions["content_changed"] > 0:
        status = "error"
    elif regressions["new_entry"] > 0:
        status = "warning"
    else:
        status = "ok"

    # If update flag is set, overwrite the baseline
    if update:
        save_baseline(baseline_path, entries)

    return ValidationReport(
        book_id=spec.book_id,
        table_name=table_name,
        timestamp=timestamp,
        total_entries=len(entries),
        regressions=regressions,
        flagged=flagged,
        status=status,
    )
