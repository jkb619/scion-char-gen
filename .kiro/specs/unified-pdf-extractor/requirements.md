# Requirements Document

## Introduction

The Unified PDF Extractor consolidates all Scion character creator PDF parsing into a single orchestrated pipeline. It replaces the fragmented set of ingest, extraction, and catalog-generation scripts with one entry point that reads every Scion PDF from a configured directory and produces every game-data JSON file the application consumes. The result is a deterministic, repeatable build step: PDFs present in the books directory are the sole source of truth for game data.

## Glossary

- **Extractor**: The unified Python script/module that orchestrates the full pipeline from PDF ingestion through structured extraction to JSON output.
- **Books_Directory**: The filesystem directory containing Scion PDF files, resolved via `SCION_BOOKS_DIR` environment variable, `<repo>/books`, `<repo>/../books`, or an explicit CLI argument.
- **Book_Spec**: A YAML configuration file in `src/scripts/book_specs/` that declares how a specific PDF is ingested, what data categories it contains, and where its output JSON files are written.
- **Ingestion**: The stage that extracts raw plaintext from a PDF file using `pdftotext` or PyMuPDF.
- **Extraction**: The stage that applies structured parsing (regex patterns, section anchors, heading patterns) to ingested text to produce typed game-data entries.
- **Validation**: The stage that compares extraction output against baseline snapshots to detect regressions.
- **Game_Data_Category**: One of: knacks, boons, purviews, birthrights, equipment, callings, paths, pantheons, book_slices.
- **Output_Manifest**: The complete set of JSON files the Extractor writes to `src/data/` and `src/data/tables/` subdirectories.
- **Pipeline**: The ordered sequence of stages: ingestion → extraction → validation → output writing.
- **Build_Integration**: The incorporation of the Extractor into the project's `make build` and `make parse-books` targets.

## Requirements

### Requirement 1: Single Entry Point Execution

**User Story:** As a developer, I want one command that processes all PDFs, so that I do not need to remember or orchestrate multiple scripts.

#### Acceptance Criteria

1. THE Extractor SHALL provide a single CLI command that processes all Book_Specs found in the book_specs directory.
2. WHEN invoked with no arguments, THE Extractor SHALL discover all PDFs in the Books_Directory and run the full Pipeline for each matching Book_Spec.
3. WHEN invoked with a `--book BOOK_ID` argument, THE Extractor SHALL run the Pipeline only for the specified Book_Spec.
4. WHEN invoked with a `--books-dir DIR` argument, THE Extractor SHALL use DIR as the Books_Directory instead of the default resolution order.

### Requirement 2: PDF Discovery and Resolution

**User Story:** As a developer, I want the extractor to find PDFs regardless of where I store them, so that I can organize my files flexibly.

#### Acceptance Criteria

1. THE Extractor SHALL search for PDFs using the following precedence: explicit `--books-dir` argument, `SCION_BOOKS_DIR` environment variable, `<repo>/books`, `<repo>/../books`.
2. WHEN multiple filename variants exist for a single Book_Spec, THE Extractor SHALL accept the first matching filename found in the Books_Directory.
3. WHEN a Book_Spec's PDF is not found in any searched directory, THE Extractor SHALL skip that book and report it as missing without halting the overall run.
4. THE Extractor SHALL support all known PDF filename variants defined in the Book_Spec's `filenames` list.

### Requirement 3: Complete Game Data Extraction

**User Story:** As a developer, I want all game data categories extracted from every supported PDF, so that the app has complete data without manual curation.

#### Acceptance Criteria

1. THE Extractor SHALL extract knacks from PDFs that contain calling-organized knack sections, producing JSON files in `src/data/tables/knacks/`.
2. THE Extractor SHALL extract boons with dot ratings and purview associations from PDFs that contain boon ladders, producing JSON files in `src/data/tables/boons/`.
3. THE Extractor SHALL extract purview definitions with innate power descriptions, producing JSON files in `src/data/tables/purviews/`.
4. THE Extractor SHALL extract calling definitions from PDFs that contain calling sections, producing JSON files in `src/data/tables/callings/`.
5. THE Extractor SHALL extract birthright entries (relics, creatures, followers, guides) with stat blocks, producing `src/data/birthrights.json`.
6. THE Extractor SHALL extract equipment entries with weapon and armor tags, producing `src/data/equipment.json`.
7. THE Extractor SHALL extract path definitions (origin, role, society) with skills and connections, producing `src/data/paths.json`.
8. THE Extractor SHALL extract pantheon data, producing `src/data/pantheons.json`.
9. THE Extractor SHALL produce per-book bundle slices for supplement and 3rd-party books, writing to `src/data/books/<slug>.json`.
10. THE Extractor SHALL generate a merged boon catalog at `src/data/boons.json` by combining boon entries from all processed PDFs.

### Requirement 4: Deterministic Regeneration

**User Story:** As a developer, I want the output to be fully determined by which PDFs are present, so that builds are reproducible and I can add or remove books by adding or removing files.

#### Acceptance Criteria

