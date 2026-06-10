"""Birthright category extractor.

Extracts birthright entries (relics, creatures, followers, guides, cults)
from ingested PDF text using section anchors, heading patterns with type
capture, stat block patterns for creatures, and dot notation for point cost.

Extraction Strategy:
1. Locate the Birthrights chapter section via section anchors.
2. Split by heading pattern capturing name and type (e.g., "Mjolnir (Relic)").
3. For creatures: apply stat_block_pattern to extract Primary Pool, Defense, Health.
4. For relics: scan for Purview references, tag lists, and evocation text.
5. Assign pointCost from dot notation (• = 1, •• = 2, etc.).
"""

from __future__ import annotations

import re
from typing import Any

from extractors.base import CategoryExtractor, CategoryResult, LogEntry
from parser_framework.models import BookSpec


# Page marker pattern used by the ingest engine (e.g., "--- Page 42 ---")
_PAGE_MARKER_RE = re.compile(r"^---\s*Page\s+(\d+)\s*---$", re.MULTILINE)

# Dot symbols used to indicate point cost in Scion PDFs
_DOT_SYMBOLS = ("•", "●", "◆", "⬥")

# Common purview names for reference matching in relic text
_KNOWN_PURVIEWS = [
    "artistry",
    "beasts",
    "beauty",
    "chaos",
    "darkness",
    "death",
    "deception",
    "earth",
    "epicDexterity",
    "epicStamina",
    "epicStrength",
    "fertility",
    "fire",
    "forge",
    "fortune",
    "frost",
    "health",
    "journeys",
    "moon",
    "order",
    "passion",
    "prosperity",
    "sky",
    "stars",
    "sun",
    "war",
    "water",
    "wild",
]


def _to_camel_case(name: str) -> str:
    """Convert a name string to a camelCase identifier.

    Strips punctuation, splits on whitespace, and joins with camelCase.
    """
    # Remove non-alphanumeric characters (except spaces)
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", "", name)
    words = cleaned.split()
    if not words:
        return ""
    # First word lowercase, rest title-cased
    return words[0].lower() + "".join(w.title() for w in words[1:])


def _count_dots(text: str) -> int:
    """Count dot symbols (•, ●, etc.) in text to determine point cost.

    Returns the count of consecutive dot symbols found, or 1 as default
    if no dots are found.
    """
    for symbol in _DOT_SYMBOLS:
        dots = text.count(symbol)
        if dots > 0:
            return dots
    return 0


def _find_page_number(text: str, position: int) -> int:
    """Find the page number for a given character position.

    Searches backwards from position for the nearest page marker.
    Returns the page number or 1 if no marker is found.
    """
    # Search all page markers before the position
    last_page = 1
    for match in _PAGE_MARKER_RE.finditer(text):
        if match.start() <= position:
            last_page = int(match.group(1))
        else:
            break
    return last_page


def _extract_purview_id(text: str) -> str:
    """Scan text for purview references and return the first matching purview ID.

    Looks for patterns like "Purview: Fire" or "Purviews: Chaos" in the text.
    """
    # Try structured "Purview(s):" line first
    purview_line_re = re.compile(
        r"(?:Purviews?|PURVIEWS?):\s*(.+?)(?:\n|$)", re.IGNORECASE
    )
    match = purview_line_re.search(text)
    if match:
        purview_text = match.group(1).strip()
        # Try to match against known purviews
        for purview in _KNOWN_PURVIEWS:
            if purview.lower() in purview_text.lower():
                return purview
            # Also try the display form (e.g., "Epic Strength" for "epicStrength")
            display = re.sub(r"([A-Z])", r" \1", purview).strip().lower()
            if display in purview_text.lower():
                return purview

    # Fallback: scan the full text for known purview names
    text_lower = text.lower()
    for purview in _KNOWN_PURVIEWS:
        # Match whole-word purview references
        display = re.sub(r"([A-Z])", r" \1", purview).strip()
        if re.search(r"\b" + re.escape(display) + r"\b", text_lower, re.IGNORECASE):
            return purview

    return ""


