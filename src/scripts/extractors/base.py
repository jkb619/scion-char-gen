"""Category extractor base class and result dataclasses.

Defines the abstract interface that all category-specific extractors implement,
along with structured result and logging types.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Literal

from parser_framework.models import BookSpec


@dataclass
class LogEntry:
    """Structured log entry for extraction-level diagnostics.

    Records issues encountered while extracting individual entries or fields
    within a category. Used for verbose logging and regression analysis.
    """

    entry_id: str
    field: str
    reason: Literal[
        "not_found",
        "parse_error",
        "section_missing",
        "heading_unmatched",
        "anchor_not_found",
        "validation_warning",
    ]
    detail: str | None = None


@dataclass
class CategoryResult:
    """Result of extracting a single game-data category from a book's text.

    Attributes:
        category: The category name (e.g., "knacks", "boons", "purviews").
        entries: Mapping of entry IDs to their extracted data dictionaries.
        entry_count: Number of entries extracted.
        log: Structured log entries for issues encountered during extraction.
    """

    category: str
    entries: dict[str, Any]
    entry_count: int
    log: list[LogEntry] = field(default_factory=list)


class CategoryExtractor(ABC):
    """Abstract base class for category-specific extractors.

    Each game-data category (knacks, boons, purviews, etc.) has a concrete
    subclass that knows how to locate, parse, and structure entries from
    ingested PDF text using the category's configuration in the Book Spec.
    """

    @abstractmethod
    def extract(self, text: str, spec: BookSpec, category_config: dict) -> CategoryResult:
        """Extract entries for this category from ingested text.

        Args:
            text: Full ingested plaintext from the PDF (with page markers).
            spec: The BookSpec for the current book being processed.
            category_config: The category-specific configuration block from
                the Book Spec's `categories` dict.

        Returns:
            A CategoryResult containing all extracted entries and any log
            entries for issues encountered.
        """
        ...

    @abstractmethod
    def validate_config(self, category_config: dict) -> list[str]:
        """Validate this category's configuration block.

        Called at load time to detect configuration errors before the pipeline
        runs. Returns an empty list if the config is valid.

        Args:
            category_config: The category-specific configuration block from
                the Book Spec's `categories` dict.

        Returns:
            A list of validation error messages. Empty list means valid.
        """
        ...
