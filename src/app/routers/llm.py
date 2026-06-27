from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services import llm_client
from app.services.game_data import load_bundle
from app.services.llm_config import active_provider, configured_providers, llm_configured, llm_setup_hint, xai_collection_id
from app.services.llm_concept_chargen import generate_character_from_concept

router = APIRouter(prefix="/api/llm", tags=["llm"])

FlavorFieldMode = Literal["generate", "enhance", "skip"]


class CharacterFlavorRequest(BaseModel):
    lineage: str = "scion"
    tier: str = ""
    inheritance: int | None = None
    flight: str = ""
    pantheon: str = ""
    parent: str = ""
    callings: list[str] = Field(default_factory=list)
    characterName: str = ""
    concept: str = ""
    notes: str = ""
    sheetDescription: str = ""
    deeds: dict[str, str] = Field(default_factory=dict)
    paths: dict[str, str] = Field(default_factory=dict)
    skills: list[dict[str, Any]] = Field(default_factory=list)
    fieldModes: dict[str, Any] = Field(default_factory=dict)
    provider: str | None = None


def _mode_line(label: str, mode: str, draft: str) -> str:
    text = draft.strip()
    if mode == "skip":
        return f"- {label}: SKIP (leave unchanged)"
    if mode == "enhance" and text:
        return f"- {label}: ENHANCE — refine and expand this draft, keep its keywords and intent: {text!r}"
    if mode == "enhance" and not text:
        return f"- {label}: GENERATE — write fresh (draft was empty but mode was enhance)"
    return f"- {label}: GENERATE — write fresh table-ready text"


def _build_field_instructions(body: CharacterFlavorRequest) -> str:
    modes = body.fieldModes if isinstance(body.fieldModes, dict) else {}
    lines: list[str] = []

    def mode_for(*keys: str, default: str = "generate") -> str:
        cur: Any = modes
        for key in keys:
            if not isinstance(cur, dict):
                return default
            cur = cur.get(key)
        return str(cur) if cur in ("generate", "enhance", "skip") else default

    lines.append(_mode_line("characterName", mode_for("characterName"), body.characterName))
    lines.append(_mode_line("concept", mode_for("concept"), body.concept))
    lines.append(_mode_line("notes (player / group notes)", mode_for("notes"), body.notes))
    lines.append(
        _mode_line(
            "sheetDescription (Description box — appearance, bearing, personality; 2–4 sentences)",
            mode_for("sheetDescription"),
            body.sheetDescription,
        )
    )

    deed_modes = modes.get("deeds") if isinstance(modes.get("deeds"), dict) else {}
    for key in ("short", "long", "band", "mythos"):
        dm = str(deed_modes.get(key, flavor_default_mode(body.deeds.get(key, ""))))
        if dm == "skip":
            continue
        deed_label = {
            "short": "deeds.short (short-term deed)",
            "long": "deeds.long (long-term deed)",
            "band": "deeds.band (band deed)",
            "mythos": "deeds.mythos (mythos deed)",
        }[key]
        lines.append(_mode_line(deed_label, dm, body.deeds.get(key, "")))

    path_modes = modes.get("paths") if isinstance(modes.get("paths"), dict) else {}
    if body.lineage == "dragonHeir":
        path_keys = ("origin", "role", "flight")
    else:
        path_keys = ("origin", "role", "society")
    for key in path_keys:
        pm = str(path_modes.get(key, flavor_default_mode(body.paths.get(key, ""))))
        if pm == "skip":
            continue
        lines.append(_mode_line(f"paths.{key}", pm, body.paths.get(key, "")))

    spec_modes = modes.get("skillSpecialties") if isinstance(modes.get("skillSpecialties"), dict) else {}
    for row in body.skills[:24]:
        if not isinstance(row, dict):
            continue
        sid = str(row.get("id") or "").strip()
        if not sid:
            continue
        dots = row.get("dots")
        if dots is not None and int(dots) < 3:
            continue
        sm = str(spec_modes.get(sid, flavor_default_mode(str(row.get("specialty") or ""))))
        if sm == "skip":
            continue
        name = str(row.get("name") or sid)
        draft = str(row.get("specialty") or "")
        spec_label = f"skillSpecialties[{sid!r}] ({name} — narrow Specialty, not '{name} focus')"
        lines.append(_mode_line(spec_label, sm, draft))

    return "\n".join(lines)


