# Implementation Plan: Unified PDF Extractor

## Overview

Replace the ~14 standalone extraction scripts with a single spec-driven pipeline that processes all Scion PDFs and produces every JSON data file the application consumes. Implementation builds from infrastructure (CLI, spec loader, base extractor) outward through category extractors, merge/cleanup, and build integration.

## Tasks

- [x] 1. Infrastructure and core interfaces
  - [x] 1.1 Create the CLI entry point (`src/scripts/unified_extractor.py`)
    - Implement `main()` with argparse: `--book BOOK_ID`, `--books-dir DIR`, `--dry-run`, `--verbose`
    - Wire up spec discovery, PDF resolution, per-book pipeline loop, merge, and cleanup calls (stubs initially)
    - Return exit code 0 on success, 1 on unrecoverable error
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 9.4_

  - [x] 1.2 Extend the spec loader (`parser_framework/spec_loader.py`)
    - Add validation for extended Book Spec schema: `categories` dict, `book_title`, `book_slug`, per-category `output_path`, `section_anchors`, `heading_pattern`, `expected_fields`
    - Report structural errors with field-level detail before pipeline starts
    - Maintain backward compatibility with existing specs (legacy `json_output_paths`, top-level anchors)
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 1.3 Create the category extractor base class (`src/scripts/extractors/base.py`)
    - Define `CategoryExtractor` ABC with `extract(text, spec, category_config) -> CategoryResult` and `validate_config(category_config) -> list[str]`
    - Define `CategoryResult` dataclass with `category`, `entries`, `entry_count`, `log` fields
    - Define `LogEntry` dataclass for structured extraction logging
    - Create `src/scripts/extractors/__init__.py` with extractor registry mapping category names to classes
    - _Requirements: 3.1–3.9, 7.3_

  - [x] 1.4 Implement PDF resolution integration in the CLI
    - Use `scion_books_dir.books_search_dirs()` with precedence: `--books-dir` > `SCION_BOOKS_DIR` > `<repo>/books` > `<repo>/../books`
    - Accept first matching filename from spec's `filenames` list
    - Skip missing PDFs with `[SKIP]` warning; continue processing remaining books
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2. Checkpoint - Ensure infrastructure tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Category extractors — core categories
  - [x] 3.1 Implement the knack extractor (`src/scripts/extractors/knack_extractor.py`)
    - Locate calling sections via `calling_map` section anchors
    - Split by heading pattern to isolate individual knack blocks
    - Parse name, description, mechanical effects; derive `id` (camelCase), assign `callings` from calling_map
    - Determine `knackKind` (mortal/immortal) from tier context
    - Record `source` as `<filename> p.<page_number>` from nearest preceding page marker
    - _Requirements: 3.1, 8.1_

  - [x] 3.2 Implement the boon extractor (`src/scripts/extractors/boon_extractor.py`)
    - Locate purview-organized boon sections via regex anchor
    - Identify entries by heading + dot rating pattern (● symbols); count dots for `dot` field
    - Parse mechanical effects for structured fields: Cost, Duration, Subject, Range, Action, Clash
    - Derive `tierMin` from dot position (1–4 → hero, 5–8 → demigod, 9–12 → god)
    - Generate `id` as `{purviewId}_dot_{NN:02d}`; build `requiresBoonIds` from prerequisite references
    - _Requirements: 3.2, 8.1_

  - [x] 3.3 Implement the purview extractor (`src/scripts/extractors/purview_extractor.py`)
    - Locate Purviews section; split by purview heading pattern
    - Extract `boonLadderNames` (ordered list of boon titles, padded to length 12)
    - Extract `purviewInnateSummary` from "Innate Power" subsection
    - Derive `id` from name (camelCase)
    - _Requirements: 3.3, 8.1_

  - [x] 3.4 Implement the calling extractor (`src/scripts/extractors/calling_extractor.py`)
    - Locate Callings section; split by calling name heading
    - Extract description and mechanical effects from each calling block
    - Derive `id` from name (lowercase)
    - _Requirements: 3.4, 8.1_

  - [x] 3.5 Implement the birthright extractor (`src/scripts/extractors/birthright_extractor.py`)
    - Locate Birthrights section; split by heading pattern capturing name and type
    - For creatures: apply `stat_block_pattern` to extract Primary Pool, Defense, Health
    - For relics: scan for Purview references, tag lists, evocation text
    - Assign `pointCost` from dot notation (• count)
    - _Requirements: 3.5, 8.1_

  - [x] 3.6 Implement the equipment extractor (`src/scripts/extractors/equipment_extractor.py`)
    - Locate Equipment section; split by item heading pattern
    - Apply `tag_pattern` to extract tag notation; parse into `tagIds` (camelCase)
    - Determine `equipmentType` from context (weapon section, armor section, etc.)
    - _Requirements: 3.6, 8.1_

  - [x] 3.7 Implement the path extractor (`src/scripts/extractors/path_extractor.py`)
    - Locate Paths section; split by path name heading
    - Determine `pathKind` from subsection context (Origin/Role/Society)
    - Extract `suggestedSkills` from skill list references
    - _Requirements: 3.7, 8.1_

  - [x] 3.8 Implement the pantheon extractor (`src/scripts/extractors/pantheon_extractor.py`)
    - Locate Pantheons section; split by pantheon heading
    - Extract `assetSkills` from "Asset Skills:" line
    - Parse deity lists as sub-entries with callings and purviews
    - _Requirements: 3.8, 8.1_

  - [x] 3.9 Implement the book slice extractor (`src/scripts/extractors/book_slice_extractor.py`)
    - Produce per-book bundle slices for supplement and 3rd-party books
    - Write to `src/data/books/<slug>.json` with `_meta` block
    - Include all categories declared in the spec for that book
    - _Requirements: 3.9, 8.2_

