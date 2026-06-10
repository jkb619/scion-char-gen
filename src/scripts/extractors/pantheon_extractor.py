"""Pantheon category extractor.

Extracts pantheon definitions from PDF text that contains pantheon sections.
Each pantheon has a name, asset skills, description, mechanical effects,
source provenance, and a list of deities with callings and purviews.

Extraction Strategy:
1. Locate the Pantheons section (typically in appendices) using section anchors.
2. Split by pantheon heading (e.g., "Æsir — Norse").
3. Extract `assetSkills` from the "Asset Skills:" line.
4. Parse deity lists as sub-entries with callings and purviews.
5. Record `source` as `<filename> p.<page_number>` from nearest preceding page marker.
"""

from __future__ import annotations

import re
from typing import Any

from extractors.base import CategoryExtractor, CategoryResult, LogEntry
from parser_framework.models import BookSpec


# Page marker pattern inserted by the ingestion stage (e.g., "--- Page 42 ---")
_PAGE_MARKER_RE = re.compile(r"^-{3,}\s*Page\s+(\d+)\s*-{3,}$", re.MULTILINE)

# Pattern to match "Asset Skills:" lines and capture the skill list
_ASSET_SKILLS_RE = re.compile(
    r"Asset\s+Skills?\s*:\s*(.+)",
    re.IGNORECASE,
)

# Pattern to match deity entries in the text.
# Typical format:
#   "Odin: Callings: Leader, Sage, Trickster. Purviews: ..."
#   or structured as name followed by callings and purviews on separate lines
_DEITY_LINE_RE = re.compile(
    r"^(?P<name>[A-ZÀ-Ž][A-Za-zÀ-ž\s'''\-]+?)\s*[:\-–—]\s*"
    r"(?:Callings?\s*[:\-–—]\s*(?P<callings>[^.;]+?)[.;]?\s*"
    r"(?:Purviews?\s*[:\-–—]\s*(?P<purviews>[^.\n]+))?)?$",
    re.MULTILINE | re.IGNORECASE,
)

# Alternative deity pattern: name on its own line followed by Callings/Purviews
_DEITY_BLOCK_NAME_RE = re.compile(
    r"^(?P<name>[A-ZÀ-Ž][A-Za-zÀ-ž\s'''\-()]+?)\s*$",
    re.MULTILINE,
)

_CALLINGS_LINE_RE = re.compile(
    r"Callings?\s*[:\-–—]\s*(?P<callings>.+)",
    re.IGNORECASE,
)

_PURVIEWS_LINE_RE = re.compile(
    r"Purviews?\s*[:\-–—]\s*(?P<purviews>.+)",
    re.IGNORECASE,
)


def _to_camel_case_id(name: str) -> str:
    """Convert a name string to a camelCase identifier.

    For pantheon names with tradition suffix (e.g., "Æsir — Norse"),
    uses only the part before the dash for the ID.

    Examples:
        "Æsir — Norse" -> "aesir"
        "Æsir" -> "aesir"
        "Odin" -> "odin"
        "The Orisha" -> "theOrisha"
        "Devá" -> "deva"
    """
    # If the name contains an em-dash or en-dash separator (pantheon heading), use only the first part
    # We only match em-dash (—) or en-dash (–) with surrounding spaces, not plain hyphens
    # which may be part of names like "Susano-o"
    dash_match = re.match(r"^(.+?)\s+[—–]\s+.+$", name)
    if dash_match:
        name = dash_match.group(1)

    # Normalize special characters
    normalized = name.strip()
    # Replace special chars with ASCII equivalents
    replacements = {
        "Æ": "Ae", "æ": "ae",
        "ð": "d", "Ð": "D",
        "þ": "th", "Þ": "Th",
        "ø": "o", "Ø": "O",
        "á": "a", "à": "a", "â": "a", "ä": "a", "å": "a",
        "é": "e", "è": "e", "ê": "e", "ë": "e",
        "í": "i", "ì": "i", "î": "i", "ï": "i",
        "ó": "o", "ò": "o", "ô": "o", "ö": "o",
        "ú": "u", "ù": "u", "û": "u", "ü": "u",
        "ñ": "n", "ý": "y", "ÿ": "y",
        "ā": "a", "ē": "e", "ī": "i", "ō": "o", "ū": "u",
        "ś": "s", "ṣ": "s", "ṃ": "m", "ṇ": "n", "ṛ": "r",
        "á": "a", "é": "e",
        "'": "", "'": "", "'": "",
        "ð": "d",
    }
    for char, replacement in replacements.items():
        normalized = normalized.replace(char, replacement)

    # Remove any remaining non-ASCII characters
    normalized = normalized.encode("ascii", "ignore").decode("ascii")

    # Split into words
    words = re.split(r"[\s_]+", normalized)
    words = [w for w in words if w]

    if not words:
        return ""

    # First word all lowercase, subsequent words capitalized
    result = words[0].lower()
    for word in words[1:]:
        result += word.capitalize()

    # Remove non-alphanumeric characters (hyphens within names get stripped)
    result = re.sub(r"[^a-zA-Z0-9]", "", result)

    return result