def flavor_default_mode(draft: str) -> str:
    return "enhance" if draft.strip() else "generate"


@router.get("/status")
def llm_status() -> dict[str, Any]:
    coll = xai_collection_id()
    configured = llm_configured()
    return {
        "configured": configured,
        "providers": configured_providers(),
        "defaultProvider": active_provider().provider_id if configured else None,
        "collectionConfigured": bool(coll),
        "collectionIdSet": bool(coll),
        "setupHint": llm_setup_hint(),
    }


class CharacterFromConceptRequest(BaseModel):
    conceptPrompt: str = Field(..., min_length=1, max_length=4000)
    welcomeTrack: str = Field(default="deity:mortal", max_length=80)
    mechanical: dict[str, Any] = Field(default_factory=dict)


@router.post("/character-from-concept")
def character_from_concept(body: CharacterFromConceptRequest) -> dict[str, Any]:
    cfg = active_provider()
    if cfg is None:
        raise HTTPException(
            status_code=503,
            detail="LLM API keys are not configured on this server.",
        )
    if not isinstance(body.mechanical, dict) or not body.mechanical:
        raise HTTPException(status_code=400, detail="Mechanical character skeleton is required.")

    try:
        bundle = load_bundle()
        result = generate_character_from_concept(
            cfg,
            concept_prompt=body.conceptPrompt,
            welcome_track=body.welcomeTrack,
            mechanical=body.mechanical,
            bundle=bundle,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "provider": cfg.provider_id,
        "usedCollection": result.get("usedCollection", False),
        "character": result["character"],
        "override": result.get("override", {}),
    }


@router.post("/character-flavor")
def character_flavor(body: CharacterFlavorRequest) -> dict[str, Any]:
    cfg = active_provider()
    if cfg is None:
        raise HTTPException(
            status_code=503,
            detail="LLM API keys are not configured on this server.",
        )

    dragon = body.lineage == "dragonHeir"
    path_key_hint = "origin, role, flight" if dragon else "origin, role, society"
    deed_keys = "short, long, band" + ("" if dragon else ", mythos (if MotM)")

    system = (
        "You write concise, table-ready Scion 2e character flavor (Origin/Hero or Scion: Dragon Heir). "
        "Return a single JSON object with keys: "
        "characterName, concept, notes, sheetDescription, deeds (object), paths (object), "
        "skillSpecialties (object mapping skill id → text). "
        "Follow each field instruction exactly: "
        "GENERATE = write new copy with no draft to preserve; "
        "ENHANCE = keep the player's keywords and intent but polish and expand into full prose; "
        "omit JSON keys for SKIP fields. "
        f"paths uses keys: {path_key_hint}. deeds uses: {deed_keys}. "
        "Keep each path phrase under 120 characters. "
        "Only include skillSpecialties for skills listed with 3+ dots. "
        "Each specialty must be a narrow Scion Specialty (specific technique, venue, or situation the character excels in), "
        "not the skill name repeated and never placeholders like 'Athletics focus'. "
        "Aim for 2–8 vivid words tied to the character concept."
    )

    context = (
        f"Lineage: {body.lineage}\n"
        f"Tier: {body.tier}\n"
        + (f"Inheritance: {body.inheritance}\n" if body.inheritance is not None else "")
        + (f"Flight: {body.flight}\n" if body.flight else "")
        + f"Pantheon: {body.pantheon or '(none)'}\n"
        f"Parent: {body.parent or '(none)'}\n"
        f"Callings: {', '.join(body.callings) if body.callings else 'unknown'}\n\n"
        "Field instructions:\n"
        f"{_build_field_instructions(body)}"
    )

    try:
        raw = llm_client.chat_completion(
            cfg,
            [{"role": "system", "content": system}, {"role": "user", "content": context}],
        )
        flavor = llm_client.parse_flavor_json(raw)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {"provider": cfg.provider_id, "flavor": flavor}
