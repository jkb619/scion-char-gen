# Requirements Document

## Introduction

The Book Source Filter feature adds a UI panel with checkboxes for each Scion sourcebook. Users select which books are "allowed" for their character, and the app filters all picker dropdowns, chip selectors, and catalog tables throughout the chargen wizard so only content from permitted sources appears. This lets players and storytellers enforce table-level book restrictions (e.g., "core only" or "no community supplements") without manually skipping unwanted entries.

## Glossary

- **Book_Source_Filter**: The UI component (checkbox panel) that lets a user enable or disable individual sourcebooks for the current character session.
- **Allowed_Books_Set**: The collection of sourcebook identifiers currently selected (checked) by the user; only data entries whose source matches a member of this set are shown in pickers.
- **Source_Tag**: The `source` or `sourceBook` field on a game-data entry (boon, knack, birthright, equipment, purview, path, calling, etc.) that identifies which PDF or supplement the entry originates from.
- **Bundle**: The merged JSON payload containing all game data tables, served to the frontend at load time.
- **Picker**: Any UI element (dropdown, chip list, table row selector) where the user chooses game-data entries during character creation.
- **Chargen_Wizard**: The step-by-step character creation interface in the single-page app.
- **Source_Registry**: A canonical list of all known sourcebook identifiers with their human-readable display titles, used to populate the Book_Source_Filter checkboxes.

## Requirements

### Requirement 1: Source Registry Definition

**User Story:** As a developer, I want a single canonical registry mapping sourcebook identifiers to display titles, so that the filter panel and filtering logic share one consistent list of recognized books.

#### Acceptance Criteria

1. THE Source_Registry SHALL contain an entry for each sourcebook that has tagged data in the Bundle, including at minimum: Pandora's Box (Revised), Scion Origin, Scion Hero, Scion Demigod, Scion God, Scion Dragon, Dragon Companion, Mysteries of the World, Masks of the Mythos, Saints & Monsters, Titans Rising, Once and Future, Divine Armory, Divine Garage, Divine Menagerie, Divine Reliquary, Divine Arenas, Divine Identities, Reconditioned, and Scion Britannia's Dragons.
2. WHEN a new book data file is added to the `src/data/books/` directory, THE Source_Registry SHALL include an entry for that book without requiring code changes to the filter logic.
3. THE Source_Registry SHALL map each entry from one or more Source_Tag string patterns (PDF filenames, slugs) to exactly one human-readable display title.
4. IF a book data file in `src/data/books/` is malformed or contains no valid Source_Tag patterns, THEN THE Source_Registry SHALL skip that file and log a warning without preventing other books from loading.

### Requirement 2: Book Source Filter UI Panel

**User Story:** As a player, I want a panel of checkboxes (one per sourcebook) so that I can pick which books my character is allowed to draw from.

#### Acceptance Criteria

1. THE Book_Source_Filter SHALL render one labeled checkbox per Source_Registry entry, sorted alphabetically by display title.
2. WHEN the Chargen_Wizard loads and no previously saved Allowed_Books_Set exists in the character state, THE Book_Source_Filter SHALL have all checkboxes checked (all books enabled) by default.
3. WHEN the user unchecks a book checkbox, THE Book_Source_Filter SHALL remove that book from the Allowed_Books_Set within the same UI render cycle, without requiring a page reload.
4. WHEN the user re-checks a book checkbox, THE Book_Source_Filter SHALL add that book back to the Allowed_Books_Set within the same UI render cycle, without requiring a page reload.
5. THE Book_Source_Filter SHALL provide a "Select All" control that checks all book checkboxes in one action.
6. THE Book_Source_Filter SHALL provide a "Deselect All" control that unchecks all book checkboxes in one action.
7. THE Book_Source_Filter SHALL be visible and operable from any wizard step without navigating away from the current step or losing unsaved form input on that step.
8. IF the user attempts to deselect all books (either manually or via "Deselect All"), THEN THE Book_Source_Filter SHALL allow the empty selection and the Allowed_Books_Set SHALL become empty, resulting in Pickers showing no source-tagged entries.
9. WHEN the user activates the Book_Source_Filter panel, THE Chargen_Wizard SHALL display the panel as a collapsible or overlay element that does not replace the current wizard step content.

### Requirement 3: Filtering All Pickers by Allowed Books

**User Story:** As a player, I want every dropdown and selectable option in the chargen wizard to show only entries from my allowed books, so that I never accidentally pick content from a disallowed source.

#### Acceptance Criteria

1. WHEN the Allowed_Books_Set changes, THE Chargen_Wizard SHALL hide entries whose resolved Source_Tag does not match any book in the Allowed_Books_Set from all currently visible Pickers within 200 milliseconds, without rebuilding the wizard step or losing scroll position.
2. THE Chargen_Wizard SHALL apply the book filter to Purview pickers, Boon pickers, Knack pickers, Birthright pickers, Equipment pickers, Path pickers, Calling pickers, and Pantheon pickers.
3. WHEN the user navigates to a wizard step containing Pickers that were not visible at the time of the last Allowed_Books_Set change, THE Chargen_Wizard SHALL apply the current book filter to those Pickers before they become interactive.
4. IF an entry has no Source_Tag (null, empty string, or the field is absent from the data object), THEN THE Chargen_Wizard SHALL display that entry regardless of the Allowed_Books_Set state.
5. WHEN a data entry's Source_Tag resolves to more than one Source_Registry identifier (because the raw source string references multiple books), THE Chargen_Wizard SHALL display the entry if at least one resolved identifier is present in the Allowed_Books_Set.
6. IF the book filter reduces a Picker's visible entries to zero, THEN THE Chargen_Wizard SHALL display that Picker in a disabled state with a message indicating no entries are available for the current book selection.

