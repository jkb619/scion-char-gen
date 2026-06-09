# Requirements Document

## Introduction

Refactor the Scion character creator's PDF parsing pipeline from a collection of copy-paste ingest scripts and ad-hoc extractors into a unified, declarative framework. The framework consolidates shared extraction logic, introduces per-book specification files that describe section anchors and heading patterns as data, provides a validation and regression-detection layer, and exposes a single CLI entrypoint that replaces manual script chaining. The end goal is a pipeline that is robust to PDF formatting changes and maintainable as new source books are added.

## Glossary

- **Parser_Framework**: The unified Python module providing base ingestion, structured extraction, validation, and CLI orchestration for all Scion PDF sources.
- **Book_Spec**: A declarative data file (YAML or JSON) describing a single PDF source — its filename candidates, section anchors, heading patterns, expected fields, and extraction pipeline stages.
- **Ingest_Engine**: The component of the Parser_Framework responsible for extracting raw text from a PDF file using pypdf, inserting page markers, normalizing whitespace, and writing the plain-text output.
- **Extract_Engine**: The component of the Parser_Framework responsible for reading ingested plain text (or using pymupdf for structured parsing), locating sections via Book_Spec anchors, identifying headings, and producing structured JSON output.
- **Validation_Reporter**: The component of the Parser_Framework that compares current extraction output against a stored baseline, detects regressions (missing keys, changed values, count drops), and emits a structured report.
- **Baseline_Snapshot**: A JSON file capturing the keys, counts, and content hashes of a previous successful extraction run, used by the Validation_Reporter for regression detection.
- **CLI_Orchestrator**: The single command-line entrypoint (`scion-parse`) that discovers Book_Specs, resolves PDF paths, and runs the configured pipeline stages (ingest, extract, validate) for one or all books.
- **Section_Anchor**: A pattern or literal string defined in a Book_Spec that identifies where a logical section begins in the extracted text (replacing hard-coded regex per script).
- **Heading_Pattern**: A regex or structural rule defined in a Book_Spec that identifies individual entries within a section (e.g., ALL-CAPS title followed by "Cost:" on the next line).

## Requirements

### Requirement 1: Unified Ingest Engine

**User Story:** As a developer, I want a single reusable ingestion module, so that I do not maintain 8 nearly-identical ingest scripts that differ only in filename tuples and output paths.

#### Acceptance Criteria

1. WHEN a Book_Spec is provided, THE Ingest_Engine SHALL resolve the PDF path by iterating the search directories returned by scion_books_dir (in priority order) and, within each directory, checking the filename candidates listed in the Book_Spec in declaration order, returning the first candidate that exists as a file.
2. WHEN the PDF is found, THE Ingest_Engine SHALL extract plain text from every page using pypdf, prepend a page marker in the format `===== Page N / Total =====` before each page's text, and normalize runs of four or more consecutive newlines down to three.
3. IF the PDF cannot be located in any search directory, THEN THE Ingest_Engine SHALL raise a FileNotFoundError whose message includes the Book_Spec identifier, the candidate filenames that were tried, and the search directories that were checked.
4. THE Ingest_Engine SHALL write the extracted text as UTF-8 to the output path specified in the Book_Spec (defaulting to `src/data/_extracted/<book_id>.txt`), creating parent directories if they do not exist, and overwriting any previously existing file at that path.
5. IF a page extraction raises an exception, THEN THE Ingest_Engine SHALL insert an error marker `[page N: extract error: <message>]` in the output at that page's position and continue processing remaining pages.

### Requirement 2: Declarative Book Specification

**User Story:** As a developer, I want to describe each book's extraction rules as data in a specification file, so that adding a new book requires only a new spec file rather than a new script.

#### Acceptance Criteria

