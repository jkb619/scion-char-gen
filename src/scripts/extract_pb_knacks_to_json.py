#!/usr/bin/env python3
"""Extract Knacks from Pandora's Box (Revised) into src/data/knacks.json.

Reads ingested text from src/data/_extracted/pandoras_box.txt (run ingest_pandoras_box_pdf.py first).

Default output: src/data/knacks.json (app catalog format).
Optional --audit-dir writes per-Calling review files under json/knacks/.
Optional --keep-supplements retains sm_*, tr_*, and mythos_* rows from the existing knacks.json.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEXT_PATH = ROOT / "src" / "data" / "_extracted" / "pandoras_box.txt"
APP_OUT = ROOT / "src" / "data" / "knacks.json"
AUDIT_DIR = ROOT / "json" / "knacks"
BOOK = "SCION_Pandoras_Box_(Revised_Download).pdf"
ORIGIN_BOOK = "Scion_Origin_(Revised_Download).pdf"

# Origin Mortal knack lists (Scion: Origin pp. 105–113). PB Heroic General (calling any + HEROIC band) is always Origin-eligible.
ORIGIN_MORTAL_KNACKS: dict[str, frozenset[str]] = {
    "any": frozenset(
        {
            "aura_of_greatness",
            "born_to_be_kings",
            "desperate_entreaty",
            "exemplar_of_the_calling",
            "i_am_here",
            "leave_it_all_out_there",
            "monsters_united",
            "overwhelming_presence",
            "scent_the_divine",
            "somebodys_watching_me",
        }
    ),
    "creator": frozenset(
        {
            "innate_toolkit",
            "perfect_rendition",
            "reverse_engineer",
            "flawlessly_platonic_ideal",
            "the_unlimited_quartermaster",
        }
    ),
    "guardian": frozenset(
        {
            "a_fortress",
            "a_purpose",
            "a_sentinel",
            "a_talisman",
            "a_vigil",
            "a_warning",
        }
    ),
    "healer": frozenset(
        {
            "the_bare_minimum",
            "combat_medic",
            "damage_conversion",
            "doctors_kit",
            "immunization_booster",
            "surgeon_with_the_hands_of_god",
            "with_a_glance",
        }
    ),
    "hunter": frozenset(
        {
            "apex_predator",
            "eyes_in_the_blinds",
            "internal_compass",
            "keen_eyed_predator",
            "most_dangerous_prey",
            "silence_in_the_woods",
            "worrying_hound",
        }
    ),
    "judge": frozenset(
        {
            "eye_for_an_eye",
            "indisputable_analysis",
            "lie_detector",
            "objection",
            "on_the_case",
            "quick_study",
            "the_truth_arises",
        }
    ),
    "leader": frozenset(
        {
            "captain_of_industry",
            "cloak_of_dread",
            "good_listener",
            "grand_entrance",
            "lighthouse_of_society",
            "perfect_poise",
        }
    ),
    "liminal": frozenset(
        {
            "beyond_memory",
            "complete_privacy",
            "experienced_traveler",
            "flatlander",
            "neither_the_minute_nor_the_hour",
            "unerring_delivery",
            "unobtrusive_visitor",
        }
    ),
    "lover": frozenset(
        {
            "fluid_appeal",
            "i_am_a_fire",
            "lovers_intuition",
            "on_your_side",
            "not_a_fighter",
            "perfect_partner",
            "soothing_presence",
        }
    ),
    "sage": frozenset(
        {
            "blockade_of_reason",
            "master_of_the_world",
            "palace_of_memory",
            "presence_of_magic",
            "office_hours",
            "omniglot_translation",
            "speed_reading",
        }
    ),
    "trickster": frozenset(
        {
            "blather_and_skite",
            "in_sheeps_clothing",
            "light_fingered",
            "rumor_miller",
            "smoke_and_mirrors",
            "takes_one_to_know_one",
            "wasnt_me",
        }
    ),
    "warrior": frozenset(
        {
            "the_biggest_threat",
            "close_the_gap",
            "death_by_teacup",
            "enhanced_impact",
            "master_of_weapons",
            "trick_shot",
            "tempered",
        }
    ),
}

PAGE_MARKER_RE = re.compile(r"===== Page (\d+) / \d+ =====")
TIER_RE = re.compile(r"^(HEROIC|IMMORTAL|MORTAL)\s+(.+)$")

CALLING_SLUGS: dict[str, str] = {
    "AUTOMACHY": "automachy",
    "ARCHITECT": "architect",
    "CREATOR": "creator",
    "COVENANT": "covenant",
    "DRUID": "druid",
    "GENERAL": "any",
    "GUARDIAN": "guardian",
    "HEALER": "healer",
    "HERALD": "herald",
    "HUNTER": "hunter",
    "JUDGE": "judge",
    "KNIGHT": "knight",
    "KNIGHTS": "knight",
    "LEADER": "leader",
    "LIMINAL": "liminal",
    "LOVER": "lover",
    "MIRACLEWORKER": "miracleworker",
    "ORACLE": "oracle",
    "OUTSIDER": "outsider",
    "PROPHETS": "prophets",
    "PSYCHOPOMP": "psychopomp",
    "SAGE": "sage",
    "SAINT": "saint",
    "SHEPHERD": "shepherd",
    "TRICKSTER": "trickster",
    "WARRIOR": "warrior",
    "ADVERSARY": "adversary",
    "DESTROYER": "destroyer",
    "MONSTER": "monster",
    "PRIMEVAL": "primeval",
    "TYRANT": "tyrant",
    "COLLECTOR": "collector",
    "RULER": "ruler",
    "MYSTIC": "mystic",
    "NOMAD": "nomad",
    "PREDATOR": "predator",
    "WATCHER": "watcher",
    "C  SITH": "c_sith",
    "CÚ SITH": "c_sith",
    "KITSUNE": "kitsune",
    "SATYR": "satyr",
    "THERIANTHROPE": "therianthrope",
    "WOLF-WARRIOR": "wolf_warrior",
    "TENEBRIAN": "tenebrian",
    "SPACE ODYSSEY": "tenebrian",
}

CALLING_NAMES = set(CALLING_SLUGS)
TIER_SUFFIXES = {k.replace(" ", "").replace("-", "").upper() for k in CALLING_NAMES}
TIER_SUFFIXES.update(CALLING_NAMES)

SECTION_HEADERS = {
    "TRANSFORMATION KNACKS": ("any", "heroic"),
    "DRAGON KNACKS OF SCALE": (None, "heroic"),
}

SKIP_LINE_RE = re.compile(
    r"^(CALLINGSCALLINGS|DRACONIC DRACONIC|TITANIC\s+TITANIC|"
    r"DENIZEN KNACKSDENIZEN KNACKS|MYTHIC SHARDSMYTHIC SHARDS|"
    r"TABLE OF CONTENTS|INTRODUCTION|CREDITS|BIRTHRIGHTSBIRTHRIGHTS|"
    r"P ANDORA|Callings|TiTaniC Callings|DraConiC Callings|"
    r"myThiC sharDs|Denizen KnaCKs|birThrighTs|Purviews:|"
    r"Flight Specific:|System:|Special:|Transformation:|CYBER-SCION).*$",
    re.I,
)
NOISE_RE = re.compile(r"^\d{1,3}$")
CAPS_RE = re.compile(r"^[A-Z][A-Z0-9' \-:ÆÉÍÓÚ/'’]+$")

PARSE_REGIONS = [
    (20, 102, "callings"),
    (108, 111, "denizen"),
]

SUPPLEMENT_PREFIXES = ("sm_", "tr_", "mythos_")
MECH_MAX = 1500
DESC_MAX = 320


def normalize_tier_suffix(text: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", text.upper())


def catalog_tier(tier_label: str, _description: str, _calling: str, _name_slug: str) -> str:
    """PB knack band: heroic | immortal. Origin Mortal picks use `originMortal` on overlapping rows."""
    label = (tier_label or "immortal").lower()
    if label == "heroic":
        return "heroic"
    if label == "mortal":
        return "mortal"
    return "immortal"


def calling_slot_cost(section_tier: str, tier: str) -> int:
    """Hero-band Calling dots per knack (Hero p.183–184): PB HEROIC = 1; PB IMMORTAL = 2."""
    if tier in ("mortal", "heroic"):
        return 1
    if tier == "immortal" or (section_tier or "").lower() == "immortal":
        return 2
    return 1


def knack_title_core(line: str) -> str:
    """Strip trailing punctuation so OBJECTION! matches PB ALL-CAPS knack headings."""
    return re.sub(r"[!?.…]+$", "", line.strip())


def is_knack_title_line(line: str) -> bool:
    core = knack_title_core(line)
    return bool(core) and bool(CAPS_RE.match(core))


def infer_catalog_tier_from_text(row: dict) -> str | None:
    blob = " ".join(
        str(row.get(key) or "")
        for key in ("mechanicalEffects", "description", "name", "source")
    ).lower()
    if "immortal inverted" in blob or "two calling slot" in blob:
        return "immortal"
    if "heroic inverted" in blob:
        return "heroic"
    return None


def normalize_knack_row(row: dict) -> dict:
    """PB catalog bands: heroic | immortal. Legacy `mortal` rows map to heroic unless immortal-tagged."""
    out = dict(row)
    raw_tier = str(out.get("tier") or "immortal").strip().lower()
    section = str(out.get("sectionTier") or raw_tier).strip().lower()
    if raw_tier == "heroic":
        tier = "heroic"
    elif raw_tier == "immortal":
        tier = "immortal"
    elif raw_tier == "mortal":
        inferred = infer_catalog_tier_from_text(out)
        tier = inferred or "heroic"
    else:
        tier = "immortal"
    if section == "immortal":
        tier = "immortal"
    elif section == "heroic" and tier != "immortal":
        tier = "heroic"
    slot = out.get("callingSlotCost")
    if slot is None:
        slot = calling_slot_cost(section, tier)
    else:
        slot = max(1, min(2, int(slot)))
    out["tier"] = tier
    out["callingSlotCost"] = slot
    out.pop("sectionTier", None)
    return out


def brief_description(text: str, max_len: int = DESC_MAX) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= max_len:
        return text
    cut = text[:max_len]
    if " " in cut:
        cut = cut.rsplit(" ", 1)[0]
    return cut + "…"


def name_to_camel_case(name: str) -> str:
    cleaned = re.sub(r"[^\w\s-]", "", name)
    words = re.split(r"[\s-]+", cleaned.strip())
    if not words:
        return ""
    parts = [words[0].lower()]
    for w in words[1:]:
        if w:
            parts.append(w[0].upper() + w[1:].lower() if len(w) > 1 else w.upper())
    return "".join(parts)


def name_to_snake(name: str) -> str:
    cleaned = re.sub(r"[^\w\s-]", "", name)
    words = re.split(r"[\s-]+", cleaned.strip())
    return "_".join(w.lower() for w in words if w)


def knack_id(name: str, calling: str) -> str:
    if calling == "any":
        return name_to_camel_case(name)
    return f"{calling}_{name_to_snake(name)}"


def source_string(page: int, calling: str) -> str:
    label = "General Knacks" if calling == "any" else f"{calling.replace('_', ' ').title()} Knacks"
    return f"{BOOK} p.{page} ({label})"


def is_tier_header(line: str) -> tuple[str, str] | None:
    m = TIER_RE.match(line)
    if not m:
        return None
    tier, suffix = m.group(1), m.group(2).strip()
    norm = normalize_tier_suffix(suffix)
    if norm in TIER_SUFFIXES or suffix.upper() in CALLING_NAMES:
        return tier.lower(), suffix
    return None


def is_calling_header(line: str) -> str | None:
    upper = line.strip().upper()
    if upper in CALLING_NAMES:
        return CALLING_SLUGS[upper]
    return None


def should_skip_line(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    if PAGE_MARKER_RE.match(s):
        return True
    if SKIP_LINE_RE.match(s):
        return True
    if NOISE_RE.match(s):
        return True
    if len(s) <= 2 and s.isalpha():
        return True
    return False


def title_case_preserve(name: str) -> str:
    if ":" in name or "-SPECIFIC" in name.upper():
        parts = re.split(r"(:)", name)
        out: list[str] = []
        for p in parts:
            out.append(p if p == ":" else p.title())
        return "".join(out)
    titled = name.title()
    return re.sub(
        r"\b(\w)['\u2019](\w)",
        lambda m: m.group(1) + "\u2019" + m.group(2).lower(),
        titled,
    )


def parse_text(text: str) -> list[dict]:
    lines = text.splitlines()
    page_at: list[int] = [1] * len(lines)
    page = 1
    for i, line in enumerate(lines):
        m = PAGE_MARKER_RE.match(line.strip())
        if m:
            page = int(m.group(1))
        page_at[i] = page

    knacks: list[dict] = []
    current_calling: str | None = None
    current_tier: str | None = None
    current_name: str | None = None
    current_body: list[str] = []
    current_page = 1
    lost_time_mode = False
    skip_until_page = 0

    def in_region(idx: int) -> bool:
        p = page_at[idx]
        for start, end, _region_mode in PARSE_REGIONS:
            if start <= p <= end:
                return True
        return False

    def region_mode(idx: int) -> str:
        p = page_at[idx]
        for start, end, rm in PARSE_REGIONS:
            if start <= p <= end:
                return rm
        return "skip"

    def flush_knack() -> None:
        nonlocal current_name, current_body
        if not current_name or not current_calling:
            current_name = None
            current_body = []
            return
        body = " ".join(current_body)
        body = re.sub(r"(\w)-\s+(\w)", r"\1\2", body)
        body = re.sub(r"\s+", " ", body).strip()
        if body.upper().startswith("SYSTEM:"):
            current_name = None
            current_body = []
            return
        tier_label = current_tier or "heroic"
        mech = body if len(body) <= MECH_MAX else body[: MECH_MAX - 1].rsplit(" ", 1)[0] + "…"
        knacks.append(
            {
                "name": current_name,
                "calling": current_calling,
                "sectionTier": tier_label,
                "source": {"book": BOOK, "page": current_page},
                "description": brief_description(body),
                "mechanicalEffects": mech,
            }
        )
        current_name = None
        current_body = []

    for idx, raw in enumerate(lines):
        if not in_region(idx):
            continue

        mode = region_mode(idx)
        line = raw.strip()
        if PAGE_MARKER_RE.match(line):
            current_page = int(PAGE_MARKER_RE.match(line).group(1))
            if current_page >= skip_until_page:
                skip_until_page = 0
            if current_page == 102 and lost_time_mode:
                flush_knack()
                lost_time_mode = False
                current_calling = "tenebrian"
                current_tier = "heroic"
            continue
        if skip_until_page and current_page < skip_until_page:
            continue
        if should_skip_line(line):
            continue

        upper = line.upper()
        if "MYTHIC SHARDS" in upper:
            flush_knack()
            continue
        if upper == "LOST TIME":
            flush_knack()
            lost_time_mode = True
            continue
        if upper == "SPACE ODYSSEY":
            flush_knack()
            lost_time_mode = False
            current_calling = "tenebrian"
            current_tier = None
            continue
        if upper.startswith("CYBER-SCION"):
            flush_knack()
            skip_until_page = 108
            continue

        if upper in SECTION_HEADERS:
            flush_knack()
            calling_override, tier_override = SECTION_HEADERS[upper]
            if calling_override:
                current_calling = calling_override
            current_tier = tier_override
            continue

        if not is_knack_title_line(line):
            if current_name:
                current_body.append(line)
            continue

        tier_hit = is_tier_header(line)
        if tier_hit:
            flush_knack()
            current_tier = tier_hit[0]
            if lost_time_mode:
                suffix_slug = is_calling_header(tier_hit[1].upper())
                if suffix_slug:
                    current_calling = suffix_slug
            continue

        calling_hit = is_calling_header(line)
        if calling_hit:
            flush_knack()
            current_calling = calling_hit
            if mode == "denizen":
                current_tier = None
            continue

        flush_knack()
        current_name = knack_title_core(line)
        current_page = page_at[idx]

    flush_knack()

    for k in knacks:
        if k["name"].isupper():
            k["name"] = title_case_preserve(k["name"])
    return knacks


def to_app_entry(raw: dict, used_ids: set[str]) -> tuple[str, dict]:
    name = raw["name"]
    calling = raw["calling"]
    page = int(raw["source"]["page"])
    base_id = knack_id(name, calling)
    kid = base_id
    n = 2
    while kid in used_ids:
        kid = f"{base_id}_{n}"
        n += 1
    used_ids.add(kid)

    source = source_string(page, calling)
    slug = name_to_snake(name)
    section_tier = raw.get("sectionTier") or raw.get("tier") or "immortal"
    tier = catalog_tier(section_tier, raw.get("description") or "", calling, slug)
    if slug in ORIGIN_MORTAL_KNACKS.get(calling, frozenset()):
        if calling == "any" and slug in (
            "aura_of_greatness",
            "born_to_be_kings",
            "scent_the_divine",
            "somebodys_watching_me",
        ):
            source = f"{ORIGIN_BOOK} — Mortal General Calling Knacks; also {source}"
        elif calling != "any":
            calling_label = calling.replace("_", " ").title()
            source = f"{ORIGIN_BOOK} — Mortal {calling_label} Knacks; also {source}"

    entry: dict = {
        "id": kid,
        "name": name,
        "tier": tier,
        "callingSlotCost": calling_slot_cost(section_tier, tier),
        "description": raw["description"],
        "mechanicalEffects": raw["mechanicalEffects"],
        "source": source,
    }
    if str(section_tier).lower() == "heroic" and (
        calling == "any" or slug in ORIGIN_MORTAL_KNACKS.get(calling, frozenset())
    ):
        entry["originMortal"] = True
    if calling == "any":
        entry["callingsAny"] = True
    else:
        entry["callings"] = [calling]
    return kid, entry


def build_app_catalog(knacks: list[dict], *, keep_supplements: bool) -> dict:
    used_ids: set[str] = set()
    catalog: dict = {}

    if keep_supplements and APP_OUT.is_file():
        existing = json.loads(APP_OUT.read_text(encoding="utf-8"))
        for key, row in existing.items():
            if key == "_meta" or not key:
                continue
            if any(key.startswith(p) for p in SUPPLEMENT_PREFIXES):
                if isinstance(row, dict):
                    catalog[key] = normalize_knack_row(row)
                    used_ids.add(str(row.get("id") or key))

    for raw in knacks:
        kid, entry = to_app_entry(raw, used_ids)
        catalog[kid] = normalize_knack_row(entry)

    pb_count = sum(1 for k in catalog if not any(k.startswith(p) for p in SUPPLEMENT_PREFIXES))
    supplement_count = len(catalog) - pb_count

    catalog = {
        "_meta": {
            "note": (
                "Knacks parsed from Pandora's Box (Revised) Calling and Denizen chapters "
                f"({pb_count} rows). PB bands: HEROIC | IMMORTAL. Origin Mortal picks use `originMortal` "
                "on rows that also appear in PB HEROIC lists. `callingSlotCost` 2 = PB IMMORTAL at Hero."
            ),
            "eligibility": {
                "callings": "Array of Calling ids, or omit / callingsAny true for General Calling (PB GENERAL).",
                "callingsAny": "If true, General Calling — PB GENERAL knack pool (any Calling).",
                "tier": "heroic | immortal (PB HEROIC / IMMORTAL bands). Origin: originMortal on matching rows.",
                "originMortal": "If true, also selectable at Origin (Scion: Origin Mortal knack lists).",
                "callingSlotCost": (
                    "Calling dots this knack spends at Hero tier: 1 (PB HEROIC) or 2 (PB IMMORTAL). "
                    "Demigod+ treat all as 1 dot in the UI."
                ),
            },
            "sourceBook": BOOK,
            "entryCount": len(catalog),
            "pbEntryCount": pb_count,
            "supplementEntryCount": supplement_count,
            "extractedOn": date.today().isoformat(),
            "regenerate": (
                "python3 src/scripts/ingest_pandoras_box_pdf.py && "
                "python3 src/scripts/extract_pb_knacks_to_json.py"
            ),
        },
        **{k: v for k, v in catalog.items() if k != "_meta"},
    }
    return catalog


def write_app_catalog(catalog: dict) -> int:
    APP_OUT.parent.mkdir(parents=True, exist_ok=True)
    APP_OUT.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    meta = catalog.get("_meta", {})
    return int(meta.get("pbEntryCount") or meta.get("entryCount") or 0)


def write_audit_files(knacks: list[dict]) -> dict[str, int]:
    by_calling: dict[str, list[dict]] = defaultdict(list)
    for k in knacks:
        by_calling[k["calling"]].append(k)

    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    for old in AUDIT_DIR.glob("*.json"):
        old.unlink()

    counts: dict[str, int] = {}
    for calling, items in sorted(by_calling.items()):
        filename = "any.json" if calling == "any" else f"{calling}.json"
        audit_rows = []
        for k in items:
            slug = name_to_snake(k["name"])
            section_tier = k.get("sectionTier") or k.get("tier") or "immortal"
            tier = catalog_tier(
                section_tier,
                k.get("description") or "",
                calling,
                slug,
            )
            audit_rows.append(
                {
                    **k,
                    "tier": tier,
                    "callingSlotCost": calling_slot_cost(section_tier, tier),
                }
            )
        payload = {
            "_meta": {
                "calling": calling,
                "callingLabel": "General Calling" if calling == "any" else calling.replace("_", " ").title(),
                "sourceBook": BOOK,
                "knackCount": len(audit_rows),
                "extractedOn": date.today().isoformat(),
            },
            "knacks": sorted(audit_rows, key=lambda x: (x["tier"], x["name"])),
        }
        (AUDIT_DIR / filename).write_text(
            json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        counts[calling] = len(items)
    return counts


def main() -> int:
    ap = argparse.ArgumentParser(description="Extract PB Knacks into src/data/knacks.json")
    ap.add_argument(
        "--keep-supplements",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Retain sm_*, tr_*, mythos_* rows from existing knacks.json (default: true)",
    )
    ap.add_argument(
        "--audit-dir",
        action="store_true",
        help=f"Also write per-Calling review files under {AUDIT_DIR.relative_to(ROOT)}/",
    )
    args = ap.parse_args()

    if not TEXT_PATH.is_file():
        print(f"Missing extract: {TEXT_PATH}")
        print("Run: python3 src/scripts/ingest_pandoras_box_pdf.py")
        return 1

    knacks = parse_text(TEXT_PATH.read_text(encoding="utf-8"))
    catalog = build_app_catalog(knacks, keep_supplements=args.keep_supplements)
    pb_count = write_app_catalog(catalog)
    total = catalog["_meta"]["entryCount"]
    supplement_count = catalog["_meta"].get("supplementEntryCount", 0)
    print(f"Wrote {total} knack entries to {APP_OUT} ({pb_count} from PB", end="")
    if supplement_count:
        print(f", {supplement_count} supplements kept)", end="")
    print(")")

    import importlib.util

    dedupe_path = ROOT / "src" / "scripts" / "deduplicate_and_tag_knacks.py"
    spec = importlib.util.spec_from_file_location("deduplicate_and_tag_knacks", dedupe_path)
    dedupe_mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(dedupe_mod)
    dedupe_report = dedupe_mod.process(write=True, report_path=ROOT / "json" / "knacks_dedup_report.json")
    print(
        f"Dedup: removed {len(dedupe_report['removedDuplicates'])} duplicates, "
        f"migrated {len(dedupe_report['migratedToDragonKnacks'])} draconic rows "
        f"({dedupe_report['remainingKnackCount']} knacks, "
        f"{dedupe_report['dragonKnackCount']} dragonKnacks)"
    )

    if args.audit_dir:
        counts = write_audit_files(knacks)
        print(f"Audit files: {sum(counts.values())} knacks in {len(counts)} files under {AUDIT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
