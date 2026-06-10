"""Equipment category extractor.

Extracts equipment entries (weapons, armor, tools, accessories, heavy items,
vehicles, general equipment) from ingested PDF text using section anchors,
heading patterns, and tag notation parsing.

Extraction Strategy:
1. Locate the Equipment section via section anchors.
2. Split by item heading pattern to isolate individual equipment blocks.
3. Apply tag_pattern to extract tag notation (e.g., "Tags: Ranged (0), Lethal (0)").
4. Parse tag names into tagIds (normalize to camelCase matching tags.json keys).
5. Determine equipmentType from context (weapon section, armor section, etc.).
"""

from __future__ import annotations

import re
from typing import Any

from extractors.base import CategoryExtractor, CategoryResult, LogEntry
from parser_framework.models import BookSpec


# Page marker pattern used by the ingest engine (e.g., "--- Page 42 ---")
_PAGE_MARKER_RE = re.compile(r"^---\s*Page\s+(\d+)\s*---$", re.MULTILINE)

# Valid equipment types
_VALID_EQUIPMENT_TYPES = frozenset(
    ["weapon", "armor", "tool", "accessory", "heavy", "vehicle", "general"]
)

# Keywords that indicate equipment type from surrounding context
_WEAPON_KEYWORDS = re.compile(
    r"\b(?:weapon|sword|axe|knife|bow|gun|firearm|pistol|rifle|spear|dagger|blade|club"
    r"|mace|hammer|staff|whip|flail|crossbow|shotgun|smg|melee|ranged weapon"
    r"|close combat|firearms)\b",
    re.IGNORECASE,
)
_ARMOR_KEYWORDS = re.compile(
    r"\b(?:armor|armour|shield|helm|helmet|vest|plate|chainmail|breastplate"
    r"|greaves|gauntlet|protection|protective)\b",
    re.IGNORECASE,
)
_VEHICLE_KEYWORDS = re.compile(
    r"\b(?:vehicle|car|truck|motorcycle|bike|boat|ship|aircraft|plane|helicopter"
    r"|chariot|mount)\b",
    re.IGNORECASE,
)
_HEAVY_KEYWORDS = re.compile(
    r"\b(?:heavy weapon|heavy equipment|siege|artillery|cannon|turret"
    r"|mounted weapon|crew[- ]served)\b",
    re.IGNORECASE,
)
_TOOL_KEYWORDS = re.compile(
    r"\b(?:tool|toolkit|kit|lockpick|grapple|rope|binoculars|scope"
    r"|computer|phone|radio|device|instrument|equipment kit)\b",
    re.IGNORECASE,
)
_ACCESSORY_KEYWORDS = re.compile(
    r"\b(?:accessory|amulet|ring|pendant|charm|talisman|necklace|bracelet"
    r"|earring|circlet|cloak|cape|boots|gloves)\b",
    re.IGNORECASE,
)

# Section heading patterns that indicate equipment type context
_SECTION_TYPE_PATTERNS = {
    "weapon": re.compile(
        r"(?:^|\n)(?:#+\s*)?(?:weapons?|melee weapons?|ranged weapons?|firearms?|close combat)\s*$",
        re.IGNORECASE | re.MULTILINE,
    ),
    "armor": re.compile(
        r"(?:^|\n)(?:#+\s*)?(?:armou?r|protective gear|shields?)\s*$",
        re.IGNORECASE | re.MULTILINE,
    ),
    "vehicle": re.compile(
        r"(?:^|\n)(?:#+\s*)?(?:vehicles?|mounts?|transport)\s*$",
        re.IGNORECASE | re.MULTILINE,
    ),
    "heavy": re.compile(
        r"(?:^|\n)(?:#+\s*)?(?:heavy weapons?|siege|artillery)\s*$",
        re.IGNORECASE | re.MULTILINE,
    ),
    "tool": re.compile(
        r"(?:^|\n)(?:#+\s*)?(?:tools?|kits?|equipment kits?|gear)\s*$",
        re.IGNORECASE | re.MULTILINE,
    ),
    "accessory": re.compile(
        r"(?:^|\n)(?:#+\s*)?(?:accessories|trinkets?|wearables?)\s*$",
        re.IGNORECASE | re.MULTILINE,
    ),
}