1. THE Parser_Framework SHALL load Book_Specs from all YAML (`.yaml`/`.yml`) and JSON (`.json`) files found in the `src/scripts/book_specs/` directory.
2. THE Book_Spec SHALL declare the following required fields: a unique book identifier (alphanumeric plus underscores, 1–64 characters), a tuple of one or more candidate PDF filenames, an output path for ingested text, a list of one or more Section_Anchors (each specifying pattern type and literal or regex value), a list of one or more Heading_Patterns, expected output fields per entry, and the extraction pipeline stages to run (ordered subset of `ingest`, `extract`, `validate`).
3. WHEN a Book_Spec contains a missing required field, a book identifier that duplicates another loaded spec, an empty filename tuple, or a pipeline stage name not in the allowed set, THE Parser_Framework SHALL raise a validation error at load time that identifies the spec file and the specific field or value that failed validation.
4. THE Parser_Framework SHALL support two Section_Anchor pattern types: literal string match (case-insensitive, whitespace-normalized) and Python-`re`-compatible regex match (case-sensitive by default, with an optional case-insensitive flag per anchor).
5. THE Parser_Framework SHALL support alias mappings in Section_Anchors, so that a single logical section can be located by any of multiple candidate strings, matched in the order declared in the spec and stopping at the first successful match.
6. WHEN two or more Book_Spec files in the `src/scripts/book_specs/` directory declare the same book identifier, THE Parser_Framework SHALL raise a validation error at load time identifying both conflicting files and the duplicate identifier.

### Requirement 3: Structured Extraction Engine

**User Story:** As a developer, I want the extraction logic (section-finding, heading-normalization, field extraction) to be shared and driven by Book_Spec declarations, so that duplicate code in extract scripts is eliminated.

#### Acceptance Criteria

1. WHEN a Section_Anchor is provided, THE Extract_Engine SHALL locate the first matching position in the ingested text and determine the section boundary as the position of the next Section_Anchor match or end of text; IF a Section_Anchor matches more than one position, THEN THE Extract_Engine SHALL use the first occurrence.
2. WHEN a Heading_Pattern is provided, THE Extract_Engine SHALL identify all entry headings within the section boundary and extract the text block between consecutive headings; for the last heading in a section, the text block SHALL extend to the section boundary.
3. THE Extract_Engine SHALL normalize headings by applying, in order: Unicode NFKD decomposition, soft-hyphen (`U+00AD`) removal, en-dash replacement with ASCII hyphen, smart-quote (`U+2018`, `U+2019`, `U+201C`, `U+201D`) replacement with their ASCII equivalents, conversion to uppercase, and collapsing of consecutive whitespace to a single space.
4. WHEN a Book_Spec specifies expected fields, THE Extract_Engine SHALL scan each entry block for lines matching the pattern `<FieldName><separator><value>` where separator is a colon optionally followed by whitespace, extract the first matching line per field, collapse interior whitespace in the value to single spaces, and return the results as a dictionary keyed by field name.
5. IF an expected field is not found in an entry block, THEN THE Extract_Engine SHALL set that field's value to `null` in the returned dictionary and record the miss in a structured log entry containing the entry identifier, the field name searched, and a reason code from the set: `not_found`, `section_missing`, `heading_unmatched`.
6. THE Extract_Engine SHALL support both pypdf-based plain-text extraction mode and pymupdf-based structured extraction mode, selectable per Book_Spec stage; IF no extraction mode is specified in the Book_Spec stage, THEN THE Extract_Engine SHALL default to pypdf-based plain-text mode.
7. IF a Section_Anchor defined in the Book_Spec cannot be located in the ingested text after normalization, THEN THE Extract_Engine SHALL record the miss in the structured log with reason code `section_missing` and skip extraction for that section without halting the overall pipeline.

### Requirement 4: Validation and Regression Reporting

**User Story:** As a developer, I want extraction runs to be compared against a known-good baseline, so that I can detect regressions when PDFs are revised or extraction logic changes.

#### Acceptance Criteria

