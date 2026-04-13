import os
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
SRC_DIR = PACKAGE_DIR.parent
PROJECT_ROOT = SRC_DIR.parent

DATA_DIR = SRC_DIR / "data"
TEMPLATES_DIR = SRC_DIR / "templates"
STATIC_DIR = SRC_DIR / "static"

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