# Tags that strongly indicate weapon type
_WEAPON_TAG_NAMES = frozenset([
    "lethal", "melee", "ranged", "thrown", "firearm", "sharp", "blunt",
    "concealableWeapon", "twoHanded", "reach", "piercing", "stun",
    "automatic", "longRange", "shortRange", "burst",
])

# Tags that strongly indicate armor type
_ARMOR_TAG_NAMES = frozenset([
    "softArmor", "hardArmor", "ballisticArmor", "armored", "shield",
    "concealed", "cumbersome",
])


def _to_camel_case(name: str) -> str:
    """Convert a name string to a camelCase identifier.

    Strips punctuation, splits on whitespace/hyphens, and joins with camelCase.

    Examples:
        "Ranged" -> "ranged"
        "Soft Armor" -> "softArmor"
        "Long Range" -> "longRange"
        "Two-Handed" -> "twoHanded"
        "Concealable Weapon" -> "concealableWeapon"
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


def _find_page_number(text: str, position: int) -> int:
    """Find the page number for a given character position.

    Searches backwards from position for the nearest page marker.
    Returns the page number or 1 if no marker is found.
    """
    last_page = 1
    for match in _PAGE_MARKER_RE.finditer(text):
        if match.start() <= position:
            last_page = int(match.group(1))
        else:
            break
    return last_page


def _parse_tags(tags_text: str) -> list[str]:
    """Parse a tags string into a list of camelCase tag IDs.

    Handles formats like:
        "Ranged (0), Lethal (0)"
        "Melee, Sharp, Two-Handed"
        "Soft Armor (1), Concealed"

    Parenthetical values (point costs) are stripped before conversion.
    """
    if not tags_text.strip():
        return []

    # Split on commas and semicolons
    raw_tags = re.split(r"[,;]", tags_text)
    tag_ids: list[str] = []
    for tag in raw_tags:
        # Remove parenthetical content like "(0)", "(1)", "(2)"
        tag_clean = re.sub(r"\s*\([^)]*\)", "", tag).strip()
        if tag_clean:
            tag_id = _to_camel_case(tag_clean)
            if tag_id:
                tag_ids.append(tag_id)
    return tag_ids


def _determine_equipment_type_from_tags(tag_ids: list[str]) -> str:
    """Infer equipment type from the extracted tag IDs.

    Returns the most likely equipment type based on tag presence.
    """
    tag_set = frozenset(tag_ids)
    if tag_set & _WEAPON_TAG_NAMES:
        return "weapon"
    if tag_set & _ARMOR_TAG_NAMES:
        return "armor"
    return ""


def _determine_equipment_type_from_context(
    block_text: str, section_text: str, block_start: int
) -> str:
    """Determine equipment type from surrounding section context.

    Checks for type-indicating section headings above the block position,
    then falls back to keyword analysis of the block text itself.
    """
    # Check for section type headings that appear before this block
    text_before = section_text[:block_start]
    best_type = ""
    best_pos = -1

    for eq_type, pattern in _SECTION_TYPE_PATTERNS.items():
        for match in pattern.finditer(text_before):
            if match.start() > best_pos:
                best_pos = match.start()
                best_type = eq_type

    if best_type:
        return best_type

    # Fall back to keyword analysis of the block itself
    if _WEAPON_KEYWORDS.search(block_text):
        return "weapon"
    if _ARMOR_KEYWORDS.search(block_text):
        return "armor"
    if _HEAVY_KEYWORDS.search(block_text):
        return "heavy"
    if _VEHICLE_KEYWORDS.search(block_text):
        return "vehicle"
    if _TOOL_KEYWORDS.search(block_text):
        return "tool"
    if _ACCESSORY_KEYWORDS.search(block_text):
        return "accessory"

    return "general"


class EquipmentExtractor(CategoryExtractor):
    """Extractor for equipment entries (weapons, armor, tools, accessories, etc.).

    Uses the Book Spec's equipment category config which includes:
    - section_anchors: To locate the Equipment chapter
    - heading_pattern: Regex with named group 'name' for item headings
    - tag_pattern: Regex to extract tag notation from item blocks
    """

    def extract(self, text: str, spec: BookSpec, category_config: dict) -> CategoryResult:
        """Extract equipment entries from ingested text.

        Args:
            text: Full ingested plaintext from the PDF (with page markers).
            spec: The BookSpec for the current book being processed.
            category_config: The equipment category config block.

        Returns:
            CategoryResult with all extracted equipment entries.
        """
        log: list[LogEntry] = []
        entries: dict[str, Any] = {}

        # Determine the source filename from the spec
        source_filename = spec.filenames[0] if spec.filenames else spec.book_id

        # Step 1: Locate the Equipment section
        section_text, section_offset = self._find_section(text, category_config, log)
        if section_text is None:
            return CategoryResult(
                category="equipment", entries={}, entry_count=0, log=log
            )

        # Step 2: Split by heading pattern
        heading_pattern = category_config.get("heading_pattern", {})
        heading_regex = heading_pattern.get("regex", "")
        if not heading_regex:
            log.append(
                LogEntry(
                    entry_id="",
                    field="heading_pattern",
                    reason="not_found",
                    detail="No heading_pattern regex configured for equipment",
                )
            )
            return CategoryResult(
                category="equipment", entries={}, entry_count=0, log=log
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
                    detail="No equipment headings matched in section text",
                )
            )
            return CategoryResult(
                category="equipment", entries={}, entry_count=0, log=log
            )

        # Get tag_pattern for extracting tags
        tag_pattern_str = category_config.get("tag_pattern", r"Tags:\s*(?P<tags>.+)")

        # Process each matched heading block
        for i, match in enumerate(matches):
            block_start = match.start()
            block_end = (
                matches[i + 1].start() if i + 1 < len(matches) else len(section_text)
            )
            block_text = section_text[block_start:block_end]

            # Extract name from the heading match
            name = (
                match.group("name").strip()
                if "name" in match.groupdict()
                else match.group(0).strip()
            )

            if not name:
                continue

            # Generate entry ID
            entry_id = _to_camel_case(name)
            if not entry_id:
                entry_id = f"equipment_{i + 1:03d}"

            # Step 3: Apply tag_pattern to extract tags
            tag_ids = self._extract_tags(block_text, tag_pattern_str, entry_id, log)

            # Step 5: Determine equipmentType from context
            equipment_type = _determine_equipment_type_from_tags(tag_ids)
            if not equipment_type:
                equipment_type = _determine_equipment_type_from_context(
                    block_text, section_text, block_start
                )

            # Find page number
            absolute_pos = section_offset + block_start
            page_num = _find_page_number(text, absolute_pos)
            source = f"{source_filename} p.{page_num}"

            # Extract description
            description = self._extract_description(block_text, match)

            # Extract mechanical effects
            mechanical_effects = self._extract_mechanical_effects(block_text)

            # Build the entry
            entry: dict[str, Any] = {
                "id": entry_id,
                "name": name,
                "equipmentType": equipment_type,
                "tagIds": tag_ids,
                "description": description,
                "mechanicalEffects": mechanical_effects,
                "source": source,
            }

            entries[entry_id] = entry

        return CategoryResult(
            category="equipment",
            entries=entries,
            entry_count=len(entries),
            log=log,
        )

    def validate_config(self, category_config: dict) -> list[str]:
        """Validate the equipment category configuration block.

        Required fields:
        - section_anchors: At least one anchor to locate the Equipment section
        - heading_pattern: Regex with at least a 'name' named group

        Optional:
        - tag_pattern: Regex for tag extraction (defaults to "Tags: ...")
        - expected_fields: List of expected output fields
        """
        errors: list[str] = []

        # Check section_anchors
        anchors = category_config.get("section_anchors")
        if not anchors:
            errors.append(
                "equipment: 'section_anchors' is required and must be non-empty"
            )
        elif not isinstance(anchors, list):
            errors.append("equipment: 'section_anchors' must be a list")

        # Check heading_pattern
        heading = category_config.get("heading_pattern")
        if not heading:
            errors.append("equipment: 'heading_pattern' is required")
        elif not isinstance(heading, dict):
            errors.append(
                "equipment: 'heading_pattern' must be a dict with 'regex' key"
            )
        else:
            regex = heading.get("regex", "")
            if not regex:
                errors.append("equipment: 'heading_pattern.regex' is required")
            else:
                try:
                    compiled = re.compile(regex)
                    groups = compiled.groupindex
                    if "name" not in groups:
                        errors.append(
                            "equipment: heading_pattern regex must have a 'name' named group"
                        )
                except re.error as e:
                    errors.append(
                        f"equipment: heading_pattern regex is invalid: {e}"
                    )

        # Validate tag_pattern if provided
        tag_pattern = category_config.get("tag_pattern")
        if tag_pattern:
            try:
                compiled = re.compile(tag_pattern)
                if "tags" not in compiled.groupindex:
                    errors.append(
                        "equipment: tag_pattern regex must have a 'tags' named group"
                    )
            except re.error as e:
                errors.append(f"equipment: tag_pattern is invalid regex: {e}")

        return errors

    def _find_section(
        self, text: str, category_config: dict, log: list[LogEntry]
    ) -> tuple[str | None, int]:
        """Locate the equipment section in the text using section anchors.

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
                detail="Equipment section not found via any configured anchor",
            )
        )
        return None, 0

    @staticmethod
    def _extract_tags(
        block_text: str,
        tag_pattern_str: str,
        entry_id: str,
        log: list[LogEntry],
    ) -> list[str]:
        """Extract tag IDs from a block using the configured tag_pattern.

        Returns a list of camelCase tag ID strings.
        """
        try:
            tag_re = re.compile(tag_pattern_str, re.IGNORECASE)
        except re.error:
            log.append(
                LogEntry(
                    entry_id=entry_id,
                    field="tagIds",
                    reason="parse_error",
                    detail=f"Invalid tag_pattern regex: {tag_pattern_str}",
                )
            )
            return []

        match = tag_re.search(block_text)
        if not match:
            return []

        # Get the tags text from the named group or the full match
        if "tags" in match.groupdict():
            tags_text = match.group("tags")
        else:
            tags_text = match.group(0)

        if not tags_text:
            return []

        return _parse_tags(tags_text)

    @staticmethod
    def _extract_description(block_text: str, heading_match: re.Match) -> str:
        """Extract description text from an equipment block.

        The description is the prose text after the heading, before any
        structured fields (Tags:, Damage:, Range:, etc.).
        """
        # Start after the heading line
        heading_rel_end = heading_match.end() - heading_match.start()
        remainder = block_text[heading_rel_end:].strip()

        # Find where structured content begins
        struct_re = re.compile(
            r"^(?:Tags?|Damage|Range|Enhancement|Effect|Cost|Requires?|Capacity|Caliber"
            r"|Rate of Fire|Clip|Speed|Handling|Structure):",
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
        """Extract mechanical effects text from an equipment block.

        Looks for structured content like Tags, Damage, Enhancement, Range
        lines and combines them into the mechanical effects string.
        """
        effects_parts: list[str] = []

        # Look for known mechanical fields
        mechanical_fields = [
            "Tags?",
            "Damage",
            "Range",
            "Enhancement",
            "Effect",
            "Requires?",
            "Capacity",
            "Caliber",
            "Rate of Fire",
            "Clip",
            "Speed",
            "Handling",
            "Structure",
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
