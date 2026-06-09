"""Deterministic mapping from raw source strings to registry slugs.

Resolution priority per segment:
  1. Exact slug match (case-insensitive)
  2. PDF filename extraction + match against registry pdf_patterns
  3. Case-insensitive longest-substring title match
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.app.services.source_registry import SourceRegistry

# Pattern to strip trailing page references like " p.26", " p.142", " p.3"
_PAGE_REF_PATTERN = re.compile(r"\s+p\.\d+$")


class SourceTagResolver:
    """Resolve raw source tag strings to canonical registry slugs."""

    def __init__(self, registry: SourceRegistry) -> None:
        self._registry = registry

    def resolve(self, source_tag: str) -> list[str]:
        """Return list of resolved registry slugs (one per semicolon segment).

        Resolution priority per segment:
          1. Exact slug match (case-insensitive)
          2. PDF filename extraction + match against registry pdf_patterns
          3. Case-insensitive longest-substring title match

        Returns empty list if no segment resolves.
        """
        segments = source_tag.split(";")
        results: list[str] = []
        for segment in segments:
            stripped = segment.strip()
            if not stripped:
                continue
            slug = self.resolve_single(stripped)
            if slug is not None:
                results.append(slug)
        return results

    def resolve_single(self, segment: str) -> str | None:
        """Resolve one segment. Returns slug or None."""
        # Strategy 1: Exact slug match (case-insensitive)
        segment_lower = segment.lower()
        for slug in self._registry.entries:
            if slug.lower() == segment_lower:
                return slug

        # Strategy 2: PDF filename extraction + match against pdf_patterns
        slug = self._try_pdf_match(segment)
        if slug is not None:
            return slug

        # Strategy 3: Case-insensitive longest-substring title match
        slug = self._registry.slug_for_title_substring(segment)
        if slug is not None:
            return slug

        return None

    def _try_pdf_match(self, segment: str) -> str | None:
        """Extract PDF filename from segment and match against registry."""
        # Strip trailing page reference (e.g., " p.26")
        cleaned = _PAGE_REF_PATTERN.sub("", segment).strip()

        # Try matching the cleaned segment directly as a PDF filename
        slug = self._registry.slug_for_pdf(cleaned)
        if slug is not None:
            return slug

        return None
