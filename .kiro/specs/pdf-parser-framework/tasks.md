# Implementation Plan: PDF Parser Framework

## Overview

Convert the PDF parser framework design into incremental implementation steps. The framework is a Python package at `src/scripts/parser_framework/` with a CLI entrypoint at `src/scripts/parse.py`. Implementation proceeds bottom-up: data models and normalization utilities first, then engines (ingest, extract, validate), then CLI orchestration, then Book Spec migration. Property-based tests using Hypothesis validate correctness properties defined in the design.

## Tasks

- [x] 1. Set up package structure, dependencies, and data models
  - [x] 1.1 Create parser_framework package with models and normalize modules
    - Create `src/scripts/parser_framework/__init__.py` with public API exports
    - Create `src/scripts/parser_framework/models.py` with all dataclasses: `SectionAnchor`, `HeadingPattern`, `BookSpec`, `IngestResult`, `ExtractResult`, `LogEntry`, `FlaggedEntry`, `ValidationReport`
    - Create `src/scripts/parser_framework/normalize.py` with functions: `normalize_text`, `normalize_heading`, `fuzzy_find_anchor`, `whitespace_insensitive_find`
    - Add `python-Levenshtein>=0.25,<1` and `pyyaml>=6.0,<7` to `requirements.txt`
    - _Requirements: 3.3, 6.1, 6.2_

  - [x] 1.2 Write property tests for normalize module (Properties 2, 10, 14)
    - Add `hypothesis>=6.100,<7` and `pytest>=8.0,<9` to `requirements.txt` (dev)
    - Create `tests/test_parser_framework/conftest.py` with shared fixtures
    - Create `tests/test_parser_framework/test_properties.py`
    - **Property 2: Newline Normalization Invariant** — verify output never contains 4+ consecutive newlines and is idempotent
    - **Property 10: Heading Normalization Idempotence** — verify applying twice equals applying once, no prohibited characters remain
    - **Property 14: Fuzzy Match Accepts Exactly Within Threshold** — verify Levenshtein ≤ 2 accepted, > 2 rejected
    - **Validates: Requirements 1.2, 3.3, 6.2**

- [x] 2. Implement spec_loader module
  - [x] 2.1 Create spec_loader with discovery and validation logic
    - Create `src/scripts/parser_framework/spec_loader.py`
    - Implement `load_specs(specs_dir: Path) -> list[BookSpec]` — discovers `.yaml`, `.yml`, `.json` files
    - Implement `validate_spec(raw: dict, source_file: Path) -> BookSpec` — validates required fields, book_id format, pipeline stage names, non-empty filenames
    - Raise `SpecValidationError` with file path and failing field on invalid specs
    - Detect and reject duplicate `book_id` across loaded specs
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 2.2 Write property tests for spec_loader (Properties 5, 6)
    - **Property 5: Spec Discovery by Extension** — verify only .yaml/.yml/.json files are loaded
    - **Property 6: Spec Validation Error Reporting** — verify error messages contain source file and failing field/value
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.6**

