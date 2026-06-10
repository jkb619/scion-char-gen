"""Book slice extractor — produces per-book bundle slices.

This extractor is unique: it does not parse raw text for its own entries.
Instead, it assembles the results from all other category extractors for a
book and bundles them into a single JSON file at `src/data/books/<slug>.json`
with a `_meta` block.

The output format:
{
  "_meta": {
    "slug": "divine_armory",
    "title": "Divine Armory",
    "sourcePdf": "7711-Divine_Armory.pdf",
    "kind": "storypath_nexus|core|supplement",
    "note": "Personal bundle slice — merged at load; delete file to remove book."
  },
  "equipment": { /* keyed entries */ },
  "birthrights": { /* keyed entries */ },
  "knacks": { /* keyed entries */ }
}

Categories with no extracted entries are omitted from the slice.
"""

from __future__ import annotations

from typing import Any

from extractors.base import CategoryExtractor, CategoryResult, LogEntry
from parser_framework.models import BookSpec


# Categories that are eligible to appear within a book slice.
# "book_slices" itself is excluded to avoid recursion.
_BUNDLEABLE_CATEGORIES = frozenset({
    "knacks",
    "boons",
    "purviews",
    "callings",
    "birthrights",
    "equipment",
    "paths",
    "pantheons",
})

# Valid values for the "kind" field in the _meta block.
_VALID_KINDS = frozenset({
    "storypath_nexus",
    "core",
    "supplement",
    "onyx_path",
    "other",
    "unknown",
})

# Default kind when not specified in the category config.
_DEFAULT_KIND = "supplement"

# The fixed note included in every book slice _meta block.
_META_NOTE = "Personal bundle slice — merged at load; delete file to remove book."


class BookSliceExtractor(CategoryExtractor):
    """Assembles a per-book bundle slice from other category results.

    Unlike other extractors, this one doesn't parse text. It receives
    pre-extracted category results via `category_config["_category_results"]`
    and bundles them into the slice format with a `_meta` block.

    The pipeline is expected to inject a `_category_results` key into the
    category config before calling this extractor. The value is a dict mapping
    category names to their CategoryResult objects (or raw entry dicts).
    """

    def extract(self, text: str, spec: BookSpec, category_config: dict) -> CategoryResult:
        """Assemble a book slice from pre-extracted category results.

        Args:
            text: Full ingested plaintext (unused by this extractor, but
                required by the ABC interface).
            spec: The BookSpec for the current book being processed.
            category_config: Must contain:
                - "_category_results": dict mapping category names to either
                  CategoryResult objects or dicts of entries.
                - "kind" (optional): The book kind for the _meta block.
                  Defaults to "supplement".

        Returns:
            A CategoryResult where `entries` is the complete slice payload
            including the `_meta` block. The slice is stored as a single
            entry keyed by the book slug.
        """
        log: list[LogEntry] = []

        # Determine metadata fields from the spec
        slug = spec.book_slug or spec.book_id
        title = spec.book_title or slug.replace("_", " ").title()
        source_pdf = spec.filenames[0] if spec.filenames else "unknown.pdf"
        kind = category_config.get("kind", _DEFAULT_KIND)

        if kind not in _VALID_KINDS:
            log.append(LogEntry(
                entry_id=slug,
                field="kind",
                reason="validation_warning",
                detail=f"Unrecognized kind '{kind}'; using '{_DEFAULT_KIND}'",
            ))
            kind = _DEFAULT_KIND

        # Build the _meta block
        meta: dict[str, Any] = {
            "slug": slug,
            "title": title,
            "sourcePdf": source_pdf,
            "kind": kind,
            "note": _META_NOTE,
        }

        # Assemble the slice payload
        slice_payload: dict[str, Any] = {"_meta": meta}

        # Get pre-extracted category results injected by the pipeline
        category_results: dict[str, Any] = category_config.get("_category_results", {})

        if not category_results:
            log.append(LogEntry(
                entry_id=slug,
                field="_category_results",
                reason="not_found",
                detail="No category results provided; slice will contain only _meta",
            ))

        # Include each bundleable category that has entries
        categories_included = 0
        for cat_name in sorted(category_results.keys()):
            if cat_name not in _BUNDLEABLE_CATEGORIES:
                continue

            result = category_results[cat_name]

            # Accept either a CategoryResult object or a raw dict of entries
            if isinstance(result, CategoryResult):
                entries = result.entries
            elif isinstance(result, dict):
                entries = result
            else:
                log.append(LogEntry(
                    entry_id=slug,
                    field=cat_name,
                    reason="parse_error",
                    detail=f"Unexpected result type for category '{cat_name}': {type(result).__name__}",
                ))
                continue

            # Only include categories with actual entries
            if entries:
                slice_payload[cat_name] = entries
                categories_included += 1

        return CategoryResult(
            category="book_slices",
            entries=slice_payload,
            entry_count=categories_included,
            log=log,
        )

    def validate_config(self, category_config: dict) -> list[str]:
        """Validate the book_slices category configuration block.

        The book_slices config is minimal — it mainly needs an output_path.
        The `_category_results` key is injected at runtime by the pipeline,
        so it's not validated here.

        Args:
            category_config: The book_slices category configuration dict.

        Returns:
            List of validation error messages. Empty if valid.
        """
        errors: list[str] = []

        if "output_path" not in category_config:
            errors.append("book_slices: missing required field 'output_path'")
        elif not isinstance(category_config["output_path"], str):
            errors.append("book_slices: 'output_path' must be a string")
        elif "{slug}" not in category_config["output_path"]:
            errors.append(
                "book_slices: 'output_path' should contain '{slug}' placeholder "
                "(e.g., 'src/data/books/{slug}.json')"
            )

        # Validate 'kind' if provided
        kind = category_config.get("kind")
        if kind is not None and kind not in _VALID_KINDS:
            errors.append(
                f"book_slices: 'kind' value '{kind}' is not recognized; "
                f"valid values: {sorted(_VALID_KINDS)}"
            )

        return errors