def _parse_skill_list(skills_text: str) -> list[str]:
    """Parse a comma-separated skill list into camelCase skill IDs.

    Examples:
        "Close Combat, Occult" -> ["closeCombat", "occult"]
        "Athletics, Integrity, and Empathy" -> ["athletics", "integrity", "empathy"]
    """
    # Remove trailing punctuation and "and"
    cleaned = re.sub(r"\s+and\s+", ", ", skills_text, flags=re.IGNORECASE)
    cleaned = cleaned.rstrip(".,;")

    parts = [p.strip() for p in cleaned.split(",")]
    skills: list[str] = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        skill_id = _to_camel_case_id(part)
        if skill_id:
            skills.append(skill_id)

    return skills


def _parse_callings_list(callings_text: str) -> list[str]:
    """Parse a comma-separated callings list into lowercase calling IDs.

    Examples:
        "Leader, Sage, Trickster" -> ["leader", "sage", "trickster"]
    """
    cleaned = re.sub(r"\s+and\s+", ", ", callings_text, flags=re.IGNORECASE)
    cleaned = cleaned.rstrip(".,;")

    parts = [p.strip() for p in cleaned.split(",")]
    callings: list[str] = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        calling_id = part.lower().strip()
        # Remove non-alpha chars
        calling_id = re.sub(r"[^a-z]", "", calling_id)
        if calling_id:
            callings.append(calling_id)

    return callings


def _parse_purviews_list(purviews_text: str) -> list[str]:
    """Parse a comma-separated purviews list into camelCase purview IDs.

    Examples:
        "Epic Stamina, Death, War" -> ["epicStamina", "death", "war"]
    """
    cleaned = re.sub(r"\s+and\s+", ", ", purviews_text, flags=re.IGNORECASE)
    cleaned = cleaned.rstrip(".,;")

    parts = [p.strip() for p in cleaned.split(",")]
    purviews: list[str] = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        purview_id = _to_camel_case_id(part)
        if purview_id:
            purviews.append(purview_id)

    return purviews


