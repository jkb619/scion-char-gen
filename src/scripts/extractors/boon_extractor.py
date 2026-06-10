"""Boon category extractor.

Extracts boon entries from purview-organized boon sections in ingested PDF text.
Uses regex section anchors to locate purview boon blocks, identifies entries by
heading + dot rating patterns (● symbols or positional ALL CAPS headings followed
by Cost: lines), and produces structured boon entries with mechanical effects.
"""

from __future__ import annotations

import re
from typing import Any

from extractors.base import CategoryExtractor, CategoryResult, LogEntry
from parser_framework.models import BookSpec


# Page marker format produced by ingest_engine: ===== Page N / Total =====
_PAGE_MARKER_RE = re.compile(r"===== Page (\d+) / \d+ =====")

# Default section anchor: purview name followed by "Boons" or standalone ALL CAPS word
_DEFAULT_SECTION_ANCHOR_RE = re.compile(
    r"^(?P<purview>[A-Z][A-Z ]+?)(?:\s+Boons)?$", re.MULTILINE
)

# Heading pattern for boon names with explicit dot symbols (● or •)
_DOT_HEADING_RE = re.compile(
    r"^(?P<name>.+?)\s*(?P<dots>[●•]+)\s*$", re.MULTILINE
)

# Heading pattern for ALL CAPS boon names (PB format): must be followed by Cost:
_ALLCAPS_HEADING_RE = re.compile(
    r"^(?P<name>[A-Z][A-Z0-9 '\u2019\-\.&,]+)\s*$", re.MULTILINE
)

# Mechanical effect field labels
_MECH_FIELDS = ("Cost", "Duration", "Subject", "Range", "Action", "Clash")

# Pattern to parse individual mechanical fields from a boon block
_MECH_FIELD_RE = re.compile(
    r"^(" + "|".join(_MECH_FIELDS) + r")\s*:\s*(.+)$", re.IGNORECASE | re.MULTILINE
)

# Prerequisite pattern
_PREREQUISITE_RE = re.compile(
    r"^Prerequisite\s*:\s*(.+)$", re.IGNORECASE | re.MULTILINE
)


