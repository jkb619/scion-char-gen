"""LLM-driven concept chargen: RAG over Scion 2e collection + mechanical skeleton merge."""

from __future__ import annotations

import json
from typing import Any

from app.services import llm_client
from app.services.chargen_catalog import build_chargen_catalog
from app.services.llm_config import LlmProviderConfig, xai_collection_id

# Flavor + thematic hints the client validates; mechanical budgets stay on the skeleton.
_FLAVOR_SCALAR_KEYS = (
    "characterName",
    "concept",
    "notes",
    "sheetDescription",
    "legendaryTitles",
    "omen",
    "pantheonId",
    "parentDeityId",
    "patronKind",
    "callingId",
)
_FLAVOR_NESTED_KEYS = ("deeds", "paths", "sorceryProfile", "titanicProfile")
_THEMATIC_ARRAY_KEYS = (
    "knackIds",
    "boonIds",
    "purviewIds",
    "patronPurviewSlots",
    "arenaPriority",
    "arenaRank",
)


def _merge_character_export(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    """Merge LLM flavor/thematic hints onto a mechanical export; budgets remain on the skeleton."""
    out: dict[str, Any] = dict(base)
    for key in _FLAVOR_SCALAR_KEYS:
        if key in override and override[key] is not None:
            out[key] = override[key]

    for key in _FLAVOR_NESTED_KEYS:
        if key in override and isinstance(override[key], dict):
            prev = out.get(key) if isinstance(out.get(key), dict) else {}
            out[key] = {**prev, **override[key]}

    for key in _THEMATIC_ARRAY_KEYS:
        if key in override and isinstance(override[key], list):
            out[key] = override[key]

    if "pathPriority" in override and isinstance(override["pathPriority"], dict):
        out["pathPriority"] = override["pathPriority"]
    if "pathSkills" in override and isinstance(override["pathSkills"], dict):
        out["pathSkills"] = override["pathSkills"]
    if "skillSpecialties" in override and isinstance(override["skillSpecialties"], dict):
        out["skillSpecialties"] = override["skillSpecialties"]
    if "callingSlots" in override and isinstance(override["callingSlots"], list):
        out["callingSlots"] = override["callingSlots"]
    if "finishing" in override and isinstance(override["finishing"], dict):
        prev = out.get("finishing") if isinstance(out.get("finishing"), dict) else {}
        merged_fin = {**prev, **override["finishing"]}
        # Finishing knack ids are thematic; birthright picks stay on skeleton unless client validates.
        if "finishingKnackIds" not in override["finishing"]:
            merged_fin["birthrightPicks"] = prev.get("birthrightPicks", merged_fin.get("birthrightPicks"))
            merged_fin["sorcererMortalFinishingPackage"] = prev.get(
                "sorcererMortalFinishingPackage",
                merged_fin.get("sorcererMortalFinishingPackage"),
            )
        out["finishing"] = merged_fin

    return out


def _build_system_prompt() -> str:
    return (
        "You are a Scion Second Edition character creator assistant. "
        "Search the attached Scion 2e PDF collection for chargen rules (Origin, Hero, Demigod, God, "
        "Saints & Monsters Sorcerer, Scion: Dragon Heir when applicable). "
        "You receive a mechanically valid random character skeleton and a player concept prompt. "
        "The skeleton already satisfies tier budgets (skill dots, attributes, legend, XP, birthright points). "
        "Do NOT change tier, legendRating, skill totals, attribute totals, or experience purchases. "
        "Customize flavor and thematic choices to match the concept: name, concept, deeds, path phrases, "
        "patron pantheon/deity (when the line uses patrons), calling, knacks, boons, purviews, sorcery profile text, "
        "and path skill selections (three valid skill ids per path from the catalog). "
        "Return ONLY a single JSON object (no markdown fences) with override fields. "
        "Use catalog ids exactly — never invent knack, boon, birthright, purview, skill, attribute, pantheon, or deity ids. "
        "Always include: characterName, concept, notes, sheetDescription, deeds {short, long, band}, "
        "paths {origin, role, society or flight for dragon}, pantheonId, parentDeityId when the line uses patrons. "
        "Path phrase fields are short labels (under 120 chars), not ids. "
        "For Sorcerer tiers include sorceryProfile {motif, invocation, talisman, workingIds, additionalTechniqueIds} "
        "using catalog working ids. "
        "Always include skillSpecialties: an object mapping every skill id with 3+ dots on the skeleton to a "
        "narrow Scion Specialty (specific aptitude or situation, e.g. athletics → 'Rooftop parkour', "
        "stealth → 'Dockside smuggling'). Never use generic placeholders like 'Athletics focus'. "
        "Max 80 characters per specialty. Use catalog skill ids exactly. "
        "Omit keys you do not change except the required flavor fields above."
    )


def _specialty_eligible_skills(mechanical: dict[str, Any]) -> list[dict[str, Any]]:
    """Skills on the skeleton with 3+ dots (Finishing-inclusive totals when present)."""
    totals: dict[str, int] = {}
    for key in ("skillsIncludingFinishing", "skills"):
        block = mechanical.get(key)
        if not isinstance(block, dict):
            continue
        for sid, dots in block.items():
            if not isinstance(sid, str) or sid.startswith("_"):
                continue
            try:
                n = int(round(float(dots)))
            except (TypeError, ValueError):
                n = 0
            if n >= 3:
                totals[sid] = max(totals.get(sid, 0), n)
    return [{"id": sid, "dots": dots} for sid, dots in sorted(totals.items(), key=lambda r: r[0])]


def _build_user_prompt(concept: str, welcome_track: str, mechanical: dict[str, Any], catalog: dict[str, Any]) -> str:
    mech_json = json.dumps(mechanical, ensure_ascii=False, separators=(",", ":"))[:120_000]
    cat_json = json.dumps(catalog, ensure_ascii=False, separators=(",", ":"))[:80_000]
    specialty_rows = _specialty_eligible_skills(mechanical)
    skill_names = {
        str(row.get("id") or ""): str(row.get("name") or row.get("id") or "")
        for row in catalog.get("skills") or []
        if isinstance(row, dict)
    }
    specialty_lines = []
    for row in specialty_rows:
        sid = row["id"]
        label = skill_names.get(sid, sid)
        specialty_lines.append(f"  - {sid} ({row['dots']} dots): {label}")
    specialty_block = (
        "Skills that require a Specialty (3+ dots — include every id in skillSpecialties):\n"
        + ("\n".join(specialty_lines) if specialty_lines else "  (none)")
    )
    return (
        f"Welcome track: {welcome_track}\n\n"
        f"Player concept prompt:\n{concept.strip()}\n\n"
        f"{specialty_block}\n\n"
        "Mechanical skeleton (JSON — customize flavor and thematic ids only; keep budgets):\n"
        f"{mech_json}\n\n"
        "Allowed catalog ids and labels:\n"
        f"{cat_json}\n\n"
        "Return the override JSON object now."
    )


def generate_character_from_concept(
    cfg: LlmProviderConfig,
    *,
    concept_prompt: str,
    welcome_track: str,
    mechanical: dict[str, Any],
    bundle: dict[str, Any],
) -> dict[str, Any]:
    concept = concept_prompt.strip()
    if not concept:
        raise ValueError("Concept prompt is required")
    if not isinstance(mechanical, dict):
        raise ValueError("Mechanical skeleton must be a JSON object")

    catalog = build_chargen_catalog(bundle, welcome_track)
    system = _build_system_prompt()
    user = _build_user_prompt(concept, welcome_track, mechanical, catalog)

    collection_id = xai_collection_id()
    used_collection = bool(collection_id and cfg.provider_id == "xai")
    if used_collection:
        raw = llm_client.responses_with_collection_search(
            cfg,
            system=system,
            user=user,
            collection_id=collection_id,
            timeout_s=180,
        )
    else:
        raw = llm_client.chat_completion(
            cfg,
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=0.7,
            timeout_s=120,
        )

    override = llm_client.parse_flavor_json(raw)
    merged = _merge_character_export(mechanical, override)
    return {"character": merged, "override": override, "usedCollection": used_collection}