def _extract_tags(text: str) -> list[str]:
    """Extract tag IDs from text containing tag references.

    Looks for patterns like "Tags: Ranged, Lethal" or tag lists.
    """
    tags_re = re.compile(r"(?:Tags?|TAGS?):\s*(.+?)(?:\n|$)", re.IGNORECASE)
    match = tags_re.search(text)
    if not match:
        return []

    tags_text = match.group(1).strip()
    # Split on commas and semicolons
    raw_tags = re.split(r"[,;]", tags_text)
    tag_ids = []
    for tag in raw_tags:
        # Remove parenthetical ratings like "(0)" or "(2)"
        tag_clean = re.sub(r"\s*\([^)]*\)", "", tag).strip()
        if tag_clean:
            tag_ids.append(_to_camel_case(tag_clean))
    return tag_ids


def _extract_evocation(text: str) -> str:
    """Extract evocation text from a relic block.

    Looks for "Evocation:" followed by descriptive text.
    """
    evocation_re = re.compile(
        r"(?:Evocation|EVOCATION):\s*(.+?)(?:\n\n|\n(?=[A-Z][a-z]+:)|$)",
        re.IGNORECASE | re.DOTALL,
    )
    match = evocation_re.search(text)
    if match:
        return match.group(1).strip()
    return ""


def _extract_motifs_and_tags(text: str) -> str:
    """Extract motifs and tags text from a relic block.

    Looks for "Motif:" or "Motifs:" lines.
    """
    motif_re = re.compile(
        r"(?:Motifs?|MOTIFS?):\s*(.+?)(?:\n\n|\n(?=[A-Z][a-z]+:)|$)",
        re.IGNORECASE | re.DOTALL,
    )
    match = motif_re.search(text)
    if match:
        return match.group(1).strip()
    return ""


