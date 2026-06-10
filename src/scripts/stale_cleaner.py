"""Stale file cleaner for the unified PDF extractor.

Identifies and removes orphaned JSON files in src/data/books/ that no longer
correspond to any currently processed Book Spec PDF.

Only targets files within src/data/books/; never touches src/data/*.json monoliths or
src/data/ root files.
"""

from __future__ import annotations

from pathlib import Path


def find_stale_files(
    books_output_dir: Path,
    active_slugs: set[str],
) -> list[Path]:
    """Return paths in books_output_dir that don't match any active slug.

    A file is stale if:
    - It is a .json file (non-JSON files like _README.txt are skipped)
    - Its stem (filename without extension) is not in the active_slugs set

    Parameters
    ----------
    books_output_dir:
        Path to the src/data/books/ directory.
    active_slugs:
        Set of slugs derived from Book Specs whose PDFs were found and processed.

    Returns
    -------
    Sorted list of Path objects for stale JSON files.
    """
    if not books_output_dir.is_dir():
        return []

    stale: list[Path] = []
    for path in sorted(books_output_dir.iterdir()):
        # Only consider .json files
        if path.suffix != ".json":
            continue
        # Only consider regular files
        if not path.is_file():
            continue
        # If the file's stem is not in active slugs, it's stale
        if path.stem not in active_slugs:
            stale.append(path)

    return stale


def clean_stale_files(
    stale_files: list[Path],
    dry_run: bool = False,
) -> list[Path]:
    """Delete stale files. In dry-run mode, print without deleting.

    Parameters
    ----------
    stale_files:
        List of file paths to delete (as returned by find_stale_files).
    dry_run:
        If True, report which files would be deleted without performing deletion.

    Returns
    -------
    List of paths that were actually deleted (empty in dry-run mode).
    """
    deleted: list[Path] = []

    for path in stale_files:
        if dry_run:
            print(f"[DRY-RUN] Would delete: {path}")
        else:
            path.unlink()
            deleted.append(path)
            print(f"[CLEANUP] Deleted: {path}")

    return deleted