- [x] 3. Implement ingest_engine module
  - [x] 3.1 Create ingest_engine with PDF resolution and text extraction
    - Create `src/scripts/parser_framework/ingest_engine.py`
    - Implement `resolve_pdf(spec: BookSpec, search_dirs: list[Path]) -> Path` — iterate search dirs then filenames, return first existing file
    - Implement `ingest(spec: BookSpec, search_dirs: list[Path]) -> IngestResult` — extract text page-by-page with pypdf, prepend page markers `===== Page N / Total =====`, normalize 4+ newlines to 3, insert error markers for failed pages, write UTF-8 output
    - Raise `FileNotFoundError` with book_id, candidates, and directories on PDF not found
    - Integrate with `scion_books_dir.books_search_dirs()` for directory resolution
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 3.2 Write property tests for ingest_engine (Properties 1, 3, 4)
    - **Property 1: Path Resolution Priority Order** — verify earlier-priority directory always wins over later-priority directory
    - **Property 3: FileNotFoundError Message Completeness** — verify error contains book_id, all filenames, all directories
    - **Property 4: Graceful Page Error Handling** — verify N page markers present, error markers for failed pages, non-failing pages extracted
    - **Validates: Requirements 1.1, 1.3, 1.5, 5.5, 7.5**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement extract_engine module
  - [x] 5.1 Create extract_engine with section finding and field extraction
    - Create `src/scripts/parser_framework/extract_engine.py`
    - Implement `find_section(text: str, anchor: SectionAnchor) -> tuple[int, int] | None` — normalized matching, fuzzy fallback (Levenshtein ≤ 2), alias resolution in declaration order
    - Implement `extract_fields(block: str, expected_fields: list[str]) -> dict[str, str | None]` — scan for `FieldName: value` lines, collapse whitespace, return null + log for missing
    - Implement `extract(spec: BookSpec, text: str) -> ExtractResult` — locate sections, identify headings, extract fields per entry, remove noise lines
    - Implement `extract_pymupdf(spec: BookSpec, pdf_path: Path) -> ExtractResult` — pymupdf-based structured extraction for layout-sensitive books
    - Apply heading normalization from `normalize.py` for heading identification
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 5.2 Write property tests for extract_engine (Properties 7, 8, 9, 11, 12, 13, 15)
    - **Property 7: Literal Anchor Matching is Whitespace and Case Insensitive** — verify literal anchors match despite whitespace/case variation; regex without flag rejects case changes
    - **Property 8: Alias Resolution Uses Declaration Order** — verify earlier-declared alias is used regardless of textual position
    - **Property 9: Section and Heading Partitioning** — verify blocks form a complete partition with no gaps or overlaps
    - **Property 11: Field Extraction Round-Trip** — verify constructed `FieldName: value` lines are correctly extracted
    - **Property 12: Missing Fields Produce Null and Log Entry** — verify null values and log entries for absent fields
    - **Property 13: Unmatched Anchor Produces Skip and Log** — verify missed anchors produce log entries without halting
    - **Property 15: Noise Line Removal Preserves Non-Noise Content** — verify noise lines removed and non-noise preserved in order
    - **Validates: Requirements 2.4, 2.5, 3.1, 3.2, 3.4, 3.5, 3.7, 6.1, 6.2, 6.3, 6.4**

- [x] 6. Implement validation_reporter module
  - [x] 6.1 Create validation_reporter with baseline comparison logic
    - Create `src/scripts/parser_framework/validation_reporter.py`
    - Implement `compute_content_hash(entry: dict) -> str` — SHA-256 of canonical JSON
    - Implement `load_baseline(path: Path) -> dict | None` and `save_baseline(path: Path, entries: dict) -> None`
    - Implement `validate(spec: BookSpec, entries: dict, baseline_dir: Path, update: bool = False) -> ValidationReport` — compare current vs baseline, flag `missing_entry`, `new_entry`, `content_changed`; create new baseline if none exists; skip if extraction had errors; overwrite baseline on `--update-baseline`
    - Store baselines at `src/data/_baselines/<book_id>/<table_name>.json`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x] 6.2 Write property tests for validation_reporter (Properties 16, 17)
    - **Property 16: Baseline Regression Detection Correctness** — verify missing, new, and changed entries are each correctly flagged with no duplicates
    - **Property 17: First-Run Baseline Creation** — verify zero regressions reported and baseline file created matching current output
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.7**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement CLI orchestrator and JSON output
  - [x] 8.1 Create CLI entrypoint with subcommands and pipeline orchestration
    - Create `src/scripts/parse.py` with argparse subcommands: `ingest`, `extract`, `validate`, `run`, `generate-spec`
    - Implement `--book` filtering against discovered Book_Spec identifiers
    - Implement `--books-dir` option and `SCION_BOOKS_DIR` env var resolution via `scion_books_dir.books_search_dirs()`
    - Implement `--update-baseline` and `--dry-run` flags
    - Implement `--verbose` flag for writing full log to `src/data/_extracted/<book_id>.log.json`
    - Implement `run` subcommand executing ingest → extract → validate in sequence, halting on first error per book
    - Print summary lines: `<book_id> <stage> <status> <count>`
    - Continue processing remaining books on per-book errors
    - Exit code 0 for all ok/warning, 1 for any error or no specs found
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x] 8.2 Implement JSON output formatting matching existing script conventions
    - Write output JSON as UTF-8 with 2-space indentation and trailing newline
    - Output to paths matching existing scripts: `src/data/boonPbMechanics.json` for standalone, `src/data/tables/<tableName>/<fragmentFilename>.json` for table fragments
    - Maintain entry key naming convention (`{purview}_dot_{NN}` with zero-padded two-digit numbers)
    - Implement `--dry-run` mode printing path, entry count, and changed count without writing
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 8.3 Write property tests for output formatting and CLI exit codes (Properties 18, 20)
    - **Property 18: Exit Code Reflects Worst Status** — verify exit code 0 iff no error status present
    - **Property 20: JSON Output Formatting** — verify valid UTF-8, 2-space indent, trailing newline
    - **Validates: Requirements 5.7, 7.3**