- [x] 4. Checkpoint - Ensure all category extractor tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Merge engine and stale file cleaner
  - [x] 5.1 Implement the merge engine (`src/scripts/merge_engine.py`)
    - Implement `merge_boon_catalog(fragment_dir)` to combine all boon fragment JSONs into `boons.json`
    - Implement `merge_table_fragments(table_name, fragment_dir)` for generic table merging (knacks, purviews, callings)
    - Ensure every non-meta key from every fragment appears in merged output
    - _Requirements: 3.10, 4.3_

  - [x] 5.2 Implement the stale file cleaner (`src/scripts/stale_cleaner.py`)
    - Implement `find_stale_files(books_output_dir, active_slugs)` to identify orphaned JSON files
    - Implement `clean_stale_files(stale_files, dry_run)` — delete in normal mode, report in dry-run
    - Only target files within `src/data/books/`; never touch `src/data/tables/` or `src/data/` root
    - Skip non-JSON files (e.g., `_README.txt`)
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 6. Pipeline orchestration and error handling
  - [x] 6.1 Wire per-book pipeline in the CLI
    - Integrate ingestion (pdftotext/PyMuPDF via existing ingest_engine), extraction (dispatch to category extractors), validation, and output writing
    - Handle missing category gracefully (empty result, no exception)
    - Handle corrupt PDF (skip with error, set exit code 1)
    - Handle missing PyMuPDF dependency (skip book, log warning)
    - _Requirements: 7.3, 9.1, 9.5, 4.4_

  - [x] 6.2 Implement verbose logging and error reporting
    - Write `src/data/_extracted/<book_id>.log.json` when `--verbose` is set
    - Format console output: `[SKIP]`, `[ERROR]`, `[WARN]`, `[OK]` prefixes per the design
    - Implement regression warning when entries < baseline (list missing IDs)
    - _Requirements: 9.2, 9.3_

  - [x] 6.3 Implement source provenance in all extractors
    - Ensure every entry has `source` field matching `<filename> p.<N>` format
    - Ensure every output JSON has `_meta` block with `sourcePdf`, `slug`, `book_title`
    - Multi-page entries record page number of heading appearance
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 7. Checkpoint - Ensure full pipeline tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Build system integration
  - [x] 8.1 Update Makefile targets
    - Update `parse-books` target in `docker.mk` to invoke `unified_extractor.py`
    - Add pdftotext availability check with warning skip
    - Ensure `make build` invokes `make parse-books` before Docker image creation
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 8.2 Wire merge and cleanup into the CLI post-pipeline phase
    - After all per-book pipelines complete, call merge engine for boons catalog
    - After merge, call stale file cleaner on `src/data/books/`
    - Respect `--dry-run` flag for cleanup
    - _Requirements: 3.10, 10.1, 10.2, 10.3_

