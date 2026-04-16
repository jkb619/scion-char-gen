from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException

from app.config import DATA_DIR
from app.services import game_data as game_data_service

router = APIRouter(prefix="/api", tags=["game-data"])


@router.get("/manifest")
def manifest() -> dict[str, Any]:
    books_dir = DATA_DIR / "books"
    book_files = (
        sorted(p.name for p in books_dir.glob("*.json") if p.is_file() and not p.name.startswith("_"))
        if books_dir.is_dir()
        else []
    )
    out: dict[str, Any] = {"tables": sorted(game_data_service.allowed_names()), "bookBundles": book_files}
    meta_path = DATA_DIR / "meta.json"
    if meta_path.is_file():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        cr = meta.get("canonicalRules")
        if isinstance(cr, dict):
            out["canonicalRules"] = cr
    return out


@router.get("/bundle")
def bundle() -> dict:
    return game_data_service.load_bundle()


@router.get("/data/{name}")
def single_table(name: str) -> dict:
    try:
        return game_data_service.load_table(name)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Unknown table") from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Table file missing") from exc
    except TypeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/data/{name}")
def put_table(name: str, body: dict[str, Any]) -> dict[str, str]:
    """Replace a whole table file on disk (local tool; use with care)."""
    try:
        game_data_service.save_table(name, body)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Unknown table") from exc
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Write failed: {exc}") from exc
    return {"ok": True, "name": name}