1. WHEN an extraction completes successfully (no error-level failures for the book), THE Validation_Reporter SHALL compare the output against the Baseline_Snapshot for the same book and table, stored at `src/data/_baselines/<book_id>/<table_name>.json`.
2. WHEN the current output contains fewer keys than the Baseline_Snapshot, THE Validation_Reporter SHALL flag each missing key as a regression with severity "missing_entry".
3. WHEN the current output contains keys not present in the Baseline_Snapshot, THE Validation_Reporter SHALL flag each new key as an addition with severity "new_entry".
4. WHEN the content hash of an entry differs from the Baseline_Snapshot, THE Validation_Reporter SHALL flag the entry as changed with severity "content_changed" and include both the old and new hash.
5. THE Validation_Reporter SHALL emit a structured JSON report to `src/data/_baselines/<book_id>/<table_name>.report.json` containing: book identifier, table name, timestamp, total entries, count of regressions by severity, and a list of flagged entries.
6. WHEN the `--update-baseline` flag is passed, THE Validation_Reporter SHALL overwrite the Baseline_Snapshot with the current output after reporting.
7. IF no Baseline_Snapshot exists for a book and table, THEN THE Validation_Reporter SHALL create a new baseline from the current output and report zero regressions.
8. IF an extraction completes with error-level failures for a book, THEN THE Validation_Reporter SHALL skip validation for that book and report a "skipped_due_to_errors" status.

### Requirement 5: Unified CLI Entrypoint

**User Story:** As a developer, I want a single CLI command that can run the full pipeline or individual stages for one or all books, so that I no longer need to chain multiple scripts manually.

#### Acceptance Criteria

1. THE CLI_Orchestrator SHALL provide a command `scion-parse` (or `python -m scripts.parse`) accepting subcommands: `ingest`, `extract`, `validate`, and `run` (which executes all three in sequence).
2. WHEN the `--book` option is provided with a value matching a Book_Spec identifier, THE CLI_Orchestrator SHALL run the specified stage only for that book; WHEN `--book` is omitted, THE CLI_Orchestrator SHALL run the stage for all Book_Specs discovered from the `src/scripts/book_specs/` directory.
3. IF the `--book` option specifies an identifier that does not match any discovered Book_Spec, THEN THE CLI_Orchestrator SHALL exit with exit code 1 and print an error message indicating the unknown identifier and listing the available Book_Spec identifiers.
4. WHEN the `run` subcommand is invoked, THE CLI_Orchestrator SHALL execute stages in order: ingest → extract → validate, halting on the first stage that produces an error; output files written by previously completed stages SHALL be retained on disk.
5. THE CLI_Orchestrator SHALL accept a `--books-dir` option and a `SCION_BOOKS_DIR` environment variable for PDF directory resolution, applying the existing search-order precedence: `--books-dir` override first, then `SCION_BOOKS_DIR` environment variable, then `<repo>/books`, then `<repo>/../books`, then the WSL legacy path.
6. WHEN a stage completes for a book, THE CLI_Orchestrator SHALL print a single summary line to stdout containing: the book identifier, the stage name, the status (`ok`, `warning`, or `error`), and an integer count of entries processed (for `ok` or `warning` status) or issues found (for `error` status).
7. THE CLI_Orchestrator SHALL return exit code 0 when all stages for all targeted books complete with status `ok` or `warning`, and exit code 1 when any stage for any book produces status `error`.
8. WHEN running for multiple books and a stage produces an error for one book, THE CLI_Orchestrator SHALL continue processing remaining books for that stage, report all results, and then return exit code 1 without advancing to the next stage in a `run` invocation.
9. IF no Book_Specs are discovered in the `src/scripts/book_specs/` directory, THEN THE CLI_Orchestrator SHALL exit with exit code 1 and print an error message indicating that no Book_Spec files were found.

### Requirement 6: Robustness to PDF Formatting Changes

**User Story:** As a developer, I want the extraction pipeline to tolerate minor formatting shifts in revised PDFs (page reflows, whitespace changes, heading case variations), so that a book revision does not silently break extraction.

#### Acceptance Criteria