- [x] 9. Checkpoint - Ensure build integration works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9A. Verify output equivalence against legacy data
  - [x] 9A.1 Snapshot existing core data before running unified extractor
    - Save copies of `src/data/tables/knacks/*.json`, `src/data/tables/boons/*.json`, `src/data/tables/purviews/*.json`, `src/data/tables/callings/*.json`, `src/data/boons.json`, `src/data/birthrights.json`, `src/data/equipment.json`, `src/data/paths.json`, `src/data/pantheons.json`
    - Store in a temp directory for comparison
    - _Requirements: 6.1_

  - [x] 9A.2 Run unified extractor and diff against snapshot
    - Run `unified_extractor.py` to regenerate all data from PDFs
    - For each output file, compare keys and entry counts against the legacy snapshot
    - Report: entries added (new extraction found more), entries removed (regression), entries changed (field differences)
    - _Requirements: 6.1, 4.3_

  - [x] 9A.3 Generate equivalence report
    - For each category: print `MATCH` (same keys), `SUPERSET` (new has more entries — acceptable), or `REGRESSION` (new is missing entries from legacy — needs investigation)
    - Flag any regressions as blockers before legacy scripts can be deleted
    - Accept `SUPERSET` as passing (new extractor found entries the legacy scripts missed)
    - _Requirements: 6.1, 6.2_

- [x] 10. Property-based tests
  - [x] 10.1 Write property test for PDF resolution precedence
    - **Property 1: PDF Resolution Precedence**
    - **Validates: Requirements 2.1, 2.2**

  - [x] 10.2 Write property test for knack extraction schema conformance
    - **Property 2: Knack Extraction Schema Conformance**
    - **Validates: Requirements 3.1, 8.1**

  - [x] 10.3 Write property test for boon extraction dot rating accuracy
    - **Property 3: Boon Extraction Dot Rating Accuracy**
    - **Validates: Requirements 3.2**

  - [x] 10.4 Write property test for purview extraction ladder invariant
    - **Property 4: Purview Extraction Ladder Invariant**
    - **Validates: Requirements 3.3**

  - [x] 10.5 Write property test for birthright stat block parsing
    - **Property 5: Birthright Stat Block Parsing**
    - **Validates: Requirements 3.5**

  - [x] 10.6 Write property test for equipment tag notation parsing
    - **Property 6: Equipment Tag Notation Parsing**
    - **Validates: Requirements 3.6**

  - [x] 10.7 Write property test for idempotent output
    - **Property 7: Idempotent Output**
    - **Validates: Requirements 4.3**

  - [x] 10.8 Write property test for spec validation correctness
    - **Property 8: Spec Validation Correctness**
    - **Validates: Requirements 7.2, 7.4**

  - [x] 10.9 Write property test for missing category graceful handling
    - **Property 9: Missing Category Graceful Handling**
    - **Validates: Requirements 7.3**

  - [x] 10.10 Write property test for source field format invariant
    - **Property 10: Source Field Format Invariant**
    - **Validates: Requirements 8.1**

  - [x] 10.11 Write property test for meta block structure invariant
    - **Property 11: Meta Block Structure Invariant**
    - **Validates: Requirements 8.2**

  - [x] 10.12 Write property test for merged catalog superset
    - **Property 12: Merged Catalog Superset**
    - **Validates: Requirements 3.10**

  - [x] 10.13 Write property test for regression detection accuracy
    - **Property 13: Regression Detection Accuracy**
    - **Validates: Requirements 9.2**

  - [x] 10.14 Write property test for stale file detection correctness
    - **Property 14: Stale File Detection Correctness**
    - **Validates: Requirements 10.1**

  - [x] 10.15 Write property test for deletion scope safety
    - **Property 15: Deletion Scope Safety**
    - **Validates: Requirements 10.4**

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between major phases
- Property tests use Hypothesis (already configured in the project)
- The existing `parser_framework` module is reused unchanged where possible
- Category extractors can be developed in parallel once the base class (1.3) exists
- Legacy scripts (Requirement 6) become deletable once full pipeline equivalence is verified

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9"] },
    { "id": 3, "tasks": ["5.1", "5.2"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 5, "tasks": ["8.1", "8.2"] },
    { "id": 6, "tasks": ["9A.1"] },
    { "id": 7, "tasks": ["9A.2"] },
    { "id": 8, "tasks": ["9A.3"] },
    { "id": 9, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8", "10.9", "10.10", "10.11", "10.12", "10.13", "10.14", "10.15"] }
  ]
}
```
