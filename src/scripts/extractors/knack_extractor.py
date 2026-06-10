"""Knack category extractor.

Extracts knack entries from calling-organized knack sections in ingested PDF text.
Uses calling_map section anchors to locate knack blocks, heading patterns to isolate
individual knacks, and derives structured fields per the knack data model.
"""

from __future__ import annotations

import re
from typing import Any

from extractors.base import CategoryExtractor, CategoryResult, LogEntry
from parser_framework.models import BookSpec


# Page marker format produced by ingest_engine: ===== Page N / Total =====
_PAGE_MARKER_RE = re.compile(r"===== Page (\d+) / \d+ =====")

# Default heading pattern for knack names: a line starting with a capitalized word
_DEFAULT_HEADING_RE = re.compile(r"^(?P<name>[A-Z][A-Za-z' ]+)$", re.MULTILINE)


def _name_to_camel_case(name: str) -> str:
    """Convert a knack name to a camelCase identifier, stripping punctuation.

    Examples:
        "Aura of Greatness" -> "auraOfGreatness"
        "A Purpose" -> "aPurpose"
        "Don't Tread on Me" -> "dontTreadOnMe"
        "Self-Healing" -> "selfHealing"
    """
    # Strip punctuation (keep letters, digits, spaces, hyphens)
    cleaned = re.sub(r"[^\w\s-]", "", name)
    # Split on spaces and hyphens
    words = re.split(r"[\s-]+", cleaned.strip())
    if not words:
        return ""
    # First word lowercase, subsequent words title-cased
    parts = [words[0].lower()]
    for w in words[1:]:
        if w:
            parts.append(w[0].upper() + w[1:].lower() if len(w) > 1 else w.upper())
    return "".join(parts)


def _find_nearest_page(text: str, position: int) -> int:
    """Find the page number from the nearest preceding page marker.

    Searches backward from the given position in the text to find the most
    recent page marker and returns its page number. Returns 1 if no marker found.
    """
    preceding_text = text[:position]
    matches = list(_PAGE_MARKER_RE.finditer(preceding_text))
    if matches:
        return int(matches[-1].group(1))
    return 1


def _get_source_filename(spec: BookSpec) -> str:
    """Get the source filename from the spec (first filename in the list)."""
    return spec.filenames[0] if spec.filenames else "unknown.pdf"


def _determine_knack_kind(section_anchor: str) -> str:
    """Determine knackKind from the section anchor context.

    Mortal knacks appear under section anchors containing "Mortal" (e.g.,
    "Mortal Knacks", "Creator Mortal Knacks"). All others are "immortal".
    """
    if re.search(r"(?i)\bmortal\b", section_anchor):
        return "mortal"
    return "immortal"


def _determine_tier_min(knack_kind: str) -> str:
    """Determine tierMin based on knackKind.

    Mortal knacks are available from the mortal tier.
    Immortal knacks require hero tier minimum.
    """
    if knack_kind == "mortal":
        return "mortal"
    return "hero"


def _parse_knack_block(block: str) -> tuple[str, str]:
    """Parse a knack block into description and mechanical effects.

    The block text (after the heading) is split into description and
    mechanical effects. The first paragraph is the description, and any
    remaining text forms the mechanical effects.

    Returns:
        Tuple of (description, mechanical_effects).
    """
    lines = block.strip().splitlines()
    if not lines:
        return ("", "")

    # Collect all non-empty lines
    content_lines = [line.strip() for line in lines if line.strip()]
    if not content_lines:
        return ("", "")

    # Join all content - treat the full block as description,
    # and also use it as mechanical_effects (matching legacy behavior)
    full_text = " ".join(content_lines)

    # Try to split on a blank line boundary to separate description from effects
    paragraphs: list[str] = []
    current: list[str] = []
    for line in lines:
        if not line.strip():
            if current:
                paragraphs.append(" ".join(current))
                current = []
        else:
            current.append(line.strip())
    if current:
        paragraphs.append(" ".join(current))

    if len(paragraphs) >= 2:
        description = paragraphs[0]
        mechanical_effects = " ".join(paragraphs[1:])
    else:
        description = full_text
        mechanical_effects = full_text

    return (description, mechanical_effects)


