#!/usr/bin/env python3
"""CLI Orchestrator for the PDF Parser Framework.

Provides a single command-line entrypoint for running the full extraction pipeline
or individual stages (ingest, extract, validate) for one or all Book Specs.

Usage:
    python src/scripts/parse.py ingest [--book BOOK_ID] [--books-dir DIR]
    python src/scripts/parse.py extract [--book BOOK_ID] [--verbose]
    python src/scripts/parse.py validate [--book BOOK_ID] [--update-baseline]
    python src/scripts/parse.py run [--book BOOK_ID] [--books-dir DIR] [--update-baseline] [--dry-run] [--verbose]
    python src/scripts/parse.py generate-spec SCRIPT_PATH

Or as a module:
    python -m scripts.parse <subcommand> [options]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Ensure src/scripts is on sys.path for imports
_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

_REPO_ROOT = _SCRIPT_DIR.parents[1]

from parser_framework.spec_loader import SpecValidationError, load_specs
from parser_framework.ingest_engine import ingest
from parser_framework.extract_engine import extract, extract_pymupdf
from parser_framework.validation_reporter import validate
from parser_framework.output_writer import write_output
from parser_framework.models import BookSpec, ExtractResult
import scion_books_dir

# Default directories
_BOOK_SPECS_DIR = _SCRIPT_DIR / "book_specs"
_BASELINE_DIR = _REPO_ROOT / "src" / "data" / "_baselines"
_EXTRACTED_DIR = _REPO_ROOT / "src" / "data" / "_extracted"


def _resolve_json_output_path(spec: BookSpec) -> Path | None:
    """Resolve the JSON output path for a BookSpec's extraction results.

    Returns the absolute path for writing JSON output, or None if the spec's
    output_path is for ingested text only (i.e., .txt files without a
    corresponding JSON target).

    BookSpecs with output_path ending in .json write directly to that path.
    BookSpecs with output_path ending in .txt do not have a JSON output target
    configured at this level (handled by json_output_paths field).
    """
    output_path_str = spec.output_path
    if output_path_str.endswith(".json"):
        return _REPO_ROOT / output_path_str
    return None


def _resolve_all_json_output_paths(spec: BookSpec) -> list[tuple[str, Path]]:
    """Resolve all JSON output paths for a BookSpec.

    Returns a list of (table_name, absolute_path) tuples from the spec's
    json_output_paths field. These paths correspond to the locations expected
    by data_tables.py PRIMARY_FRAGMENT entries.

    If json_output_paths is not set, falls back to _resolve_json_output_path
    for backward compatibility with specs using .json output_path directly.
    """
    paths: list[tuple[str, Path]] = []

    if spec.json_output_paths:
        for table_name, rel_path in spec.json_output_paths.items():
            paths.append((table_name, _REPO_ROOT / rel_path))
    else:
        # Fallback: single JSON output from output_path
        single = _resolve_json_output_path(spec)
        if single is not None:
            paths.append(("_default", single))

    return paths


def build_parser() -> argparse.ArgumentParser:
    """Build argparse with subcommands: ingest, extract, validate, run, generate-spec."""
    parser = argparse.ArgumentParser(
        prog="scion-parse",
        description="PDF Parser Framework — unified extraction pipeline for Scion books.",
    )

    # Common arguments added to subparsers
    parent_parser = argparse.ArgumentParser(add_help=False)
    parent_parser.add_argument(
        "--book",
        metavar="BOOK_ID",
        help="Run only for this Book Spec identifier.",
    )
    parent_parser.add_argument(
        "--books-dir",
        metavar="DIR",
        help="Explicit directory containing PDF files (overrides SCION_BOOKS_DIR).",
    )
    parent_parser.add_argument(
        "--verbose",
        action="store_true",
        default=False,
        help="Write full extraction log to src/data/_extracted/<book_id>.log.json.",
    )
    parent_parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Print what would be done without writing output files.",
    )
    parent_parser.add_argument(
        "--update-baseline",
        action="store_true",
        default=False,
        help="Overwrite baseline snapshots with current extraction output.",
    )

    subparsers = parser.add_subparsers(dest="command", help="Pipeline stage to run.")

    # ingest subcommand
    subparsers.add_parser(
        "ingest",
        parents=[parent_parser],
        help="Extract plain text from PDFs.",
    )

    # extract subcommand
    subparsers.add_parser(
        "extract",
        parents=[parent_parser],
        help="Run structured extraction on ingested text.",
    )

    # validate subcommand
    subparsers.add_parser(
        "validate",
        parents=[parent_parser],
        help="Compare extraction output against baselines.",
    )

    # run subcommand (ingest → extract → validate)
    subparsers.add_parser(
        "run",
        parents=[parent_parser],
        help="Execute full pipeline: ingest → extract → validate.",
    )

    # generate-spec subcommand
    gen_parser = subparsers.add_parser(
        "generate-spec",
        help="Generate a skeleton Book Spec from an existing ingest script.",
    )
    gen_parser.add_argument(
        "script_path",
        metavar="SCRIPT_PATH",
        help="Path to the existing ingest script to parse.",
    )

    return parser


def _load_and_filter_specs(book_filter: str | None) -> list[BookSpec] | None:
    """Load specs from book_specs directory and filter by --book if provided.

    Returns:
        List of BookSpec instances, or None if an error occurred (error already printed).
    """
    if not _BOOK_SPECS_DIR.is_dir():
        print(f"error: no Book Spec directory found at {_BOOK_SPECS_DIR}", file=sys.stderr)
        return None

    try:
        specs = load_specs(_BOOK_SPECS_DIR)
    except SpecValidationError as exc:
        print(f"error: spec validation failed: {exc}", file=sys.stderr)
        return None

    if not specs:
        print("error: no Book Spec files found in src/scripts/book_specs/", file=sys.stderr)
        return None

    if book_filter is not None:
        available_ids = [s.book_id for s in specs]
        matching = [s for s in specs if s.book_id == book_filter]
        if not matching:
            print(
                f"error: unknown book identifier '{book_filter}'. "
                f"Available: {', '.join(sorted(available_ids))}",
                file=sys.stderr,
            )
            return None
        specs = matching

    return specs


def _resolve_search_dirs(args: argparse.Namespace) -> list[Path]:
    """Resolve PDF search directories from --books-dir arg or environment."""
    explicit_dir = Path(args.books_dir) if getattr(args, "books_dir", None) else None
    return scion_books_dir.books_search_dirs(explicit_dir)


def _write_verbose_log(book_id: str, log_entries: list) -> None:
    """Write full extraction log to src/data/_extracted/<book_id>.log.json."""
    log_path = _EXTRACTED_DIR / f"{book_id}.log.json"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_data = [
        {
            "book_id": entry.book_id,
            "entry_id": entry.entry_id,
            "field": entry.field,
            "reason": entry.reason,
            "detail": entry.detail,
        }
        for entry in log_entries
    ]
    log_path.write_text(
        json.dumps(log_data, indent=2) + "\n",
        encoding="utf-8",
    )


def cmd_ingest(args: argparse.Namespace) -> int:
    """Run ingest stage: PDF to plaintext for targeted books.

    Returns exit code: 0 for all ok, 1 for any error.
    """
    specs = _load_and_filter_specs(getattr(args, "book", None))
    if specs is None:
        return 1

    search_dirs = _resolve_search_dirs(args)
    has_error = False

    for spec in specs:
        try:
            result = ingest(spec, search_dirs)
            error_count = len(result.errors)
            if error_count > 0:
                print(f"{spec.book_id} ingest warning {result.page_count}")
            else:
                print(f"{spec.book_id} ingest ok {result.page_count}")
        except FileNotFoundError as exc:
            print(f"{spec.book_id} ingest error 1")
            if getattr(args, "verbose", False):
                print(f"  {exc}", file=sys.stderr)
            has_error = True
        except Exception as exc:
            print(f"{spec.book_id} ingest error 1")
            if getattr(args, "verbose", False):
                print(f"  {exc}", file=sys.stderr)
            has_error = True

    return 1 if has_error else 0


def cmd_extract(args: argparse.Namespace) -> int:
    """Run extract stage: structured extraction on ingested text.

    Returns exit code: 0 for all ok/warning, 1 for any error.
    """
    specs = _load_and_filter_specs(getattr(args, "book", None))
    if specs is None:
        return 1

    search_dirs = _resolve_search_dirs(args)
    dry_run = getattr(args, "dry_run", False)
    has_error = False

    for spec in specs:
        try:
            result = _run_extract_for_spec(spec, search_dirs)
            entry_count = len(result.entries)

            if not result.entries and result.log:
                # No entries extracted but log has issues — error
                print(f"{spec.book_id} extract error {len(result.log)}")
                has_error = True
            elif result.log:
                # Entries extracted but some issues logged — warning
                print(f"{spec.book_id} extract ok {entry_count}")
            else:
                print(f"{spec.book_id} extract ok {entry_count}")

            # Write JSON output if a JSON output path is configured
            json_paths = _resolve_all_json_output_paths(spec)
            if json_paths and result.entries:
                for _table_name, json_path in json_paths:
                    write_output(result.entries, json_path, dry_run=dry_run)

            if getattr(args, "verbose", False):
                _write_verbose_log(spec.book_id, result.log)

        except Exception as exc:
            print(f"{spec.book_id} extract error 1")
            if getattr(args, "verbose", False):
                print(f"  {exc}", file=sys.stderr)
            has_error = True

    return 1 if has_error else 0


def _run_extract_for_spec(spec: BookSpec, search_dirs: list[Path]) -> ExtractResult:
    """Run extraction for a single spec, choosing mode based on extraction_mode."""
    if spec.extraction_mode == "pymupdf":
        from parser_framework.ingest_engine import resolve_pdf
        pdf_path = resolve_pdf(spec, search_dirs)
        return extract_pymupdf(spec, pdf_path)
    else:
        # Read ingested text from output_path
        output_path = _REPO_ROOT / spec.output_path
        if not output_path.exists():
            raise FileNotFoundError(
                f"Ingested text not found at {output_path}. Run 'ingest' first."
            )
        text = output_path.read_text(encoding="utf-8")
        return extract(spec, text)


def cmd_validate(args: argparse.Namespace) -> int:
    """Run validate stage: compare extraction output against baselines.

    Returns exit code: 0 for all ok/warning, 1 for any error.
    """
    specs = _load_and_filter_specs(getattr(args, "book", None))
    if specs is None:
        return 1

    search_dirs = _resolve_search_dirs(args)
    update_baseline = getattr(args, "update_baseline", False)
    has_error = False

    for spec in specs:
        try:
            # Run extraction to get current entries
            result = _run_extract_for_spec(spec, search_dirs)
            has_extract_errors = (not result.entries and bool(result.log))

            report = validate(
                spec,
                result.entries,
                _BASELINE_DIR,
                update=update_baseline,
                has_errors=has_extract_errors,
            )

            if report.status == "error":
                total_issues = sum(report.regressions.values())
                print(f"{spec.book_id} validate error {total_issues}")
                has_error = True
            elif report.status == "warning":
                print(f"{spec.book_id} validate warning {report.total_entries}")
            elif report.status == "skipped_due_to_errors":
                print(f"{spec.book_id} validate error 1")
                has_error = True
            else:
                print(f"{spec.book_id} validate ok {report.total_entries}")

        except Exception as exc:
            print(f"{spec.book_id} validate error 1")
            if getattr(args, "verbose", False):
                print(f"  {exc}", file=sys.stderr)
            has_error = True

    return 1 if has_error else 0


def cmd_run(args: argparse.Namespace) -> int:
    """Execute full pipeline: ingest → extract → validate for targeted books.

    For each book, runs stages in order, halting at first error per book.
    Continues processing remaining books even if one book errors.

    Returns exit code: 0 for all ok/warning, 1 for any error.
    """
    specs = _load_and_filter_specs(getattr(args, "book", None))
    if specs is None:
        return 1

    search_dirs = _resolve_search_dirs(args)
    update_baseline = getattr(args, "update_baseline", False)
    dry_run = getattr(args, "dry_run", False)
    verbose = getattr(args, "verbose", False)
    has_error = False

    for spec in specs:
        book_failed = False

        # Stage 1: Ingest
        try:
            if dry_run:
                print(f"{spec.book_id} ingest ok 0")
            else:
                ingest_result = ingest(spec, search_dirs)
                error_count = len(ingest_result.errors)
                if error_count > 0:
                    print(f"{spec.book_id} ingest warning {ingest_result.page_count}")
                else:
                    print(f"{spec.book_id} ingest ok {ingest_result.page_count}")
        except Exception as exc:
            print(f"{spec.book_id} ingest error 1")
            if verbose:
                print(f"  {exc}", file=sys.stderr)
            has_error = True
            book_failed = True

        if book_failed:
            continue

        # Stage 2: Extract
        extract_result: ExtractResult | None = None
        try:
            if dry_run:
                # In dry-run, check if there's a JSON output path and report
                json_paths = _resolve_all_json_output_paths(spec)
                for _table_name, json_path in json_paths:
                    write_output({}, json_path, dry_run=True)
                print(f"{spec.book_id} extract ok 0")
            else:
                extract_result = _run_extract_for_spec(spec, search_dirs)
                entry_count = len(extract_result.entries)

                if not extract_result.entries and extract_result.log:
                    print(f"{spec.book_id} extract error {len(extract_result.log)}")
                    has_error = True
                    book_failed = True
                elif extract_result.log:
                    print(f"{spec.book_id} extract ok {entry_count}")
                else:
                    print(f"{spec.book_id} extract ok {entry_count}")

                # Write JSON output if json_output_paths are configured
                json_paths = _resolve_all_json_output_paths(spec)
                if json_paths and extract_result.entries:
                    for _table_name, json_path in json_paths:
                        write_output(extract_result.entries, json_path, dry_run=False)

                if verbose:
                    _write_verbose_log(spec.book_id, extract_result.log)

        except Exception as exc:
            print(f"{spec.book_id} extract error 1")
            if verbose:
                print(f"  {exc}", file=sys.stderr)
            has_error = True
            book_failed = True

        if book_failed:
            continue

        # Stage 3: Validate
        try:
            if dry_run:
                print(f"{spec.book_id} validate ok 0")
            else:
                has_extract_errors = (
                    extract_result is not None
                    and not extract_result.entries
                    and bool(extract_result.log)
                )
                report = validate(
                    spec,
                    extract_result.entries if extract_result else {},
                    _BASELINE_DIR,
                    update=update_baseline,
                    has_errors=has_extract_errors,
                )

                if report.status == "error":
                    total_issues = sum(report.regressions.values())
                    print(f"{spec.book_id} validate error {total_issues}")
                    has_error = True
                elif report.status == "warning":
                    print(f"{spec.book_id} validate warning {report.total_entries}")
                elif report.status == "skipped_due_to_errors":
                    print(f"{spec.book_id} validate error 1")
                    has_error = True
                else:
                    print(f"{spec.book_id} validate ok {report.total_entries}")

        except Exception as exc:
            print(f"{spec.book_id} validate error 1")
            if verbose:
                print(f"  {exc}", file=sys.stderr)
            has_error = True

    return 1 if has_error else 0


def cmd_generate_spec(args: argparse.Namespace) -> int:
    """Parse existing ingest script and emit skeleton Book_Spec YAML.

    Reads the script for:
      - A `from scion_books_dir import find_*` line to identify the finder function
      - A `DEFAULT_OUT = ...` assignment to extract the output path
    Then looks up the corresponding filenames constant from scion_books_dir,
    derives book_id from the output filename, and emits a skeleton YAML.

    Returns exit code: 0 on success, 1 on error.
    """
    import re as _re

    script_path = Path(args.script_path)
    if not script_path.exists():
        print(f"error: script not found: {script_path}", file=sys.stderr)
        return 1

    script_text = script_path.read_text(encoding="utf-8")

    # --- Extract the find_* import to identify which filenames constant to use ---
    find_import_match = _re.search(
        r"from\s+scion_books_dir\s+import\s+(find_\w+)", script_text
    )
    if not find_import_match:
        print(
            "error: could not locate 'from scion_books_dir import find_*' "
            f"in {script_path}",
            file=sys.stderr,
        )
        return 1

    finder_name = find_import_match.group(1)  # e.g. "find_pandoras_box_revised_pdf"

    # --- Extract DEFAULT_OUT to determine output path ---
    # Matches patterns like:  DEFAULT_OUT = SRC / "data" / "_extracted" / "pandoras_box.txt"
    # or:  DEFAULT_OUT = Path("src/data/_extracted/pandoras_box.txt")
    default_out_match = _re.search(
        r'DEFAULT_OUT\s*=\s*(.+)', script_text
    )
    if not default_out_match:
        print(
            f"error: could not locate 'DEFAULT_OUT' assignment in {script_path}",
            file=sys.stderr,
        )
        return 1

    default_out_expr = default_out_match.group(1).strip()

    # Extract the path segments from the expression
    # Handle: SRC / "data" / "_extracted" / "filename.txt"
    path_segments = _re.findall(r'"([^"]+)"', default_out_expr)
    if not path_segments:
        path_segments = _re.findall(r"'([^']+)'", default_out_expr)

    if not path_segments:
        print(
            f"error: could not parse output path from DEFAULT_OUT in {script_path}",
            file=sys.stderr,
        )
        return 1

    # Reconstruct relative output path from segments
    # If the expression uses SRC / ..., the path is relative to src/
    if "SRC" in default_out_expr or "ROOT" in default_out_expr:
        output_path = "src/" + "/".join(path_segments)
    else:
        output_path = "/".join(path_segments)

    # Derive book_id from the output filename (strip extension)
    output_filename = path_segments[-1]  # e.g. "pandoras_box.txt"
    book_id = Path(output_filename).stem  # e.g. "pandoras_box"

    # --- Look up the filenames constant from scion_books_dir ---
    # Map finder function names to their corresponding filenames constants
    # The mapping follows the pattern: find_<name>_pdf -> <NAME>_FILENAMES
    # But the actual mapping isn't always a direct transformation, so we use
    # a lookup approach by inspecting scion_books_dir for tuples.
    filenames_const = _resolve_filenames_constant(finder_name)
    if filenames_const is None:
        print(
            f"error: could not resolve filenames constant for '{finder_name}' "
            f"in scion_books_dir",
            file=sys.stderr,
        )
        return 1

    # --- Generate skeleton YAML ---
    yaml_lines = _format_book_spec_yaml(
        book_id=book_id,
        filenames=list(filenames_const),
        output_path=output_path,
    )

    # Ensure book_specs directory exists
    specs_dir = _BOOK_SPECS_DIR
    specs_dir.mkdir(parents=True, exist_ok=True)

    out_file = specs_dir / f"{book_id}.yaml"
    out_file.write_text(yaml_lines, encoding="utf-8")
    print(f"Generated skeleton Book Spec: {out_file}")
    return 0


def _resolve_filenames_constant(finder_name: str) -> tuple[str, ...] | None:
    """Resolve the filenames tuple from scion_books_dir for a given finder function.

    Maps find_* function names to their corresponding *_FILENAMES constants
    by inspecting the scion_books_dir module.
    """
    # Known mappings from finder function names to filenames constant names.
    # The pattern is: find_<descriptive_name>_pdf -> look for matching constant.
    _FINDER_TO_CONST = {
        "find_pandoras_box_revised_pdf": "PANDORAS_BOX_FILENAMES",
        "find_mysteries_companion_pdf": "MYSTERIES_FILENAMES",
        "find_masks_of_the_mythos_pdf": "MASKS_FILENAMES",
        "find_saints_monsters_pdf": "SAINTS_FILENAMES",
        "find_titans_rising_pdf": "TITANS_RISING_FILENAMES",
        "find_scion_dragon_core_pdf": "DRAGON_CORE_FILENAMES",
        "find_scion_origin_revised_pdf": "ORIGIN_REVISED_FILENAMES",
        "find_scion_hero_pdf": "SCION_HERO_FILENAMES",
    }

    const_name = _FINDER_TO_CONST.get(finder_name)
    if const_name is None:
        return None

    return getattr(scion_books_dir, const_name, None)


def _format_book_spec_yaml(
    book_id: str,
    filenames: list[str],
    output_path: str,
) -> str:
    """Format a skeleton Book Spec as YAML with fixed field order and 2-space indent.

    Field order: book_id, filenames, output_path, section_anchors,
                 heading_patterns, expected_fields, pipeline_stages
    """
    lines: list[str] = []

    # book_id
    lines.append(f"book_id: {book_id}")

    # filenames
    lines.append("filenames:")
    for fname in filenames:
        lines.append(f'  - "{fname}"')

    # output_path
    lines.append(f'output_path: "{output_path}"')

    # section_anchors (placeholder)
    lines.append("section_anchors:")
    lines.append('  - pattern: "TODO"')
    lines.append("    pattern_type: literal")

    # heading_patterns (placeholder)
    lines.append("heading_patterns:")
    lines.append('  - regex: "TODO"')
    lines.append("    flags:")
    lines.append("      - MULTILINE")

    # expected_fields (placeholder)
    lines.append("expected_fields:")
    lines.append("  - TODO")

    # pipeline_stages
    lines.append("pipeline_stages:")
    lines.append("  - ingest")
    lines.append("  - extract")
    lines.append("  - validate")

    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    """Main entrypoint — parse args and dispatch to subcommand handler.

    Returns exit code for sys.exit().
    """
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command is None:
        parser.print_help()
        return 1

    handlers = {
        "ingest": cmd_ingest,
        "extract": cmd_extract,
        "validate": cmd_validate,
        "run": cmd_run,
        "generate-spec": cmd_generate_spec,
    }

    handler = handlers.get(args.command)
    if handler is None:
        parser.print_help()
        return 1

    return handler(args)


if __name__ == "__main__":
    sys.exit(main())