def _name_to_camel_case(name: str) -> str:
    """Convert a purview/boon name to a camelCase identifier.

    Examples:
        "Artistry" -> "artistry"
        "Epic Dexterity" -> "epicDexterity"
        "Arcane Calculus" -> "arcaneCalculus"
    """
    # Normalize unicode apostrophes
    name = name.replace("\u2019", "'").replace("\u2018", "'")
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

    Returns 1 if no marker found.
    """
    preceding_text = text[:position]
    matches = list(_PAGE_MARKER_RE.finditer(preceding_text))
    if matches:
        return int(matches[-1].group(1))
    return 1


def _get_source_filename(spec: BookSpec) -> str:
    """Get the source filename from the spec (first filename in the list)."""
    return spec.filenames[0] if spec.filenames else "unknown.pdf"


def _derive_tier_min(dot: int) -> str:
    """Derive tierMin from dot position.

    Dots 1-4 = hero, 5-8 = demigod, 9-12 = god.
    """
    if dot <= 4:
        return "hero"
    elif dot <= 8:
        return "demigod"
    else:
        return "god"


def _parse_mechanical_fields(block: str) -> dict[str, str]:
    """Parse Cost, Duration, Subject, Range, Action, Clash from a boon block.

    Uses label-based parsing: finds each labeled line and captures its value.
    For multi-line values (rare), also grabs continuation text until the next label.
    """
    result: dict[str, str] = {k.lower(): "" for k in _MECH_FIELDS}

    # Find all mechanical field matches and their positions
    matches = list(_MECH_FIELD_RE.finditer(block))
    if not matches:
        return result

    for i, m in enumerate(matches):
        key = m.group(1).lower()
        # Start with the value captured on the same line
        val = m.group(2).strip()

        # Check for continuation lines (text between this match end and next match start)
        if i + 1 < len(matches):
            between = block[m.end():matches[i + 1].start()]
        else:
            # For the last label, take text until next blank line or description start
            remaining = block[m.end():]
            end_match = re.search(r"\n\s*\n|\n[A-Z][a-z]", remaining)
            between = remaining[:end_match.start()] if end_match else ""

        # Append any continuation lines (non-empty lines that aren't new labels)
        continuation = between.strip()
        if continuation and not _MECH_FIELD_RE.match(continuation):
            # Only add if it's a genuine continuation (not just whitespace)
            extra = re.sub(r"\s+", " ", continuation).strip()
            if extra:
                val = val + " " + extra if val else extra

        # Clean up
        val = re.sub(r"\s+", " ", val).strip()
        if key in result:
            result[key] = val

    return result


def _build_mechanical_effects(fields: dict[str, str]) -> str:
    """Build mechanicalEffects string from parsed fields.

    Format: "Cost: ...\nDuration: ...\nSubject: ...\nRange: ...\nAction: ...\nClash: ..."
    Only includes fields that have non-empty values.
    """
    lines = []
    for label in _MECH_FIELDS:
        val = fields.get(label.lower(), "")
        if val:
            lines.append(f"{label}: {val}")
    return "\n".join(lines)


def _extract_description(block: str, mech_fields: dict[str, str]) -> str:
    """Extract the description text from a boon block.

    The description is the text after the mechanical fields header and before
    any calling-specific blocks (e.g., "Creator Specific:", "Warrior Specific:").
    """
    # Find the end of the mechanical header section (last mech field line)
    last_field_end = 0
    for m in _MECH_FIELD_RE.finditer(block):
        # Find end of this line
        line_end = block.find("\n", m.end())
        if line_end == -1:
            line_end = len(block)
        last_field_end = max(last_field_end, line_end)

    if last_field_end == 0:
        # No mechanical fields found; entire block is description
        body = block.strip()
    else:
        body = block[last_field_end:].strip()

    # Trim at calling-specific sections
    specific_match = re.search(
        r"\n\s*(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+Specific\s*:)", body
    )
    if specific_match:
        body = body[: specific_match.start()].strip()

    # Collapse whitespace
    body = re.sub(r"\s+", " ", body).strip()

    # Trim very long descriptions
    if len(body) > 500:
        body = body[:497].rsplit(" ", 1)[0] + "…"

    return body


def _find_prerequisite_boon_ids(
    block: str, purview_id: str, boon_names_to_dots: dict[str, int]
) -> list[str]:
    """Extract prerequisite boon IDs from a boon block.

    Looks for "Prerequisite: <boon name>" and maps names to IDs within
    the same purview using the name-to-dot mapping.
    """
    prereqs: list[str] = []
    match = _PREREQUISITE_RE.search(block)
    if not match:
        return prereqs

    prereq_text = match.group(1).strip()
    # May have multiple prerequisites separated by commas or "and"
    parts = re.split(r",\s*|\s+and\s+", prereq_text)

    for part in parts:
        part = part.strip()
        if not part:
            continue
        # Try to match against known boon names in this purview
        part_upper = part.upper()
        for name, dot in boon_names_to_dots.items():
            if name.upper() == part_upper:
                prereqs.append(f"{purview_id}_dot_{dot:02d}")
                break

    return prereqs


def _normalize_text(text: str) -> str:
    """Normalize unicode characters in extracted PDF text."""
    text = text.replace("\u2019", "'").replace("\u2018", "'")
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    text = text.replace("\u00ad", "")  # soft hyphen
    return text


class BoonExtractor(CategoryExtractor):
    """Extractor for boon entries from purview-organized sections.

    Supports two heading formats:
    1. Dot-rated: "Boon Name ●●●" where dot count determines rating
    2. Positional: ALL CAPS boon names followed by Cost: lines, where
       position within the purview section determines dot rating (1-12)
    """

    def extract(self, text: str, spec: BookSpec, category_config: dict) -> CategoryResult:
        """Extract boon entries from the ingested text.

        Args:
            text: Full ingested plaintext from the PDF (with page markers).
            spec: The BookSpec for the current book being processed.
            category_config: Must include `section_anchors` for purview detection.
                Optional: `heading_pattern`, `dot_symbol`.

        Returns:
            CategoryResult with extracted boon entries keyed by id.
        """
        entries: dict[str, Any] = {}
        log: list[LogEntry] = []
        source_filename = _get_source_filename(spec)
        text = _normalize_text(text)

        # Determine heading mode from config
        dot_symbol = category_config.get("dot_symbol", "")
        heading_pattern_cfg = category_config.get("heading_pattern")
        use_dot_heading = bool(dot_symbol)

        # Build the section anchor regex from config
        section_anchors = category_config.get("section_anchors", [])
        purview_sections = self._find_purview_sections(text, section_anchors, log)

        if not purview_sections:
            log.append(LogEntry(
                entry_id="",
                field="section",
                reason="anchor_not_found",
                detail="No purview boon sections found in text",
            ))
            return CategoryResult(
                category="boons",
                entries=entries,
                entry_count=0,
                log=log,
            )

        # Process each purview section
        for purview_name, section_start, section_end in purview_sections:
            section_text = text[section_start:section_end]
            purview_id = _name_to_camel_case(purview_name)

            if not purview_id:
                log.append(LogEntry(
                    entry_id="",
                    field="purview",
                    reason="parse_error",
                    detail=f"Could not derive purview id from: {purview_name}",
                ))
                continue

            # Extract boon entries from this purview section
            if use_dot_heading:
                boon_blocks = self._extract_dot_rated_boons(
                    section_text, heading_pattern_cfg, dot_symbol
                )
            else:
                boon_blocks = self._extract_positional_boons(section_text)

            if not boon_blocks:
                log.append(LogEntry(
                    entry_id="",
                    field="heading",
                    reason="heading_unmatched",
                    detail=f"No boon entries found in purview section: {purview_name}",
                ))
                continue

            # Build name-to-dot map for prerequisite resolution
            boon_names_to_dots: dict[str, int] = {}
            for dot_num, (name, _block_text) in enumerate(boon_blocks, start=1):
                boon_names_to_dots[name] = dot_num

            # Process each boon entry
            for dot_num, (name, block_text) in enumerate(boon_blocks, start=1):
                boon_id = f"{purview_id}_dot_{dot_num:02d}"
                tier_min = _derive_tier_min(dot_num)

                # Parse mechanical fields
                mech_fields = _parse_mechanical_fields(block_text)
                mechanical_effects = _build_mechanical_effects(mech_fields)

                # Extract description
                description = _extract_description(block_text, mech_fields)

                # Find prerequisites
                requires = _find_prerequisite_boon_ids(
                    block_text, purview_id, boon_names_to_dots
                )

                # Determine source page
                absolute_position = section_start + section_text.find(name)
                page_number = _find_nearest_page(text, absolute_position)
                source = f"{source_filename} p.{page_number}"

                # Title-case the name for display
                display_name = self._title_case_boon_name(name)

                entry: dict[str, Any] = {
                    "id": boon_id,
                    "name": display_name,
                    "purview": purview_id,
                    "purviewName": purview_name,
                    "dot": dot_num,
                    "tierMin": tier_min,
                    "legendMin": 0,
                    "requiresBoonIds": requires,
                    "description": description,
                    "mechanicalEffects": mechanical_effects,
                    "source": source,
                    "cost": mech_fields.get("cost", ""),
                    "duration": mech_fields.get("duration", ""),
                    "subject": mech_fields.get("subject", ""),
                    "range": mech_fields.get("range", ""),
                    "action": mech_fields.get("action", ""),
                    "clash": mech_fields.get("clash", ""),
                }

                entries[boon_id] = entry

        return CategoryResult(
            category="boons",
            entries=entries,
            entry_count=len(entries),
            log=log,
        )

    def validate_config(self, category_config: dict) -> list[str]:
        """Validate the boons category configuration block.

        Requires:
            - section_anchors: list with at least one anchor definition
        """
        errors: list[str] = []

        section_anchors = category_config.get("section_anchors")
        if section_anchors is None:
            errors.append("boons category requires 'section_anchors' list")
        elif not isinstance(section_anchors, list):
            errors.append("boons 'section_anchors' must be a list")
        elif not section_anchors:
            errors.append("boons 'section_anchors' must not be empty")

        # heading_pattern is optional but if present must have 'regex'
        heading_pattern = category_config.get("heading_pattern")
        if heading_pattern is not None:
            if not isinstance(heading_pattern, dict):
                errors.append("boons 'heading_pattern' must be a dict with 'regex' key")
            elif "regex" not in heading_pattern:
                errors.append("boons 'heading_pattern' must contain 'regex' key")

        return errors

    def _find_purview_sections(
        self, text: str, section_anchors: list[dict], log: list[LogEntry]
    ) -> list[tuple[str, int, int]]:
        """Find all purview boon sections in the text.

        Returns list of (purview_display_name, start_pos, end_pos) tuples
        sorted by position.
        """
        sections: list[tuple[str, int, int]] = []

        for anchor_cfg in section_anchors:
            if not isinstance(anchor_cfg, dict):
                continue

            pattern = anchor_cfg.get("pattern", "")
            pattern_type = anchor_cfg.get("pattern_type", "literal")

            if pattern_type == "regex":
                try:
                    anchor_re = re.compile(pattern, re.MULTILINE)
                except re.error:
                    log.append(LogEntry(
                        entry_id="",
                        field="section_anchors",
                        reason="parse_error",
                        detail=f"Invalid regex in section anchor: {pattern}",
                    ))
                    continue

                for m in anchor_re.finditer(text):
                    purview_name = m.group("purview") if "purview" in m.groupdict() else m.group(0)
                    purview_name = purview_name.strip()
                    # Title-case the purview name for display
                    display_name = self._title_case_boon_name(purview_name)
                    sections.append((display_name, m.start(), -1))  # end filled later
            else:
                # Literal pattern - search for exact text as a line
                # Look for the anchor as a standalone line or at start of line
                escaped = re.escape(pattern)
                line_re = re.compile(rf"^{escaped}\s*$", re.MULTILINE)
                m = line_re.search(text)
                if m:
                    display_name = self._title_case_boon_name(pattern.strip())
                    sections.append((display_name, m.start(), -1))
                else:
                    # Fallback: simple text find
                    idx = text.find(pattern)
                    if idx != -1:
                        display_name = self._title_case_boon_name(pattern.strip())
                        sections.append((display_name, idx, -1))

        if not sections:
            return []

        # Sort by position
        sections.sort(key=lambda s: s[1])

        # Fill in end positions (each section ends where the next begins)
        result: list[tuple[str, int, int]] = []
        for i, (name, start, _) in enumerate(sections):
            end = sections[i + 1][1] if i + 1 < len(sections) else len(text)
            result.append((name, start, end))

        return result

    def _extract_dot_rated_boons(
        self, section_text: str, heading_pattern_cfg: dict | None, dot_symbol: str
    ) -> list[tuple[str, str]]:
        """Extract boons using explicit dot rating symbols (● or •).

        Returns list of (name, block_text) tuples ordered by appearance.
        The dot count determines the rating, but ordering still determines the
        sequential position within the purview.
        """
        # Build heading regex from config or use default dot pattern
        if heading_pattern_cfg and isinstance(heading_pattern_cfg, dict):
            regex_str = heading_pattern_cfg.get("regex", _DOT_HEADING_RE.pattern)
            flags_list = heading_pattern_cfg.get("flags", [])
            flags = 0
            for f in flags_list:
                flags |= getattr(re, f, 0)
            heading_re = re.compile(regex_str, flags)
        else:
            heading_re = _DOT_HEADING_RE

        matches = list(heading_re.finditer(section_text))
        if not matches:
            return []

        boons: list[tuple[str, str]] = []
        for i, m in enumerate(matches):
            name = m.group("name").strip()
            # Block text runs from after this heading to start of next heading
            block_start = m.end()
            block_end = matches[i + 1].start() if i + 1 < len(matches) else len(section_text)
            block_text = section_text[block_start:block_end]
            boons.append((name, block_text))

        return boons

    def _extract_positional_boons(
        self, section_text: str
    ) -> list[tuple[str, str]]:
        """Extract boons by positional ALL CAPS headings followed by Cost: lines.

        The Pandora's Box format uses ALL CAPS names where position in the
        purview section determines the dot rating. A valid boon heading must
        be immediately followed (within a few lines, no intervening ALL CAPS
        heading) by a Cost: line.

        Returns list of (name, block_text) tuples ordered by position.
        """
        # Find all ALL CAPS headings
        all_matches = list(_ALLCAPS_HEADING_RE.finditer(section_text))

        # Filter to only those that are followed by a Cost: line before the next heading
        valid_boons: list[tuple[re.Match, str]] = []
        for idx, m in enumerate(all_matches):
            name = m.group("name").strip()
            # Skip very short names (likely noise) or page headers
            if len(name) < 3:
                continue
            # Skip noise like "P ANDORA 'S BOX" or page number headers
            if re.match(r"^P\s+ANDORA|^CHAPTER|^BOONS\s*\d*$", name, re.IGNORECASE):
                continue

            # The text between this heading and the next ALL CAPS heading
            after_start = m.end()
            if idx + 1 < len(all_matches):
                after_end = all_matches[idx + 1].start()
            else:
                after_end = min(after_start + 300, len(section_text))

            between_text = section_text[after_start:after_end]

            # Cost: must appear in the immediate block (before another heading)
            cost_match = re.search(r"^Cost\s*:", between_text, re.MULTILINE)
            if cost_match:
                valid_boons.append((m, name))

        if not valid_boons:
            return []

        # Extract block text for each valid boon
        boons: list[tuple[str, str]] = []
        for i, (m, name) in enumerate(valid_boons):
            block_start = m.end()
            if i + 1 < len(valid_boons):
                block_end = valid_boons[i + 1][0].start()
            else:
                block_end = len(section_text)
            block_text = section_text[block_start:block_end]
            boons.append((name, block_text))

        return boons

    @staticmethod
    def _title_case_boon_name(name: str) -> str:
        """Convert an ALL-CAPS or mixed-case name to title case.

        Handles small words (of, the, and, etc.) per title-case conventions.
        """
        # If already title-cased or mixed, return as-is
        if not name.isupper():
            return name

        parts: list[str] = []
        for word in name.split():
            word_lower = word.lower()
            if "'" in word_lower:
                # Handle apostrophes: "MUSE'S" -> "Muse's", "CAN'T" -> "Can't"
                # Only capitalize the first letter of the word
                parts.append(word_lower[:1].upper() + word_lower[1:])
            else:
                parts.append(word_lower[:1].upper() + word_lower[1:])

        # Apply small-word rules (don't capitalize short prepositions/articles
        # unless they're the first word)
        small_words = {"of", "the", "and", "to", "for", "in", "on", "at", "or", "a", "an", "vs", "vs."}
        fixed: list[str] = []
        for i, p in enumerate(parts):
            if i > 0 and p.lower() in small_words:
                fixed.append(p.lower())
            else:
                fixed.append(p)
        return " ".join(fixed)