class BirthrightExtractor(CategoryExtractor):
    """Extractor for birthright entries (relics, creatures, followers, guides, cults).

    Uses the Book Spec's birthright category config which includes:
    - section_anchors: To locate the Birthrights chapter
    - heading_pattern: Regex with named groups `name` and `type`
    - stat_block_pattern: Regex for creature stat blocks (Primary Pool, Defense, Health)
    """

    def extract(self, text: str, spec: BookSpec, category_config: dict) -> CategoryResult:
        """Extract birthright entries from ingested text.

        Args:
            text: Full ingested plaintext from the PDF (with page markers).
            spec: The BookSpec for the current book being processed.
            category_config: The birthright category config block.

        Returns:
            CategoryResult with all extracted birthright entries.
        """
        log: list[LogEntry] = []
        entries: dict[str, Any] = {}

        # Determine the source filename from the spec
        source_filename = spec.filenames[0] if spec.filenames else spec.book_id

        # Step 1: Locate the Birthrights section
        section_text, section_offset = self._find_section(
            text, category_config, log
        )
        if section_text is None:
            return CategoryResult(
                category="birthrights", entries={}, entry_count=0, log=log
            )

        # Step 2: Split by heading pattern capturing name and type
        heading_pattern = category_config.get("heading_pattern", {})
        heading_regex = heading_pattern.get("regex", "")
        if not heading_regex:
            log.append(
                LogEntry(
                    entry_id="",
                    field="heading_pattern",
                    reason="not_found",
                    detail="No heading_pattern regex configured for birthrights",
                )
            )
            return CategoryResult(
                category="birthrights", entries={}, entry_count=0, log=log
            )

        # Compile heading pattern with flags
        flags = re.MULTILINE
        heading_flags = heading_pattern.get("flags", [])
        for flag_name in heading_flags:
            flag_val = getattr(re, flag_name, None)
            if flag_val is not None:
                flags |= flag_val

        heading_re = re.compile(heading_regex, flags)

        # Find all heading matches and split into blocks
        matches = list(heading_re.finditer(section_text))
        if not matches:
            log.append(
                LogEntry(
                    entry_id="",
                    field="heading_pattern",
                    reason="heading_unmatched",
                    detail="No birthright headings matched in section text",
                )
            )
            return CategoryResult(
                category="birthrights", entries={}, entry_count=0, log=log
            )

        # Get stat_block_pattern for creature parsing
        stat_block_pattern = category_config.get("stat_block_pattern", "")

        # Process each matched heading block
        for i, match in enumerate(matches):
            block_start = match.start()
            block_end = matches[i + 1].start() if i + 1 < len(matches) else len(section_text)
            block_text = section_text[block_start:block_end]

            # Extract name and type from the heading match
            name = match.group("name").strip() if "name" in match.groupdict() else ""
            birthright_type_raw = (
                match.group("type").strip().lower()
                if "type" in match.groupdict() and match.group("type")
                else ""
            )

            # Normalize the type
            birthright_type = self._normalize_type(birthright_type_raw)
            if not birthright_type:
                log.append(
                    LogEntry(
                        entry_id=name,
                        field="birthrightType",
                        reason="parse_error",
                        detail=f"Unknown birthright type: '{birthright_type_raw}'",
                    )
                )
                continue

            # Generate entry ID
            entry_id = _to_camel_case(name)
            if not entry_id:
                entry_id = f"birthright_{i + 1:03d}"

            # Determine point cost from dot notation
            point_cost = self._extract_point_cost(block_text, match)

            # Find page number
            absolute_pos = section_offset + block_start
            page_num = _find_page_number(text, absolute_pos)
            source = f"{source_filename} p.{page_num}"

            # Extract description (text after heading, before mechanical keywords)
            description = self._extract_description(block_text, match)

            # Extract mechanical effects
            mechanical_effects = self._extract_mechanical_effects(block_text)

            # Build the entry
            entry: dict[str, Any] = {
                "id": entry_id,
                "name": name,
                "birthrightType": birthright_type,
                "pointCost": point_cost,
                "description": description,
                "mechanicalEffects": mechanical_effects,
                "source": source,
            }

            # Type-specific details
            if birthright_type == "creature":
                creature_details = self._extract_creature_details(
                    block_text, stat_block_pattern, entry_id, log
                )
                if creature_details:
                    entry["creatureDetails"] = creature_details

            elif birthright_type == "relic":
                relic_details = self._extract_relic_details(
                    block_text, point_cost, entry_id, log
                )
                entry["relicDetails"] = relic_details

            entries[entry_id] = entry

        return CategoryResult(
            category="birthrights",
            entries=entries,
            entry_count=len(entries),
            log=log,
        )

    def validate_config(self, category_config: dict) -> list[str]:
        """Validate the birthrights category configuration block.

        Required fields:
        - section_anchors: At least one anchor to locate the Birthrights section
        - heading_pattern: Regex with named groups 'name' and 'type'

        Optional:
        - stat_block_pattern: Regex for creature stat blocks
        - expected_fields: List of expected output fields
        """
        errors: list[str] = []

        # Check section_anchors
        anchors = category_config.get("section_anchors")
        if not anchors:
            errors.append("birthrights: 'section_anchors' is required and must be non-empty")
        elif not isinstance(anchors, list):
            errors.append("birthrights: 'section_anchors' must be a list")

        # Check heading_pattern
        heading = category_config.get("heading_pattern")
        if not heading:
            errors.append("birthrights: 'heading_pattern' is required")
        elif not isinstance(heading, dict):
            errors.append("birthrights: 'heading_pattern' must be a dict with 'regex' key")
        else:
            regex = heading.get("regex", "")
            if not regex:
                errors.append("birthrights: 'heading_pattern.regex' is required")
            else:
                # Verify the regex has named groups for name and type
                try:
                    compiled = re.compile(regex)
                    groups = compiled.groupindex
                    if "name" not in groups:
                        errors.append(
                            "birthrights: heading_pattern regex must have a 'name' named group"
                        )
                    if "type" not in groups:
                        errors.append(
                            "birthrights: heading_pattern regex must have a 'type' named group"
                        )
                except re.error as e:
                    errors.append(f"birthrights: heading_pattern regex is invalid: {e}")

        # Validate stat_block_pattern if provided
        stat_pattern = category_config.get("stat_block_pattern")
        if stat_pattern:
            try:
                re.compile(stat_pattern, re.DOTALL)
            except re.error as e:
                errors.append(f"birthrights: stat_block_pattern is invalid regex: {e}")

        return errors

    def _find_section(
        self, text: str, category_config: dict, log: list[LogEntry]
    ) -> tuple[str | None, int]:
        """Locate the birthrights section in the text using section anchors.

        Returns the section text and its character offset in the full text,
        or (None, 0) if the section is not found.
        """
        from parser_framework.extract_engine import find_section
        from parser_framework.models import SectionAnchor

        anchors_config = category_config.get("section_anchors", [])
        for anchor_cfg in anchors_config:
            if isinstance(anchor_cfg, dict):
                anchor = SectionAnchor(
                    pattern=anchor_cfg.get("pattern", ""),
                    pattern_type=anchor_cfg.get("pattern_type", "literal"),
                )
            else:
                anchor = SectionAnchor(pattern=str(anchor_cfg), pattern_type="literal")

            result = find_section(text, anchor)
            if result is not None:
                start, end = result
                return text[start:end], start

        log.append(
            LogEntry(
                entry_id="",
                field="section_anchors",
                reason="anchor_not_found",
                detail="Birthrights section not found via any configured anchor",
            )
        )
        return None, 0

    @staticmethod
    def _normalize_type(type_str: str) -> str:
        """Normalize a birthright type string to one of the known types."""
        type_map = {
            "relic": "relic",
            "creature": "creature",
            "follower": "follower",
            "followers": "follower",
            "guide": "guide",
            "cult": "cult",
        }
        return type_map.get(type_str.lower().strip(), "")

    @staticmethod
    def _extract_point_cost(block_text: str, heading_match: re.Match) -> int:
        """Extract point cost from dot notation in the block.

        Looks for dot symbols (•, ●) on the heading line or immediately after.
        Returns the count of dots, minimum 1.
        """
        # First check the heading line itself
        heading_line_end = block_text.find("\n", heading_match.end() - heading_match.start())
        if heading_line_end == -1:
            heading_line_end = len(block_text)
        heading_line = block_text[: heading_line_end]

        dots = _count_dots(heading_line)
        if dots > 0:
            return dots

        # Check the first few lines for dot notation
        lines = block_text.split("\n")[:5]
        for line in lines:
            dots = _count_dots(line)
            if dots > 0:
                return dots

        # Default to 1 if no dots found
        return 1

    @staticmethod
    def _extract_description(block_text: str, heading_match: re.Match) -> str:
        """Extract the description text from a birthright block.

        The description is the prose text after the heading, before any
        structured fields (Purview:, Tags:, Knack:, etc.).
        """
        # Start after the heading line
        heading_rel_end = heading_match.end() - heading_match.start()
        remainder = block_text[heading_rel_end:].strip()

        # Find where structured content begins
        struct_re = re.compile(
            r"^(?:Purviews?|Tags?|Knacks?|Motifs?|Evocation|Flaw|Primary Pool|Defense|Health|Enhancement):",
            re.MULTILINE | re.IGNORECASE,
        )
        struct_match = struct_re.search(remainder)
        if struct_match:
            description = remainder[: struct_match.start()].strip()
        else:
            # Take up to first double newline or all text
            double_nl = remainder.find("\n\n")
            if double_nl > 0:
                description = remainder[:double_nl].strip()
            else:
                description = remainder.strip()

        # Collapse whitespace
        description = re.sub(r"\s+", " ", description)
        return description

    @staticmethod
    def _extract_mechanical_effects(block_text: str) -> str:
        """Extract mechanical effects text from a birthright block.

        Looks for structured content like Purview, Knack, Flaw lines and
        combines them into the mechanical effects string.
        """
        effects_parts: list[str] = []

        # Look for known mechanical fields
        mechanical_fields = [
            "Purviews?",
            "Knacks?",
            "Flaws?",
            "Enhancement",
            "Primary Pool",
            "Defense",
            "Health",
        ]

        for field_pattern in mechanical_fields:
            field_re = re.compile(
                rf"({field_pattern}):\s*(.+?)(?:\n(?=[A-Z][a-z]*:)|\n\n|$)",
                re.IGNORECASE | re.DOTALL,
            )
            for match in field_re.finditer(block_text):
                field_name = match.group(1).strip()
                field_value = match.group(2).strip()
                if field_value:
                    effects_parts.append(f"{field_name}: {field_value}")

        result = " ".join(effects_parts)
        # Collapse whitespace
        result = re.sub(r"\s+", " ", result).strip()
        return result

    @staticmethod
    def _extract_creature_details(
        block_text: str,
        stat_block_pattern: str,
        entry_id: str,
        log: list[LogEntry],
    ) -> dict[str, Any] | None:
        """Extract creature-specific details using the stat_block_pattern.

        Returns a dict with primaryPool, defense, health, and tagIds,
        or None if no stat block is found.
        """
        details: dict[str, Any] = {"tagIds": []}

        if stat_block_pattern:
            stat_re = re.compile(stat_block_pattern, re.DOTALL | re.IGNORECASE)
            stat_match = stat_re.search(block_text)
            if stat_match:
                groups = stat_match.groupdict()
                try:
                    details["primaryPool"] = int(groups.get("primaryPool", 0))
                except (ValueError, TypeError):
                    details["primaryPool"] = 0
                try:
                    details["defense"] = int(groups.get("defense", 0))
                except (ValueError, TypeError):
                    details["defense"] = 0
                try:
                    details["health"] = int(groups.get("health", 0))
                except (ValueError, TypeError):
                    details["health"] = 0
            else:
                log.append(
                    LogEntry(
                        entry_id=entry_id,
                        field="creatureDetails",
                        reason="not_found",
                        detail="Stat block pattern did not match in creature block",
                    )
                )
                # Still return basic details without stats
                details["primaryPool"] = 0
                details["defense"] = 0
                details["health"] = 0
        else:
            # No stat_block_pattern configured, try inline parsing
            pool_re = re.compile(r"Primary\s+Pool:\s*(\d+)", re.IGNORECASE)
            def_re = re.compile(r"Defense:\s*(\d+)", re.IGNORECASE)
            health_re = re.compile(r"Health:\s*(\d+)", re.IGNORECASE)

            pool_match = pool_re.search(block_text)
            def_match = def_re.search(block_text)
            health_match = health_re.search(block_text)

            details["primaryPool"] = int(pool_match.group(1)) if pool_match else 0
            details["defense"] = int(def_match.group(1)) if def_match else 0
            details["health"] = int(health_match.group(1)) if health_match else 0

        # Extract tags for creatures
        details["tagIds"] = _extract_tags(block_text)

        return details

    @staticmethod
    def _extract_relic_details(
        block_text: str,
        point_cost: int,
        entry_id: str,
        log: list[LogEntry],
    ) -> dict[str, Any]:
        """Extract relic-specific details.

        Returns a dict with rating, tagIds, purviewId, purviewRating,
        evocation, and motifsAndTags.
        """
        # Rating is typically equal to point cost for relics
        rating = point_cost

        # Extract purview ID
        purview_id = _extract_purview_id(block_text)

        # Extract purview rating (defaults to 1)
        purview_rating = 1
        if purview_id:
            purview_rating_re = re.compile(
                r"(?:Purview\s+Rating|Rating):\s*(\d+)", re.IGNORECASE
            )
            rating_match = purview_rating_re.search(block_text)
            if rating_match:
                purview_rating = int(rating_match.group(1))

        # Extract tags
        tag_ids = _extract_tags(block_text)

        # Extract evocation
        evocation = _extract_evocation(block_text)

        # Extract motifs and tags text
        motifs_and_tags = _extract_motifs_and_tags(block_text)

        return {
            "rating": rating,
            "tagIds": tag_ids,
            "purviewId": purview_id,
            "purviewRating": purview_rating,
            "evocation": evocation,
            "motifsAndTags": motifs_and_tags,
        }
