from __future__ import annotations

import base64
import json
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.config import STATIC_DIR, TEMPLATES_DIR
from app.routers import game_data, interactive_pdf, review_sheet_pdf
from app.services import game_data as game_data_service

app = FastAPI(title="Scion Character Creator", version="0.1.0")

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

app.include_router(game_data.router)
app.include_router(interactive_pdf.router)
app.include_router(review_sheet_pdf.router)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
def index(request: Request):
    """Inline the merged JSON bundle so the wizard does not depend on `fetch(/api/bundle)` (SW/proxy/WSL issues)."""
    bundle = game_data_service.load_bundle()
    bundle_b64 = base64.standard_b64encode(
        json.dumps(bundle, separators=(",", ":")).encode("utf-8"),
    ).decode("ascii")
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "bundle_b64": bundle_b64},
        headers={"Cache-Control": "no-store, max-age=0"},
    )


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    icon = Path(__file__).resolve().parent.parent / "static" / "favicon.ico"
    if icon.exists():
        return FileResponse(icon)
    from fastapi.responses import Response

    return Response(status_code=204)
