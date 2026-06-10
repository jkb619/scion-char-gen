"""Path category extractor.

Extracts path definitions from PDF text that contains path sections.
Each path has a name, pathKind (origin/role/societyPantheon), description,
suggested skills, mechanical effects, and source provenance.

Extraction Strategy:
1. Locate the Paths section using section anchors from category config.
2. Split by path name heading.
3. Determine `pathKind` from subsection context (Origin Paths, Role Paths,
   Society/Pantheon Paths).
4. Extract `suggestedSkills` from skill list references in the text.
5. Record `source` as `<filename> p.<page_number>` from nearest preceding page marker.
"""

from __future__ import annotations

import re
from typing import Any

from extractors.base import CategoryExtractor, CategoryResult, LogEntry
from parser_framework.models import BookSpec


# Page marker pattern inserted by the ingestion stage (e.g., "--- Page 42 ---")
_PAGE_MARKER_RE = re.compile(r"^-{3,}\s*Page\s+(\d+)\s*-{3,}$", re.MULTILINE)

# Patterns for identifying path kind subsections
_PATH_KIND_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bOrigin\s+Path", re.IGNORECASE), "origin"),
    (re.compile(r"\bRole\s+Path", re.IGNORECASE), "role"),
    (re.compile(r"\b(?:Society|Pantheon)\s+Path", re.IGNORECASE), "societyPantheon"),
    (re.compile(r"\bSociety/Pantheon\s+Path", re.IGNORECASE), "societyPantheon"),
    (re.compile(r"\bSociety\s*[/&]\s*Pantheon", re.IGNORECASE), "societyPantheon"),
]

# Common Scion skills for extraction from text
_KNOWN_SKILLS = [
    "academics", "athletics", "closeCombat", "close combat",
    "culture", "empathy", "firearms", "integrity", "leadership",
    "medicine", "occult", "persuasion", "pilot", "science",
    "subterfuge", "survival", "technology",
]

# Pattern to match skill list lines (e.g., "Skills: Athletics, Close Combat, Occult")
_SKILLS_LINE_RE = re.compile(
    r"(?:Skills?|Suggested\s+Skills?|Asset\s+Skills?)\s*[:：]\s*(.+)",
    re.IGNORECASE,
)


def _to_camel_case(name: str) -> str:
    """Convert a path name to a camelCase identifier.

    Examples:
        "Life of Privilege" -> "lifeOfPrivilege"
        "Professional Soldier" -> "professionalSoldier"
    """
    # Remove non-alphanumeric characters (except spaces)
    cleaned = re.sub(r"[^\w\s]", "", name)
    words = cleaned.split()
    if not words:
        return ""
    # First word lowercase, rest title-cased
    return words[0].lower() + "".join(w.capitalize() for w in words[1:])


def _normalize_skill_name(skill: str) -> str:
    """Normalize a skill name to camelCase identifier.

    Examples:
        "Close Combat" -> "closeCombat"
        "athletics" -> "athletics"
    """
    skill = skill.strip().strip(".,;")
    if not skill:
        return ""
    # Handle multi-word skills -> camelCase
    words = skill.split()
    if len(words) == 1:
        return words[0].lower()
    return words[0].lower() + "".join(w.capitalize() for w in words[1:])