- [x] 9. Implement pretty-printer for Book Spec generation
  - [x] 9.1 Create generate-spec subcommand for skeleton Book_Spec creation
    - Implement `cmd_generate_spec(args) -> int` in `src/scripts/parse.py`
    - Parse existing ingest script for PDF path constants and output path variables
    - Emit skeleton YAML to `src/scripts/book_specs/<book_id>.yaml`
    - Use 2-space indentation with fixed field order: book_id, filenames, output_path, section_anchors, heading_patterns, expected_fields, pipeline_stages
    - Exit non-zero with error message if script doesn't contain recognizable constants
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 9.2 Write property test for pretty-printer round-trip (Property 19)
    - **Property 19: Pretty-Printer Round-Trip** — verify serializing and deserializing a valid BookSpec produces deep-equal result
    - **Validates: Requirements 8.4**

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Create initial Book Spec files and integration wiring
  - [x] 11.1 Create Book Spec YAML files for existing books
    - Create `src/scripts/book_specs/` directory
    - Write `pandoras_box.yaml` with pymupdf extraction mode, section anchors, heading patterns, and expected fields matching `ingest_pandoras_box_pdf.py`
    - Write `mysteries_of_the_world.yaml` matching `ingest_mysteries_of_the_world_pdf.py`
    - Write `masks_of_the_mythos.yaml` matching `ingest_masks_of_the_mythos_pdf.py`
    - Write `saints_monsters.yaml` matching `ingest_saints_monsters_pdf.py`
    - Write `scion_origin.yaml`, `scion_hero.yaml`, `titans_rising.yaml`, `scion_dragon.yaml` with appropriate settings
    - _Requirements: 2.1, 2.2, 2.4, 2.5_

  - [x] 11.2 Wire framework output to existing data_tables paths
    - Ensure framework JSON output lands at paths registered in `data_tables.py` `PRIMARY_FRAGMENT`
    - Verify `data_tables.load_merged_table` can consume framework output without modification
    - Create `src/data/_baselines/` directory structure
    - Create `src/data/_extracted/` directory for plaintext output
    - _Requirements: 7.1, 7.2, 7.5, 7.6_

  - [x] 11.3 Write integration tests for end-to-end pipeline and data_tables compatibility
    - Test `scion-parse run --book pandoras_box` produces output loadable by `load_merged_table`
    - Test output schema matches existing script output (keys, types, field names)
    - Test `--dry-run` writes no files
    - _Requirements: 7.1, 7.2, 7.4, 7.6_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using Hypothesis
- Unit tests validate specific examples and edge cases
- The framework imports from existing `scion_books_dir.py` and `app.services.data_tables` — do not modify those modules
- All property tests should use `@settings(max_examples=200)` for normalization properties and `@settings(max_examples=100)` minimum for others
- Existing ingest scripts remain untouched until corresponding Book Specs are validated against their output

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["3.2", "5.1"] },
    { "id": 4, "tasks": ["5.2", "6.1"] },
    { "id": 5, "tasks": ["6.2", "8.1"] },
    { "id": 6, "tasks": ["8.2", "8.3"] },
    { "id": 7, "tasks": ["9.1"] },
    { "id": 8, "tasks": ["9.2", "11.1"] },
    { "id": 9, "tasks": ["11.2"] },
    { "id": 10, "tasks": ["11.3"] }
  ]
}
```