1. WHEN matching a Section_Anchor, THE Extract_Engine SHALL apply Unicode NFKD normalization and whitespace-insensitive comparison (collapsing all consecutive Unicode whitespace characters to a single space and trimming leading/trailing whitespace) before falling back to fuzzy matching as defined in criterion 2.
2. WHEN a Section_Anchor cannot be found after normalized comparison, THE Extract_Engine SHALL attempt a fuzzy match by computing the Levenshtein distance between the normalized anchor and each normalized line in the ingested text, accepting the first line with distance ≤ 2, and SHALL log a structured warning containing the Book_Spec identifier, the original anchor text, the matched line text, and the computed distance.
3. IF a Section_Anchor cannot be found by either normalized or fuzzy matching, THEN THE Extract_Engine SHALL record the failure in the structured log (Book_Spec identifier, anchor text, reason code "anchor_not_found") and skip that section without halting extraction of remaining sections.
4. THE Extract_Engine SHALL remove page-header noise lines from section text before heading and field extraction, where a noise line is any line matching the noise-line regex defined in the Book_Spec for that book.
5. WHEN heading normalization produces a match that differs from the raw PDF text only in case, whitespace, or smart-quote variants (curly quotes U+2018, U+2019, U+201C, U+201D replaced with ASCII equivalents), THE Extract_Engine SHALL treat the match as valid without emitting a warning.

### Requirement 7: Backward-Compatible Output

**User Story:** As a developer, I want the new framework to produce output files identical in schema and path to the current scripts, so that downstream consumers (data_tables service, generate_boons_catalog) continue to work without modification.

#### Acceptance Criteria

1. THE Parser_Framework SHALL write extracted JSON to the same output paths currently used by the existing scripts: `src/data/boonPbMechanics.json` for standalone files and `src/data/tables/<tableName>/<fragmentFilename>.json` for table fragments, where `<fragmentFilename>` matches the filenames registered in `PRIMARY_FRAGMENT` within `data_tables.py`.
2. THE Parser_Framework SHALL produce output JSON that is structurally equivalent to the existing scripts' output: identical top-level keys (including `_meta`), identical entry key naming convention (`{purview}_dot_{NN}` with zero-padded two-digit numbers), identical field names within entries (e.g., `description`, `mechanicalEffects`), and identical value types per field.
3. THE Parser_Framework SHALL write output JSON encoded as UTF-8 with 2-space indentation and a trailing newline, matching the formatting of the existing output files.
4. WHEN the `--dry-run` flag is provided, THE CLI_Orchestrator SHALL print one summary line per output file reporting the target path, the number of entries that would be written, and the number of entries changed compared to the file currently on disk, without writing or modifying any output files.
5. THE Parser_Framework SHALL maintain the existing `scion_books_dir` search-order behavior: explicit `--books-dir` argument first, then `SCION_BOOKS_DIR` environment variable, then `<repo>/books`, then `<repo>/../books` (sibling directory), then the WSL legacy path `/mnt/c/Users/John/Desktop/Scion/books`.
6. IF an output file produced by the Parser_Framework is loaded by `data_tables.load_merged_table`, THEN the resulting merged dictionary SHALL contain the same keys and value types as when the file was produced by the existing scripts.

### Requirement 8: Pretty-Printer for Book Specs

**User Story:** As a developer, I want to generate a skeleton Book_Spec from an existing ingest script, so that migration to the new framework is assisted rather than fully manual.

#### Acceptance Criteria

1. WHEN given the path to an existing ingest script, THE CLI_Orchestrator SHALL parse the script's PDF path constants and output path variable, and emit a skeleton Book_Spec file to the Book_Spec directory (`src/scripts/book_specs/`) named `<book_id>.yaml`, pre-populated with the discovered filename candidates and output path.
2. IF the provided script does not contain a recognizable PDF path constant or output path variable, THEN THE CLI_Orchestrator SHALL exit with a non-zero status and an error message indicating which expected element could not be located.
3. THE Pretty_Printer SHALL format Book_Spec files using 2-space indentation and a fixed field order matching the Book_Spec schema declaration order (book_id, filenames, output_path, section_anchors, heading_patterns, expected_fields, pipeline_stages).
4. THE Pretty_Printer SHALL produce output such that deserializing a valid Book_Spec, pretty-printing it, and deserializing the result yields an object with identical field names and values (deep equality) to the original.
