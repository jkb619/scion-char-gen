"""Calling category extractor.

Extracts calling definitions from PDF text that contains calling sections.
Each calling has a name, description, mechanical effects, and source provenance.

Extraction Strategy:
1. Locate the Callings section using section anchors from category config.
2. Split by calling name heading (Creator, Guardian, Healer, etc.).
3. Extract description and mechanical effects from each calling block.
4. Derive `id` from name (lowercase).
5. Record `source` as `<filename> p.<page_number>` from nearest preceding page marker.
"""

from __future__ import annotations

import re
from typing import Any

from extractors.base import CategoryExtractor, CategoryResult, LogEntry
from parser_framework.models import BookSpec


# Page marker pattern inserted by the ingestion stage (e.g., "--- Page 42 ---")
_PAGE_MARKER_RE = re.compile(r"^-{3,}\s*Page\s+(\d+)\s*-{3,}$", re.MULTILINE)


class CallingExtractor(CategoryExtractor):
    """Extracts calling definitions from ingested PDF text.

    Callings are game-data entries representing archetypal roles (Creator,
    Guardian, Healer, Hunter, etc.) with a description and mechanical effects.
    """

    def extract(self, text: str, spec: BookSpec, category_config: dict) -> CategoryResult:
        """Extract calling entries from the ingested text.

        Args:
            text: Full ingested plaintext from the PDF (with page markers).
            spec: The BookSpec for the current book being processed.
            category_config: The callings category configuration block.

        Returns:
            A CategoryResult with extracted calling entries keyed by id.
        """
        log: list[LogEntry] = []
        entries: dict[str, Any] = {}

        # Determine the source filename from the spec
        source_filename = spec.filenames[0] if spec.filenames else "unknown.pdf"

        # Step 1: Locate the Callings section using section anchors
        section_text = self._find_callings_section(text, category_config, log)
        if section_text is None:
            return CategoryResult(
                category="callings",
                entries={},
                entry_count=0,
                log=log,
            )

        # Step 2: Compile the heading pattern from config
        heading_pattern = self._get_heading_pattern(category_config, log)
        if heading_pattern is None:
            return CategoryResult(
                category="callings",
                entries={},
                entry_count=0,
                log=log,
            )

        # Step 3: Split the section by calling name headings
        calling_blocks = self._split_by_headings(section_text, heading_pattern)

        # Step 4: Extract data from each calling block
        for name, block in calling_blocks:
            calling_id = name.lower().strip()
            page_number = self._find_page_number(text, block, section_text)
            source = f"{source_filename} p.{page_number}"

            description, mechanical_effects = self._parse_calling_block(block)

            if not description:
                log.append(LogEntry(
                    entry_id=calling_id,
                    field="description",
                    reason="not_found",
                    detail=f"No description found for calling '{name}'",
                ))

            if not mechanical_effects:
                log.append(LogEntry(
                    entry_id=calling_id,
                    field="mechanicalEffects",
                    reason="not_found",
                    detail=f"No mechanical effects found for calling '{name}'",
                ))

            entries[calling_id] = {
                "id": calling_id,
                "name": name,
                "description": description,
                "mechanicalEffects": mechanical_effects,
                "source": source,
            }

        return CategoryResult(
            category="callings",
            entries=entries,
            entry_count=len(entries),
            log=log,
        )

    def validate_config(self, category_config: dict) -> list[str]:
        """Validate the callings category configuration block.

        Required fields:
        - section_anchors: At least one anchor to locate the Callings section.
        - heading_pattern: Regex to identify calling name headings.
        - expected_fields: List of expected output fields.

        Args:
            category_config: The callings category configuration dict.

        Returns:
            List of validation error messages. Empty if valid.
        """
        errors: list[str] = []

        if "section_anchors" not in category_config:
            errors.append("callings: missing required field 'section_anchors'")
        elif not category_config["section_anchors"]:
            errors.append("callings: 'section_anchors' must not be empty")

        if "heading_pattern" not in category_config:
            errors.append("callings: missing required field 'heading_pattern'")
        else:
            hp = category_config["heading_pattern"]
            if not isinstance(hp, dict) or "regex" not in hp:
                errors.append("callings: 'heading_pattern' must be a dict with 'regex' key")
            else:
                # Validate regex compiles
                try:
                    re.compile(hp["regex"])
                except re.error as e:
                    errors.append(f"callings: 'heading_pattern.regex' is invalid: {e}")

        if "expected_fields" not in category_config:
            errors.append("callings: missing required field 'expected_fields'")

        return errors

    def _find_callings_section(
        self, text: str, category_config: dict, log: list[LogEntry]
    ) -> str | None:
        """Locate the Callings section in the text using section anchors.

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
                detail="No section anchors configured for callings",
            ))
            return None

        for anchor_cfg in section_anchors:
            pattern = anchor_cfg.get("pattern", "")
            pattern_type = anchor_cfg.get("pattern_type", "literal")

            match_start = self._find_anchor_in_text(text, pattern, pattern_type)
            if match_start is not None:
                # Return text from anchor position to end
                # (the pipeline will handle section boundary trimming if needed)
                return text[match_start:]

        log.append(LogEntry(
            entry_id="",
            field="",
            reason="anchor_not_found",
            detail="No callings section anchor matched in text",
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
            # Literal: case-insensitive search for the anchor on its own line
            # Try exact match first
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
                detail="No heading_pattern configured for callings",
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
            List of (calling_name, block_text) tuples.
        """
        matches = list(heading_pattern.finditer(section_text))
        if not matches:
            return []

        blocks: list[tuple[str, str]] = []
        for i, match in enumerate(matches):
            # Extract name from named group or entire match
            name = match.group("name") if "name" in heading_pattern.groupindex else match.group(0)
            name = name.strip()

            start = match.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(section_text)
            block_text = section_text[start:end]

            blocks.append((name, block_text))

        return blocks

    def _parse_calling_block(self, block: str) -> tuple[str, str]:
        """Parse a calling block to extract description and mechanical effects.

        The block typically starts with the calling name heading, followed by
        descriptive prose, and then mechanical effects (often prefixed by
        keywords like "Knacks:", "Effects:", or introduced as a separate paragraph).

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

        # Join content and strip leading/trailing whitespace
        content = "\n".join(content_lines).strip()

        if not content:
            return ("", "")

        # Try to split on mechanical effects indicators
        # Common patterns: "Knacks:", "Effects:", "Mechanics:", or a blank-line-separated
        # paragraph that mentions game mechanics
        mech_patterns = [
            r"^(?:Knacks|Effects|Mechanics|Mechanical Effects)\s*:",
            r"^(?:Asset Skills|Virtues)\s*:",
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
        """Find the page number for a calling block.

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