class KnackExtractor(CategoryExtractor):
    """Extractor for knack entries from calling-organized sections.

    Uses the category_config's `calling_map` to locate knack sections,
    splits them by heading pattern, and parses each block for structured fields.
    """

    def extract(self, text: str, spec: BookSpec, category_config: dict) -> CategoryResult:
        """Extract knack entries from the ingested text.

        Args:
            text: Full ingested plaintext from the PDF (with page markers).
            spec: The BookSpec for the current book being processed.
            category_config: Must include `calling_map` dict and optionally
                `heading_pattern` and `section_anchors`.

        Returns:
            CategoryResult with extracted knack entries keyed by id.
        """
        entries: dict[str, Any] = {}
        log: list[LogEntry] = []
        calling_map: dict[str, str] = category_config.get("calling_map", {})
        source_filename = _get_source_filename(spec)

        # Build heading regex from config or use default
        heading_pattern = category_config.get("heading_pattern")
        if heading_pattern and isinstance(heading_pattern, dict):
            regex_str = heading_pattern.get("regex", _DEFAULT_HEADING_RE.pattern)
            flags_list = heading_pattern.get("flags", [])
            flags = 0
            for f in flags_list:
                flags |= getattr(re, f, 0)
            heading_re = re.compile(regex_str, flags)
        else:
            heading_re = _DEFAULT_HEADING_RE

        # Process each calling section from the calling_map
        for anchor_text, calling_value in calling_map.items():
            # Find the section start in the text
            section_start = self._find_section_start(text, anchor_text, category_config)
            if section_start == -1:
                log.append(LogEntry(
                    entry_id="",
                    field="section",
                    reason="anchor_not_found",
                    detail=f"Section anchor not found: {anchor_text}",
                ))
                continue

            # Find the section end (next calling_map anchor or end of text)
            section_end = self._find_section_end(
                text, section_start, anchor_text, calling_map, category_config
            )
            section_text = text[section_start:section_end]

            # Determine knackKind from the anchor context
            knack_kind = _determine_knack_kind(anchor_text)
            tier_min = _determine_tier_min(knack_kind)

            # Split by heading pattern to isolate individual knack blocks
            # Skip headings that match the section anchor itself
            all_matches = list(heading_re.finditer(section_text))
            matches = [
                m for m in all_matches
                if m.group("name").strip() != anchor_text.strip()
            ]
            if not matches:
                log.append(LogEntry(
                    entry_id="",
                    field="heading",
                    reason="heading_unmatched",
                    detail=f"No headings found in section: {anchor_text}",
                ))
                continue

            for i, match in enumerate(matches):
                name = match.group("name").strip()
                if not name:
                    continue

                # Extract the block text between this heading and the next
                block_start = match.end()
                block_end = matches[i + 1].start() if i + 1 < len(matches) else len(section_text)
                block_text = section_text[block_start:block_end]

                # Derive id from name
                knack_id = _name_to_camel_case(name)
                if not knack_id:
                    log.append(LogEntry(
                        entry_id=name,
                        field="id",
                        reason="parse_error",
                        detail=f"Could not derive id from name: {name}",
                    ))
                    continue

                # Parse description and mechanical effects
                description, mechanical_effects = _parse_knack_block(block_text)

                # Find source page number from nearest preceding page marker
                absolute_position = section_start + match.start()
                page_number = _find_nearest_page(text, absolute_position)
                source = f"{source_filename} p.{page_number}"

                # Build callings list
                callings = [calling_value] if calling_value else []

                entry: dict[str, Any] = {
                    "id": knack_id,
                    "name": name,
                    "callings": callings,
                    "tierMin": tier_min,
                    "description": description,
                    "mechanicalEffects": mechanical_effects,
                    "source": source,
                    "knackKind": knack_kind,
                }

                entries[knack_id] = entry

        return CategoryResult(
            category="knacks",
            entries=entries,
            entry_count=len(entries),
            log=log,
        )

    def validate_config(self, category_config: dict) -> list[str]:
        """Validate the knacks category configuration block.

        Requires:
            - calling_map: dict mapping section anchor text to calling id strings
        """
        errors: list[str] = []

        calling_map = category_config.get("calling_map")
        if calling_map is None:
            errors.append("knacks category requires 'calling_map' dict")
        elif not isinstance(calling_map, dict):
            errors.append("knacks 'calling_map' must be a dict")
        elif not calling_map:
            errors.append("knacks 'calling_map' must not be empty")

        # heading_pattern is optional but if present must have 'regex'
        heading_pattern = category_config.get("heading_pattern")
        if heading_pattern is not None:
            if not isinstance(heading_pattern, dict):
                errors.append("knacks 'heading_pattern' must be a dict with 'regex' key")
            elif "regex" not in heading_pattern:
                errors.append("knacks 'heading_pattern' must contain 'regex' key")

        return errors

    def _find_section_start(
        self, text: str, anchor_text: str, category_config: dict
    ) -> int:
        """Find the start position of a section by its anchor text.

        Checks section_anchors config for pattern_type (literal or regex).
        Falls back to simple text search.
        """
        # Check if there's a matching section_anchor config entry
        section_anchors = category_config.get("section_anchors", [])
        for anchor_cfg in section_anchors:
            if isinstance(anchor_cfg, dict):
                pattern = anchor_cfg.get("pattern", "")
                pattern_type = anchor_cfg.get("pattern_type", "literal")
                if pattern == anchor_text or pattern_type == "regex":
                    if pattern_type == "regex":
                        match = re.search(pattern, text)
                        if match:
                            return match.start()
                    else:
                        idx = text.find(anchor_text)
                        if idx != -1:
                            return idx

        # Fallback: simple text search for the anchor
        idx = text.find(anchor_text)
        return idx if idx != -1 else -1

    def _find_section_end(
        self,
        text: str,
        section_start: int,
        current_anchor: str,
        calling_map: dict[str, str],
        category_config: dict,
    ) -> int:
        """Find the end of the current section.

        Looks for the next calling_map anchor or the end of text.
        """
        # Search for the next anchor after the current section start
        min_end = len(text)
        for anchor_text in calling_map:
            if anchor_text == current_anchor:
                continue
            # Find occurrences of other anchors after our section start
            # We need to look past the current anchor text itself
            search_start = section_start + len(current_anchor)
            idx = text.find(anchor_text, search_start)
            if idx != -1 and idx < min_end:
                min_end = idx

        return min_end
