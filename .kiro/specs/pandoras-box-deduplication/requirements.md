# Requirements Document

## Introduction

When the Scion PDF extraction pipeline processes Pandora's Box alongside other source books, many game-data entries (knacks, boons, purviews, callings) appear in both. This feature adds deduplication logic to the merge stage so that duplicates are collapsed into a single canonical entry. The non-Pandora's Box version supplies the field values (name, description, mechanicalEffects, etc.), while the `source` field is merged into a comma-separated list citing both locations.

## Glossary

- **Merge_Engine**: The Python module at `src/scripts/merge_engine.py` that combines per-book fragment JSON files into unified output files.
- **Fragment**: A single per-book JSON file within `src/data/tables/{category}/` containing extracted game-data entries keyed by `id`.
- **Pandoras_Box_Fragment**: A Fragment whose entries originate from the Pandora's Box PDF, identifiable by filename prefix or book slug (e.g., `pandoras_box`).
- **Canonical_Entry**: The entry chosen as the authoritative version when a duplicate is detected — always the non-Pandora's Box version.
- **Duplicate**: Two entries across different Fragments that share the same `id` value within the same table category.
- **Source_Field**: The `source` string on each entry recording the PDF filename and page/section reference where the entry was found.
- **Deduplication**: The process of detecting Duplicates and collapsing them into a single Canonical_Entry with a merged Source_Field.

## Requirements

### Requirement 1: Duplicate Detection by ID

**User Story:** As a developer, I want the merge engine to detect when the same entry appears in both Pandora's Box and another source book, so that the pipeline does not produce redundant entries in the output.

#### Acceptance Criteria

1. WHEN two or more Fragments within the same table category contain entries with the same `id` value, THE Merge_Engine SHALL identify those entries as Duplicates.
2. THE Merge_Engine SHALL perform Duplicate detection across all Fragments within a single table category (knacks, boons, purviews, callings).
3. WHEN a Duplicate is detected between a Pandoras_Box_Fragment and a non-Pandora's Box Fragment, THE Merge_Engine SHALL treat the pair as a Pandora's Box duplicate requiring deduplication.
4. WHEN a Duplicate is detected between two non-Pandora's Box Fragments, THE Merge_Engine SHALL retain the later-sorted Fragment's entry (preserving existing last-wins behavior).

### Requirement 2: Canonical Entry Selection

**User Story:** As a developer, I want the non-Pandora's Box version of a duplicated entry to be the canonical version, so that the most authoritative source's text is used in the application.

#### Acceptance Criteria

1. WHEN a Pandora's Box duplicate is detected, THE Merge_Engine SHALL select the non-Pandora's Box entry as the Canonical_Entry.
2. THE Canonical_Entry SHALL retain all field values (name, description, mechanicalEffects, dot, tierMin, callings, purview, and all other fields) from the non-Pandora's Box Fragment.
3. WHEN multiple non-Pandora's Box Fragments contain the same `id`, THE Merge_Engine SHALL select the entry from the last-sorted Fragment as the Canonical_Entry.

### Requirement 3: Source Field Merging

**User Story:** As a developer, I want the source field of a deduplicated entry to cite both the original book and Pandora's Box, so that users can look up the entry in either PDF.

#### Acceptance Criteria

1. WHEN a Pandora's Box duplicate is resolved, THE Merge_Engine SHALL set the Canonical_Entry's `source` field to a comma-separated list containing the source values from all Fragments that contained the entry.
2. THE Merge_Engine SHALL place the non-Pandora's Box source value first in the comma-separated list, followed by the Pandoras_Box_Fragment source value.
3. THE Merge_Engine SHALL separate multiple source values with a comma and a single space (`, `).
4. WHEN an entry exists in more than two Fragments (e.g., two non-Pandora's Box sources plus Pandora's Box), THE Merge_Engine SHALL include all source values in the merged `source` field, ordered with non-Pandora's Box sources first (in Fragment sort order) followed by the Pandora's Box source last.

### Requirement 4: Pandora's Box Fragment Identification

**User Story:** As a developer, I want the system to reliably identify which fragments come from Pandora's Box, so that deduplication logic is applied correctly.

#### Acceptance Criteria

1. THE Merge_Engine SHALL identify a Fragment as a Pandoras_Box_Fragment when the Fragment's filename contains the substring `Pandoras_Box` (case-insensitive match).
2. WHEN a Fragment's `_meta` block contains a `bookSlug` field equal to `pandoras_box`, THE Merge_Engine SHALL also identify that Fragment as a Pandoras_Box_Fragment.
3. THE Merge_Engine SHALL support identification by either filename pattern or `_meta.bookSlug` field, treating a match on either criterion as sufficient.

### Requirement 5: Non-Duplicate Pandora's Box Entries Preserved

**User Story:** As a developer, I want entries that appear only in Pandora's Box (not in any other source) to remain in the output, so that content unique to that supplement is not lost.

#### Acceptance Criteria

1. WHEN a Pandoras_Box_Fragment entry has an `id` that does not appear in any other Fragment within the same table category, THE Merge_Engine SHALL include that entry in the merged output unchanged.
2. THE Merge_Engine SHALL preserve the original `source` field value for non-duplicate Pandora's Box entries without modification.

### Requirement 6: Deterministic Output After Deduplication

**User Story:** As a developer, I want the deduplicated output to remain deterministic, so that builds are reproducible regardless of fragment processing order.

#### Acceptance Criteria

1. THE Merge_Engine SHALL produce byte-identical output when run multiple times with the same set of Fragments.
2. THE Merge_Engine SHALL sort entries by `id` key in the merged output after deduplication.
3. WHEN two Fragments contain entries with the same `id`, THE Merge_Engine SHALL produce the same merged result regardless of the order in which Fragments are read from disk.

### Requirement 7: Deduplication Reporting

**User Story:** As a developer, I want visibility into which entries were deduplicated, so that I can verify the pipeline is correctly collapsing duplicates.

#### Acceptance Criteria

1. WHEN deduplication removes one or more Pandora's Box duplicate entries, THE Merge_Engine SHALL record the count of deduplicated entries in the output `_meta` block under a `deduplicatedCount` key.
2. WHEN the `--verbose` flag is active, THE Merge_Engine SHALL log each deduplicated entry's `id` and the Fragments involved to the extraction log.
3. THE Merge_Engine SHALL include a `deduplicatedIds` list in the `_meta` block containing the `id` values of all entries that were deduplicated.