class PantheonExtractor(CategoryExtractor):
    """Extracts pantheon definitions from ingested PDF text.

    Pantheons are game-data entries representing divine families (Æsir, Theoi,
    Kami, etc.) with asset skills and a list of deities with their callings
    and purviews.
    """

    def extract(self, text: str, spec: BookSpec, category_config: dict) -> CategoryResult:
        """Extract pantheon entries from the ingested text.

        Args:
            text: Full ingested plaintext from the PDF (with page markers).
            spec: The BookSpec for the current book being processed.
            category_config: The pantheons category configuration block.

        Returns:
            A CategoryResult with extracted pantheon entries keyed by id.
        """
        log: list[LogEntry] = []
        entries: dict[str, Any] = {}

        # Determine the source filename from the spec
        source_filename = spec.filenames[0] if spec.filenames else "unknown.pdf"

        # Step 1: Locate the Pantheons section using section anchors
        section_text = self._find_pantheons_section(text, category_config, log)
        if section_text is None:
            return CategoryResult(
                category="pantheons",
                entries={},
                entry_count=0,
                log=log,
            )

        # Step 2: Compile the heading pattern from config
        heading_pattern = self._get_heading_pattern(category_config, log)
        if heading_pattern is None:
            return CategoryResult(
                category="pantheons",
                entries={},
                entry_count=0,
                log=log,
            )

        # Step 3: Split the section by pantheon headings
        pantheon_blocks = self._split_by_headings(section_text, heading_pattern)

        # Step 4: Extract data from each pantheon block
        for name, block in pantheon_blocks:
            pantheon_id = _to_camel_case_id(name)
            if not pantheon_id:
                continue

            page_number = self._find_page_number(text, block, section_text)
            source = f"{source_filename} p.{page_number}"

            # Parse the pantheon block for asset skills, description, and deities
            asset_skills = self._extract_asset_skills(block)
            description, mechanical_effects = self._parse_description(block)
            deities = self._parse_deities(block, log, pantheon_id)

            if not asset_skills:
                log.append(LogEntry(
                    entry_id=pantheon_id,
                    field="assetSkills",
                    reason="not_found",
                    detail=f"No asset skills found for pantheon '{name}'",
                ))

            if not deities:
                log.append(LogEntry(
                    entry_id=pantheon_id,
                    field="deities",
                    reason="not_found",
                    detail=f"No deities found for pantheon '{name}'",
                ))

            entries[pantheon_id] = {
                "id": pantheon_id,
                "name": name,
                "assetSkills": asset_skills,
                "description": description,
                "mechanicalEffects": mechanical_effects,
                "source": source,
                "deities": deities,
            }

        return CategoryResult(
            category="pantheons",
            entries=entries,
            entry_count=len(entries),
            log=log,
        )

    def validate_config(self, category_config: dict) -> list[str]:
        """Validate the pantheons category configuration block.

        Required fields:
        - section_anchors: At least one anchor to locate the Pantheons section.
        - heading_pattern: Regex to identify pantheon name headings.
        - expected_fields: List of expected output fields.

        Args:
            category_config: The pantheons category configuration dict.

        Returns:
            List of validation error messages. Empty if valid.
        """
        errors: list[str] = []

        if "section_anchors" not in category_config:
            errors.append("pantheons: missing required field 'section_anchors'")
        elif not category_config["section_anchors"]:
            errors.append("pantheons: 'section_anchors' must not be empty")

        if "heading_pattern" not in category_config:
            errors.append("pantheons: missing required field 'heading_pattern'")
        else:
            hp = category_config["heading_pattern"]
            if not isinstance(hp, dict) or "regex" not in hp:
                errors.append("pantheons: 'heading_pattern' must be a dict with 'regex' key")
            else:
                # Validate regex compiles
                try:
                    re.compile(hp["regex"])
                except re.error as e:
                    errors.append(f"pantheons: 'heading_pattern.regex' is invalid: {e}")

        if "expected_fields" not in category_config:
            errors.append("pantheons: missing required field 'expected_fields'")

        return errors

    def _find_pantheons_section(
        self, text: str, category_config: dict, log: list[LogEntry]
    ) -> str | None:
        """Locate the Pantheons section in the text using section anchors.

        Tries each section anchor in order. Returns the text from the first
        matching anchor to the end of text (or to the next major section).

        Returns None if no anchor matches.
        """
        section_anchors = category_config.get("section_anchors", [])
        if not section_anchors:
            log.append(LogEntry(
                entry_id="",
                field="",
                reason="anchor_not_found",
                detail="No section anchors configured for pantheons",
            ))
            return None

        for anchor_cfg in section_anchors:
            pattern = anchor_cfg.get("pattern", "")
            pattern_type = anchor_cfg.get("pattern_type", "literal")

            match_start = self._find_anchor_in_text(text, pattern, pattern_type)
            if match_start is not None:
                return text[match_start:]

        log.append(LogEntry(
            entry_id="",
            field="",
            reason="anchor_not_found",
            detail="No pantheons section anchor matched in text",
        ))
        return None

    def _find_anchor_in_text(
        self, text: str, pattern: str, pattern_type: str
    ) -> int | None:
        """Find an anchor pattern in text, returning start offset or None."""
        if pattern_type == "regex":
            try:
                match = re.search(pattern, text, re.MULTILINE)
                if match:
                    return match.start()
            except re.error:
                pass
        else:
            # Literal: case-insensitive search for the anchor
            idx = text.find(pattern)
            if idx >= 0:
                return idx
            # Case-insensitive fallback
            lower_text = text.lower()
            lower_pattern = pattern.lower()
            idx = lower_text.find(lower_pattern)
            if idx >= 0:
                return idx

        return None

    def _get_heading_pattern(
        self, category_config: dict, log: list[LogEntry]
    ) -> re.Pattern | None:
        """Compile the heading pattern from category config.

        Returns the compiled regex or None if not configured/invalid.
        """
        hp_config = category_config.get("heading_pattern")
        if not hp_config or not isinstance(hp_config, dict):
            log.append(LogEntry(
                entry_id="",
                field="",
                reason="heading_unmatched",
                detail="No heading_pattern configured for pantheons",
            ))
            return None

        regex_str = hp_config.get("regex", "")
        flags = re.MULTILINE
        for flag_name in hp_config.get("flags", []):
            flag_val = getattr(re, flag_name, None)
            if flag_val is not None:
                flags |= flag_val

        try:
            return re.compile(regex_str, flags)
        except re.error as e:
            log.append(LogEntry(
                entry_id="",
                field="",
                reason="heading_unmatched",
                detail=f"Invalid heading pattern regex: {e}",
            ))
            return None

    def _split_by_headings(
        self, section_text: str, heading_pattern: re.Pattern
    ) -> list[tuple[str, str]]:
        """Split section text into (name, block) tuples by heading matches.

        Each block spans from one heading match to the next (or end of section).
        The full matched line is used as the display name for the pantheon
        (e.g., "Æsir — Norse"), preserving the tradition suffix.

        Matches that look like deity entries (contain "Callings:" or "Purviews:"
        after the separator) are skipped.

        Returns:
            List of (pantheon_name, block_text) tuples.
        """
        matches = list(heading_pattern.finditer(section_text))
        if not matches:
            return []

        # Filter out matches that look like deity lines rather than pantheon headings
        filtered_matches: list[re.Match] = []
        for match in matches:
            full_text = match.group(0)
            # If the text after the separator contains deity keywords, skip it
            tradition = match.group("tradition") if "tradition" in heading_pattern.groupindex else ""
            if tradition and re.match(
                r"\s*(?:Callings?|Purviews?)\s*:", tradition, re.IGNORECASE
            ):
                continue
            filtered_matches.append(match)

        if not filtered_matches:
            return []

        blocks: list[tuple[str, str]] = []
        for i, match in enumerate(filtered_matches):
            # Use the full matched text as the pantheon display name
            name = match.group(0).strip()

            start = match.start()
            end = filtered_matches[i + 1].start() if i + 1 < len(filtered_matches) else len(section_text)
            block_text = section_text[start:end]

            blocks.append((name, block_text))

        return blocks

    def _extract_asset_skills(self, block: str) -> list[str]:
        """Extract asset skills from the pantheon block.

        Looks for a line like "Asset Skills: Close Combat, Occult" and parses
        the skill names into camelCase IDs.

        Returns:
            List of skill IDs (camelCase), or empty list if not found.
        """
        match = _ASSET_SKILLS_RE.search(block)
        if not match:
            return []

        skills_text = match.group(1).strip()
        return _parse_skill_list(skills_text)

    def _parse_description(self, block: str) -> tuple[str, str]:
        """Parse a pantheon block to extract description and mechanical effects.

        The block typically starts with the pantheon heading, followed by
        descriptive prose. Mechanical effects relate to asset skills usage.

        Returns:
            A tuple of (description, mechanical_effects) as strings.
        """
        lines = block.split("\n")

        # Skip the heading line (first non-empty line)
        content_lines: list[str] = []
        found_heading = False
        for line in lines:
            if not found_heading and line.strip():
                found_heading = True
                continue  # Skip the heading itself
            content_lines.append(line)

        content = "\n".join(content_lines).strip()

        if not content:
            return ("", "")

        # Separate out the asset skills line and deity entries from description
        # Description is the prose before Asset Skills or deity listings
        desc_parts: list[str] = []
        mech_parts: list[str] = []

        paragraphs = re.split(r"\n\s*\n", content)

        for para in paragraphs:
            para_stripped = para.strip()
            if not para_stripped:
                continue

            # Skip lines that are deity entries or asset skills
            if _ASSET_SKILLS_RE.match(para_stripped):
                mech_parts.append(para_stripped)
                continue
            if self._looks_like_deity_section(para_stripped):
                break  # Stop description at deity section

            # Check for mechanical-sounding content
            mech_indicators = [
                r"^(?:Knacks|Effects|Mechanics|Mechanical Effects)\s*:",
                r"^(?:Virtues)\s*:",
                r"Society\s+Path",
            ]
            is_mechanical = False
            for indicator in mech_indicators:
                if re.search(indicator, para_stripped, re.IGNORECASE):
                    is_mechanical = True
                    break

            if is_mechanical:
                mech_parts.append(para_stripped)
            else:
                desc_parts.append(para_stripped)

        description = " ".join(desc_parts)
        mechanical_effects = " ".join(mech_parts)

        # Collapse internal whitespace
        description = re.sub(r"\s+", " ", description).strip()
        mechanical_effects = re.sub(r"\s+", " ", mechanical_effects).strip()

        return (description, mechanical_effects)

    def _looks_like_deity_section(self, text: str) -> bool:
        """Check if a text block looks like the start of a deity listing."""
        # Deity sections typically have names followed by callings/purviews
        lines = text.strip().split("\n")
        deity_indicators = 0
        for line in lines[:5]:  # Check first few lines
            if _CALLINGS_LINE_RE.search(line) or _PURVIEWS_LINE_RE.search(line):
                deity_indicators += 1
            if _DEITY_LINE_RE.match(line.strip()):
                deity_indicators += 1

        return deity_indicators >= 1

    def _parse_deities(
        self, block: str, log: list[LogEntry], pantheon_id: str
    ) -> list[dict[str, Any]]:
        """Parse deity entries from a pantheon block.

        Tries multiple patterns to handle different PDF formatting:
        1. Single-line format: "Name: Callings: X, Y. Purviews: A, B"
        2. Multi-line format: Name on one line, Callings/Purviews on following lines

        Returns:
            List of deity dictionaries with id, name, callings, purviews.
        """
        deities: list[dict[str, Any]] = []

        # Try single-line deity pattern first
        single_line_deities = self._parse_deities_single_line(block)
        if single_line_deities:
            return single_line_deities

        # Try multi-line deity pattern
        multi_line_deities = self._parse_deities_multi_line(block)
        if multi_line_deities:
            return multi_line_deities

        return deities

    def _parse_deities_single_line(self, block: str) -> list[dict[str, Any]]:
        """Parse deities in single-line format.

        Format: "Name: Callings: X, Y. Purviews: A, B"
        or: "Name — Callings: X, Y; Purviews: A, B"
        """
        deities: list[dict[str, Any]] = []

        for match in _DEITY_LINE_RE.finditer(block):
            name = match.group("name").strip()
            callings_text = match.group("callings") or ""
            purviews_text = match.group("purviews") or ""

            # Skip if name looks like a section header or the pantheon name itself
            if self._is_section_keyword(name):
                continue

            callings = _parse_callings_list(callings_text) if callings_text else []
            purviews = _parse_purviews_list(purviews_text) if purviews_text else []

            # Only include if we have at least callings or purviews
            if callings or purviews:
                deity_id = _to_camel_case_id(name)
                if deity_id:
                    deities.append({
                        "id": deity_id,
                        "name": name,
                        "callings": callings,
                        "purviews": purviews,
                    })

        return deities

    def _parse_deities_multi_line(self, block: str) -> list[dict[str, Any]]:
        """Parse deities in multi-line format.

        Format:
            Name
            Callings: X, Y, Z
            Purviews: A, B, C
        """
        deities: list[dict[str, Any]] = []
        lines = block.split("\n")

        i = 0
        while i < len(lines):
            line = lines[i].strip()

            # Skip empty lines, page markers, the heading, and non-deity content
            if not line or _PAGE_MARKER_RE.match(line):
                i += 1
                continue

            # Check if this line could be a deity name (capitalized, not a keyword)
            if (
                self._could_be_deity_name(line)
                and not self._is_section_keyword(line)
                and not _ASSET_SKILLS_RE.match(line)
                and not _CALLINGS_LINE_RE.match(line)
                and not _PURVIEWS_LINE_RE.match(line)
            ):
                name = line.rstrip(":").strip()
                callings: list[str] = []
                purviews: list[str] = []

                # Look ahead for Callings and Purviews lines
                j = i + 1
                while j < len(lines) and j <= i + 4:
                    next_line = lines[j].strip()
                    if not next_line:
                        j += 1
                        continue

                    callings_match = _CALLINGS_LINE_RE.match(next_line)
                    if callings_match:
                        callings = _parse_callings_list(callings_match.group("callings"))
                        j += 1
                        continue

                    purviews_match = _PURVIEWS_LINE_RE.match(next_line)
                    if purviews_match:
                        purviews = _parse_purviews_list(purviews_match.group("purviews"))
                        j += 1
                        continue

                    # If we hit something that isn't callings/purviews, stop
                    break

                # Only add if we found callings or purviews
                if callings or purviews:
                    deity_id = _to_camel_case_id(name)
                    if deity_id:
                        deities.append({
                            "id": deity_id,
                            "name": name,
                            "callings": callings,
                            "purviews": purviews,
                        })
                    i = j
                    continue

            i += 1

        return deities

    def _could_be_deity_name(self, line: str) -> bool:
        """Check if a line could plausibly be a deity name.

        Deity names are typically:
        - Start with an uppercase letter (including accented)
        - Are relatively short (not full paragraphs)
        - Don't contain common section indicators
        """
        if not line:
            return False

        # Must start with an uppercase letter (including accented chars)
        if not re.match(r"^[A-ZÀ-Ž]", line):
            return False

        # Should be reasonably short (names aren't full paragraphs)
        if len(line) > 60:
            return False

        # Should not look like a sentence (no periods mid-text)
        if ". " in line:
            return False

        return True

    def _is_section_keyword(self, text: str) -> bool:
        """Check if text is a section keyword rather than a deity name."""
        keywords = {
            "pantheons", "pantheon", "asset skills", "callings", "purviews",
            "description", "virtues", "mechanical effects", "knacks",
            "society path", "deities", "titans",
        }
        return text.lower().strip().rstrip(":") in keywords

    def _find_page_number(
        self, full_text: str, block: str, section_text: str
    ) -> int:
        """Find the page number for a pantheon block.

        Searches for the nearest preceding page marker before the block's
        position in the full text.

        Returns:
            The page number as an integer, or 1 if no page marker is found.
        """
        # Find where this block appears in the full text
        block_start_snippet = block[:80].strip()
        block_pos = full_text.find(block_start_snippet)

        if block_pos < 0:
            # Fallback: search in section_text relative position
            block_pos = full_text.find(section_text[:80].strip())
            if block_pos < 0:
                return 1

        # Find all page markers before this position
        preceding_text = full_text[:block_pos]
        page_matches = list(_PAGE_MARKER_RE.finditer(preceding_text))

        if page_matches:
            return int(page_matches[-1].group(1))

        return 1