### Requirement 4: Persistence of Filter Selection

**User Story:** As a player, I want my book filter selection saved with my character data, so that when I export and re-import a character the same book restrictions are restored.

#### Acceptance Criteria

1. THE Book_Source_Filter SHALL store the Allowed_Books_Set as an array of Source_Registry identifiers in the character state object alongside other wizard state.
2. WHEN a character is exported to JSON, THE Book_Source_Filter selection SHALL be included in the exported payload as the Allowed_Books_Set array.
3. WHEN a character JSON is imported and the payload contains an Allowed_Books_Set array, THE Chargen_Wizard SHALL restore the Allowed_Books_Set from the imported data and apply the filter to all Pickers before the wizard renders.
4. IF an imported character JSON does not contain an Allowed_Books_Set field (e.g., older exports), THEN THE Chargen_Wizard SHALL default all books to enabled (all checkboxes checked).
5. IF an imported character references book identifiers not present in the current Source_Registry, THEN THE Book_Source_Filter SHALL ignore unknown identifiers and leave those checkboxes unchecked.

### Requirement 5: Conflict Handling for Already-Selected Options

**User Story:** As a player, I want to be warned when I disable a book that provides content already selected on my character, so that I can decide whether to remove those picks or keep the book enabled.

#### Acceptance Criteria

1. WHEN the user unchecks a book and that book is the source for one or more currently-selected character options (boons, knacks, birthrights, equipment, purviews, paths, or callings), THE Book_Source_Filter SHALL display a modal warning that lists the affected selections and prevents further interaction with the wizard until the user confirms or cancels.
2. THE warning message SHALL identify each affected selection by name and type, formatted as "Type: Name — Book Title" (e.g., "Boon: Aesthetic Improvement — Pandora's Box"), grouped by option type.
3. WHEN the user unchecks a book that is not the source for any currently-selected character option, THE Book_Source_Filter SHALL immediately remove that book from the Allowed_Books_Set without displaying a warning.
4. WHILE the conflict warning is displayed, THE Book_Source_Filter SHALL keep the unchecked book in the Allowed_Books_Set until the user confirms or cancels.
5. WHEN the user confirms the book removal despite conflicts, THE Chargen_Wizard SHALL remove all conflicting selections from the character state and remove the book from the Allowed_Books_Set.
6. WHEN the user cancels the book removal, THE Book_Source_Filter SHALL re-check the checkbox and leave both the Allowed_Books_Set and the character state unchanged.

### Requirement 6: Source Tag Resolution

**User Story:** As a developer, I want a deterministic mapping from any Source_Tag string to a Source_Registry book identifier, so that filtering works consistently regardless of how sources are recorded in different data files.

#### Acceptance Criteria

1. THE Source_Tag resolver SHALL attempt resolution strategies in the following priority order: (a) exact slug match against Source_Registry `slug` values, (b) PDF filename match by extracting the filename token (text ending in `.pdf`, ignoring any trailing page reference such as ` p.26`), (c) case-insensitive substring match of Source_Registry display titles against the Source_Tag string.
2. THE Source_Tag resolver SHALL use case-insensitive comparison for all matching strategies.
3. WHEN a Source_Tag string matches multiple Source_Registry entries during substring title matching, THE Source_Tag resolver SHALL select the entry whose display title is the longest match (most specific).
4. WHEN a Source_Tag string contains multiple book references separated by semicolons, THE Source_Tag resolver SHALL resolve each segment independently and return all matched Source_Registry identifiers.
5. WHEN a Source_Tag string cannot be resolved to any Source_Registry entry after all strategies are attempted, THE Source_Tag resolver SHALL treat the entry as unfiltered (always visible).
6. THE Source_Tag resolver SHALL return at most one Source_Registry identifier per resolution segment (excluding the multi-reference case), guaranteeing a deterministic one-to-one mapping.

### Requirement 7: Bundle Augmentation with Normalized Source Identifiers

**User Story:** As a developer, I want each Bundle entry augmented with a normalized source book identifier at load time, so that the frontend filter can use a simple set-membership check without repeated string parsing.

#### Acceptance Criteria

1. WHEN the Bundle is assembled, THE game data service SHALL add a `_sourceBookId` field to each entry in the equipment, tags, birthrights, boons, knacks, purviews, callings, and paths tables that has a resolvable Source_Tag or `sourceBook` slug.
2. IF an entry already carries a `sourceBook` slug that matches a Source_Registry identifier, THEN THE game data service SHALL use that slug directly as the `_sourceBookId` value without invoking free-text resolution.
3. IF an entry has no `sourceBook` slug but has a `source` field, THEN THE game data service SHALL resolve it through the Source_Tag resolver (Requirement 6) and set the resulting Source_Registry identifier as the `_sourceBookId` value.
4. IF an entry's Source_Tag resolves to multiple books (semicolon-separated), THEN THE game data service SHALL set `_sourceBookId` to an array containing each resolved Source_Registry identifier.
5. WHEN an entry has no resolvable source, THE game data service SHALL omit the `_sourceBookId` field entirely (the field SHALL NOT be present on the entry), indicating the entry is always visible regardless of filter state.
6. THE game data service SHALL perform augmentation after all book directory merges and table merges are complete, so that the resolver operates on the final merged state of each entry.