1. WHEN a PDF is added to the Books_Directory and the Extractor is re-run, THE Extractor SHALL produce the corresponding output JSON files for that book.
2. WHEN a PDF is removed from the Books_Directory and the Extractor is re-run, THE Extractor SHALL remove or not produce the corresponding output JSON files for that book.
3. WHEN the Extractor is run twice with the same set of PDFs, THE Extractor SHALL produce byte-identical output JSON files.
4. THE Extractor SHALL not depend on previously generated JSON files as input; all output SHALL be derived solely from PDF content and Book_Spec configuration.

### Requirement 5: Build System Integration

**User Story:** As a developer, I want the extractor to run automatically during builds, so that I never deploy stale data.

#### Acceptance Criteria

1. THE Build_Integration SHALL invoke the Extractor as part of the `make parse-books` target.
2. THE Build_Integration SHALL invoke `make parse-books` before Docker image creation in the `make build` target.
3. WHEN `pdftotext` is not installed, THE Build_Integration SHALL print a warning and skip extraction without failing the build.
4. THE Extractor SHALL complete processing of all Book_Specs within a duration proportional to the number of PDFs, targeting under 60 seconds for the full corpus on a standard development machine.

### Requirement 6: Replacement of Legacy Scripts

**User Story:** As a developer, I want the unified extractor to replace all existing extraction scripts, so that there is only one way to generate game data.

#### Acceptance Criteria

1. THE Extractor SHALL produce output equivalent to the combined output of: `build_book_bundle_slices.py`, `ingest_pandoras_box_pdf.py`, `ingest_scion_origin_pdf.py`, `ingest_scion_hero_pdf.py`, `ingest_masks_of_the_mythos_pdf.py`, `ingest_mysteries_of_the_world_pdf.py`, `ingest_saints_monsters_pdf.py`, `ingest_scion_dragon_pdf.py`, `ingest_titans_rising_pdf.py`, `sync_pandoras_box_data.py`, `extract_pb_boon_ladders.py`, `extract_pb_boon_mechanics.py`, `generate_boons_catalog.py`, and `sync_boon_catalog_from_local_books.py`.
2. WHEN the Extractor is operational, THE legacy scripts listed above SHALL be deletable without affecting application functionality.
3. THE Extractor SHALL reuse the existing `parser_framework` module (ingest_engine, extract_engine, validation_reporter, output_writer, spec_loader) as its internal implementation.

### Requirement 7: Book Spec Driven Configuration

**User Story:** As a developer, I want to add support for a new PDF by creating a YAML spec file, so that no code changes are needed to ingest a new book.

#### Acceptance Criteria

1. WHEN a new Book_Spec YAML file is added to the `book_specs/` directory, THE Extractor SHALL include that book in subsequent runs without code modification.
2. THE Book_Spec SHALL declare: the book identifier, accepted PDF filenames, output paths for each Game_Data_Category, section anchors, heading patterns, expected fields, and pipeline stages.
3. WHEN a Book_Spec references a Game_Data_Category that the book does not contain, THE Extractor SHALL produce an empty result for that category without error.
4. THE Extractor SHALL validate Book_Spec YAML files at load time and report structural errors before beginning extraction.

### Requirement 8: Source Provenance Tracking

**User Story:** As a developer, I want every extracted entry to record which PDF and page it came from, so that I can verify data against the source material.

#### Acceptance Criteria

1. THE Extractor SHALL include a `source` field in every extracted entry containing the PDF filename and page number in the format `<filename> p.<page_number>`.
2. THE Extractor SHALL include a `_meta` block in each output JSON file containing the source PDF filename, book slug, and book title.
3. WHEN an entry spans multiple pages, THE Extractor SHALL record the page number where the entry heading appears.

### Requirement 9: Error Handling and Reporting

**User Story:** As a developer, I want clear feedback when extraction encounters problems, so that I can diagnose issues without reading code.

#### Acceptance Criteria

1. WHEN a PDF cannot be parsed due to corruption or incompatible format, THE Extractor SHALL report the error with the PDF filename and continue processing remaining books.
2. WHEN extraction produces fewer entries than the baseline snapshot for a Book_Spec, THE Extractor SHALL report a regression warning listing the missing entry identifiers.
3. WHEN the `--verbose` flag is provided, THE Extractor SHALL write a detailed extraction log to `src/data/_extracted/<book_id>.log.json` for each processed book.
4. THE Extractor SHALL return exit code 0 when all books process without errors, and exit code 1 when any book encounters an unrecoverable error.
5. IF PyMuPDF is not installed and a Book_Spec requires `pymupdf` extraction mode, THEN THE Extractor SHALL report the missing dependency and skip that book.

### Requirement 10: Output Cleanup for Removed Books

**User Story:** As a developer, I want stale data files removed automatically when I remove a PDF, so that the app never serves data from deleted sources.

#### Acceptance Criteria

1. WHEN the Extractor runs, THE Extractor SHALL identify output files in `src/data/books/` that do not correspond to any currently present PDF.
2. WHEN stale output files are identified, THE Extractor SHALL delete the stale files.
3. WHEN the `--dry-run` flag is provided, THE Extractor SHALL report which files would be deleted without performing deletion.
4. THE Extractor SHALL only delete files within the `src/data/books/` directory during cleanup; files in `src/data/tables/` and `src/data/` root SHALL be overwritten rather than deleted.
