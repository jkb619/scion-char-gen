import os
import subprocess
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
SRC_DIR = PACKAGE_DIR.parent
PROJECT_ROOT = SRC_DIR.parent

DATA_DIR = SRC_DIR / "data"
TEMPLATES_DIR = SRC_DIR / "templates"
STATIC_DIR = SRC_DIR / "static"


def _resolve_asset_version() -> str:
    """Lightsail image rev (e.g. 45 from :scion-chargen.app.45) via ASSET_VERSION env at deploy; local fallback."""
    env = os.environ.get("ASSET_VERSION", "").strip()
    if env:
        return env
    try:
        r = subprocess.run(
            ["git", "describe", "--always", "--dirty", "--abbrev=8"],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=2,
            check=False,
        )
        if r.returncode == 0:
            v = r.stdout.strip()
            if v:
                return v
    except (OSError, subprocess.SubprocessError):
        pass
    return "dev"


ASSET_VERSION = _resolve_asset_version()

# Community “interactive” sheet PDFs (AcroForm). Override with env if your files live elsewhere.
INTERACTIVE_SHEET_SCION_PDF = Path(
    os.environ.get(
        "SCION_INTERACTIVE_SHEET_PDF",
        "/mnt/c/Users/John/Desktop/Scion/Scion_2ndED_Complete_4-Page_Interactive.pdf",
    )
)
INTERACTIVE_SHEET_DRAGON_PDF = Path(
    os.environ.get(
        "SCION_DRAGON_INTERACTIVE_SHEET_PDF",
        "/mnt/c/Users/John/Desktop/Scion/Scion_2ndED_Dragon_4-Page_Interactive.pdf",
    )
)