class PathExtractor(CategoryExtractor):
    """Extracts path definitions from ingested PDF text.

    Paths are game-data entries representing character background elements
    (origin, role, or society/pantheon paths) with suggested skills and
    mechanical effects.
    """

    def extract(self, text: str, spec: BookSpec, category_config: dict) -> CategoryResult:
        """Extract path entries from the ingested text.

        Args:
            text: Full ingested plaintext from the PDF (with page markers).
            spec: The BookSpec for the current book being processed.
            category_config: The paths category configuration block.

        Returns:
            A CategoryResult with extracted path entries keyed by id.
        """
        log: list[LogEntry] = []
        entries: dict[str, Any] = {}

        # Determine the source filename from the spec
        source_filename = spec.filenames[0] if spec.filenames else "unknown.pdf"

        # Step 1: Locate the Paths section using section anchors
        section_text = self._find_paths_section(text, category_config, log)
        if section_text is None:
            return CategoryResult(
                category="paths",
                entries={},
                entry_count=0,
                log=log,
            )

        # Step 2: Compile the heading pattern from config
        heading_pattern = self._get_heading_pattern(category_config, log)
        if heading_pattern is None:
            return CategoryResult(
                category="paths",
                entries={},
                entry_count=0,
                log=log,
            )

        # Step 3: Split the section by path name headings
        path_blocks = self._split_by_headings(section_text, heading_pattern)

        # Step 4: Extract data from each path block
        for name, block in path_blocks:
            path_id = _to_camel_case(name)
            if not path_id:
                continue

            page_number = self._find_page_number(text, block, section_text)
            source = f"{source_filename} p.{page_number}"

            # Determine pathKind from surrounding context
            path_kind = self._determine_path_kind(text, block, section_text)

            # Extract suggested skills
            suggested_skills = self._extract_suggested_skills(block)

            # Parse description and mechanical effects
            description, mechanical_effects = self._parse_path_block(block)

            if not description:
                log.append(LogEntry(
                    entry_id=path_id,
                    field="description",
                    reason="not_found",
                    detail=f"No description found for path '{name}'",
                ))

            entries[path_id] = {
                "id": path_id,
                "name": name,
                "pathKind": path_kind,
                "description": description,
                "suggestedSkills": suggested_skills,
                "mechanicalEffects": mechanical_effects,
                "source": source,
            }

        return CategoryResult(
            category="paths",
            entries=entries,
            entry_count=len(entries),
            log=log,
        )

    def validate_config(self, category_config: dict) -> list[str]:
        """Validate the paths category configuration block.

        Required fields:
        - section_anchors: At least one anchor to locate the Paths section.
        - heading_pattern: Regex to identify path name headings.
        - expected_fields: List of expected output fields.

        Args:
            category_config: The paths category configuration dict.

        Returns:
            List of validation error messages. Empty if valid.
        """
        errors: list[str] = []

        if "section_anchors" not in category_config:
            errors.append("paths: missing required field 'section_anchors'")
        elif not category_config["section_anchors"]:
            errors.append("paths: 'section_anchors' must not be empty")

        if "heading_pattern" not in category_config:
            errors.append("paths: missing required field 'heading_pattern'")
        else:
            hp = category_config["heading_pattern"]
            if not isinstance(hp, dict) or "regex" not in hp:
                errors.append("paths: 'heading_pattern' must be a dict with 'regex' key")
            else:
                # Validate regex compiles
                try:
                    re.compile(hp["regex"])
                except re.error as e:
                    errors.append(f"paths: 'heading_pattern.regex' is invalid: {e}")

        if "expected_fields" not in category_config:
            errors.append("paths: missing required field 'expected_fields'")

        return errors

    def _find_paths_section(
        self, text: str, category_config: dict, log: list[LogEntry]
    ) -> str | None:
        """Locate the Paths section in the text using section anchors.

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
                detail="No section anchors configured for paths",
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
            detail="No paths section anchor matched in text",
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
                detail="No heading_pattern configured for paths",
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
        The name is extracted from the 'name' group in the heading pattern.

        Returns:
            List of (path_name, block_text) tuples.
        """
        matches = list(heading_pattern.finditer(section_text))
        if not matches:
            return []

        blocks: list[tuple[str, str]] = []
        for i, match in enumerate(matches):
            name = match.group("name") if "name" in heading_pattern.groupindex else match.group(0)
            name = name.strip()

            start = match.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(section_text)
            block_text = section_text[start:end]

            blocks.append((name, block_text))

        return blocks

    def _determine_path_kind(
        self, full_text: str, block: str, section_text: str
    ) -> str:
        """Determine the pathKind for a path block from subsection context.

        Looks backwards from the block's position in the section text to find
        the most recent path kind subsection heading (Origin Paths, Role Paths,
        Society/Pantheon Paths).

        Returns:
            One of "origin", "role", or "societyPantheon".
            Defaults to "origin" if no subsection context is found.
        """
        # Find where this block starts within the section text
        block_start_snippet = block[:80].strip()
        block_pos = section_text.find(block_start_snippet)
        if block_pos < 0:
            block_pos = 0

        # Look at the text preceding this block in the section
        preceding_text = section_text[:block_pos]

        # Search for the most recent path kind marker in preceding text
        best_kind = "origin"  # default
        best_pos = -1

        for pattern, kind in _PATH_KIND_PATTERNS:
            matches = list(pattern.finditer(preceding_text))
            if matches:
                last_match = matches[-1]
                if last_match.start() > best_pos:
                    best_pos = last_match.start()
                    best_kind = kind

        return best_kind

    def _extract_suggested_skills(self, block: str) -> list[str]:
        """Extract suggested skills from a path block.

        Looks for explicit skill list lines (e.g., "Skills: Athletics, Occult")
        and also scans for known skill name references in the text.

        Returns:
            A list of skill identifiers in camelCase format.
        """
        skills: list[str] = []
        seen: set[str] = set()

        # First, try explicit skill list lines
        for match in _SKILLS_LINE_RE.finditer(block):
            skills_text = match.group(1)
            # Split by comma or semicolon
            for raw_skill in re.split(r"[,;]", skills_text):
                normalized = _normalize_skill_name(raw_skill)
                if normalized and normalized not in seen:
                    skills.append(normalized)
                    seen.add(normalized)

        # If we found explicit skills, return those
        if skills:
            return skills

        # Fallback: scan for known skill names in the block text
        block_lower = block.lower()
        for skill in _KNOWN_SKILLS:
            if skill.lower() in block_lower:
                normalized = _normalize_skill_name(skill)
                if normalized and normalized not in seen:
                    skills.append(normalized)
                    seen.add(normalized)

        return skills

    def _parse_path_block(self, block: str) -> tuple[str, str]:
        """Parse a path block to extract description and mechanical effects.

        The block typically starts with the path name heading, followed by
        descriptive prose, and then mechanical effects (skill references,
        connection details, path conditions, etc.).

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

        # Try to split on mechanical effects indicators
        mech_patterns = [
            r"^(?:Skills?|Suggested\s+Skills?|Asset\s+Skills?)\s*[:：]",
            r"^(?:Connections?|Contacts?)\s*[:：]",
            r"^(?:Path\s+Condition|Condition)\s*[:：]",
            r"^(?:Knacks?|Effects?|Mechanics?|Mechanical\s+Effects?)\s*[:：]",
        ]

        description_parts: list[str] = []
        mechanical_parts: list[str] = []
        in_mechanical = False

        paragraphs = re.split(r"\n\s*\n", content)

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # Check if this paragraph starts a mechanical section
            is_mechanical = False
            for mech_pat in mech_patterns:
                if re.match(mech_pat, para, re.MULTILINE | re.IGNORECASE):
                    is_mechanical = True
                    break

            if is_mechanical or in_mechanical:
                in_mechanical = True
                mechanical_parts.append(para)
            else:
                description_parts.append(para)

        description = " ".join(description_parts)
        mechanical_effects = " ".join(mechanical_parts)

        # If no clear mechanical section was found, use the first paragraph
        # as description and the rest as mechanical effects
        if not mechanical_parts and len(paragraphs) > 1:
            description = paragraphs[0].strip()
            mechanical_effects = " ".join(p.strip() for p in paragraphs[1:] if p.strip())
        elif not mechanical_parts and len(paragraphs) == 1:
            description = paragraphs[0].strip()
            mechanical_effects = ""

        # Collapse internal whitespace
        description = re.sub(r"\s+", " ", description).strip()
        mechanical_effects = re.sub(r"\s+", " ", mechanical_effects).strip()

        return (description, mechanical_effects)

    def _find_page_number(
        self, full_text: str, block: str, section_text: str
    ) -> int:
        """Find the page number for a path block.

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
