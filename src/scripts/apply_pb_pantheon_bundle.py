#!/usr/bin/env python3
"""
Merge Pandora's Box (Revised) pantheon roster + Signature Purviews into data tables.

- Adds pantheons that appear in PB but not in Origin Appendix 2.
- Re-points several Origin pantheons' signaturePurviewId to PB Signature Purviews.
- Inserts matching purviews.json + virtues.json rows.

Run from repo root:
  python3 scripts/apply_pb_pantheon_bundle.py

Then regenerate Boons (twelve-step ladders for every purview id):
  python3 scripts/generate_boons_catalog.py

Confirm patron Callings / Purviews at the table against your PDFs before play.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))
from app.services.data_tables import primary_write_path

PANTHEONS_PATH = SRC / "data" / "pantheons.json"
PURVIEWS_PATH = primary_write_path("purviews")
VIRTUES_PATH = SRC / "data" / "virtues.json"

PB = "SCION_Pandoras_Box_(Revised_Download).pdf"


def pad12(names: list[str]) -> list[str]:
    out = [str(x or "").strip() for x in names[:12]]
    while len(out) < 12:
        out.append("")
    return out


def pv(
    pid: str,
    display: str,
    description: str,
    mechanics: str,
    ladder: list[str],
) -> dict[str, Any]:
    return {
        "id": pid,
        "name": display,
        "description": description,
        "purviewInnateSummary": f"Use {PB} and Scion: Hero for this Signature Purview’s Innate (not a Boon pick in the catalog).",
        "mechanicalEffects": mechanics,
        "source": PB + " — Pantheon Signature Purviews chapter",
        "boonLadderNames": pad12(ladder),
    }


NEW_PURVIEWS: dict[str, dict[str, Any]] = {
    "shuila": pv(
        "shuila",
        "Shuilá",
        "The Anunna Signature: fate-deeds, tablets of office, and the weight of what was decreed before you spoke.",
        "Boons per Pandora’s Box (Anunna: Shuilá).",
        ["Me of the Deed", "Ordained Purpose", "Take the Reins"],
    ),
    "pachakutic": pv(
        "pachakutic",
        "Pachakutic",
        "The Apu Signature: world-turning, mountain omens, and the hinge moments of ages.",
        "Boons per Pandora’s Box (Apu: Pachakutic).",
        ["Churay", "Kallpa", "World Revolution"],
    ),
    "atuaMana": pv(
        "atuaMana",
        "Mana",
        "The Atua Signature: power-as-presence, right relationship, and the face you cannot fake before your kin.",
        "Boons per Pandora’s Box (Atua: Mana).",
        ["Kumara’s Sweetness", "Pono", "See Me As I Am"],
    ),
    "paganito": pv(
        "paganito",
        "Paganito",
        "The Balahala Signature: ancestor compact, vigil of the dead, and bargains sealed in smoke.",
        "Boons per Pandora’s Box (Balahala: Paganito).",
        ["Ancestral Guidance", "Guardian’s Vigil", "Sacred Compact"],
    ),
    "dvoeverie": pv(
        "dvoeverie",
        "Dvoeverie",
        "The Bogovi Signature: twinned truth, hidden worship, and the old law that walks in two skins.",
        "Boons per Pandora’s Box (Bogovi: Dvoeverie).",
        ["Hidden Worship", "Mnogoverie", "Volevoi"],
    ),
    "yoga": pv(
        "yoga",
        "Yógá",
        "The Devá Signature: disciplined devotion, earned insight, and the body as a practiced instrument of truth.",
        "Boons per Pandora’s Box (Devá: Yógá).",
        ["Devotion’s Reward", "Eyes of Knowledge", "Transformative Siddhi"],
    ),
    "marzeh": pv(
        "marzeh",
        "Marzeh",
        "The Ilhm Signature: feast-law, lineage rolls, and the obligations guests inherit when bread is broken.",
        "Boons per Pandora’s Box (Ilhm: Marzeh).",
        ["Roll of Lineage", "Shared Banquet", "Guest’s Oath"],
    ),
    "tzolkin": pv(
        "tzolkin",
        "Tzolk’in",
        "The K’uh Signature: sacred calendar, appointed sorrow, and days that arrive already decided.",
        "Boons per Pandora’s Box (K’uh: Tzolk’in).",
        ["A Dolorous Day", "As Was Foreseen", "Daykeeper’s Verdict"],
    ),
    "yaoyorozuNoKamigami": pv(
        "yaoyorozuNoKamigami",
        "Yaoyorozu-no-Kamigami",
        "The Kami Signature: myriad kami acknowledged, propitiated, and set quietly watching at thresholds.",
        "Boons per Pandora’s Box (Kami: Yaoyorozu-no-Kamigami).",
        ["Appeasing the Kami", "The Watchful Spirit", "Tsukumogami"],
    ),
    "dodaem": pv(
        "dodaem",
        "Dodaem",
        "The Manitou Signature: totem medicine, dream-quest instruction, and war-songs that bind the camp.",
        "Boons per Pandora’s Box (Manitou: Dodaem).",
        ["Dream Quest", "Sacred Medicine", "War Medicine"],
    ),
    "heku": pv(
        "heku",
        "Heku",
        "The Netjer Signature: speaking power, effigies that move, and the harvest of living sekhem.",
        "Boons per Pandora’s Box (Netjer: Heku).",
        ["Animate Effigy", "Ren Harvest", "Sekhem Blaze"],
    ),
    "tianming": pv(
        "tianming",
        "Tianming",
        "The Shén Signature: Heaven’s mandate read in omens, promotion earned in trial, and the red thread of office.",
        "Boons per Pandora’s Box (Shén: Tianming).",
        ["Celestial Promotion", "Inner Balance", "Vermillion Tape"],
    ),
    "qut": pv(
        "qut",
        "Qut",
        "The Tengri Signature: contest-fortune, spirit interrogation, and the ransom taken from spilled blood.",
        "Boons per Pandora’s Box (Tengri: Qut).",
        ["Avarga", "Interrogate Spirit", "Soul’s Ransom"],
    ),
    "yidam": pv(
        "yidam",
        "Yidam",
        "The Pālas Signature: tutelary manifestation, vows made visible, and practice pressed into the world.",
        "Boons per Pandora’s Box (Pālas: Yidam).",
        ["Become Manifest", "Mandala’s Keening", "Refuge in the Image"],
    ),
    "behique": pv(
        "behique",
        "Behique",
        "The Zem Signature: spirit-shapes, idols that answer, and medicine that follows form, not argument.",
        "Boons per Pandora’s Box (Zem: Behique).",
        ["Form Follows Spirit", "Imbue Idol", "Healer’s Claim"],
    ),
}

NEW_PANTHEONS: dict[str, dict[str, Any]] = {
    "anunna": {
        "id": "anunna",
        "name": "Anunna — Mesopotamian Pantheon",
        "assetSkills": ["academics", "occult"],
        "description": "The great courts of Sumer, Akkad, and Babylon—tablets, ziggurats, and gods who remember being first.",
        "mechanicalEffects": "Society Path: two pantheon Asset Skills plus one more Skill (Origin p. 97).",
        "source": f"{PB} — Anunna pantheon; patron lists confirm against your PDFs.",
        "signaturePurviewId": "shuila",
        "deities": [
            {"id": "enki", "name": "Enki", "callings": ["creator", "sage", "trickster"], "purviews": ["deception", "earth", "fertility", "health", "order", "water"]},
            {"id": "marduk", "name": "Marduk", "callings": ["leader", "warrior", "judge"], "purviews": ["epicStrength", "order", "sky", "war"]},
            {"id": "shamash", "name": "Shamash", "callings": ["judge", "sage", "guardian"], "purviews": ["health", "order", "sun", "journeys"]},
            {"id": "enlil", "name": "Enlil", "callings": ["leader", "judge", "destroyer"], "purviews": ["order", "sky", "wild"]},
            {"id": "nergal", "name": "Nergal", "callings": ["destroyer", "judge", "warrior"], "purviews": ["death", "fire", "health", "war"]},
            {"id": "sin", "name": "Sin", "callings": ["judge", "liminal", "sage"], "purviews": ["darkness", "moon", "order", "stars"]},
            {"id": "ereshkigal", "name": "Ereshkigal", "callings": ["judge", "guardian", "monster"], "purviews": ["death", "darkness", "order"]},
            {"id": "ninhursag", "name": "Ninhursag", "callings": ["creator", "healer", "guardian"], "purviews": ["earth", "fertility", "health", "wild"]},
            {"id": "ishtar", "name": "Ishtar", "callings": ["lover", "warrior", "trickster"], "purviews": ["beauty", "passion", "war", "sky"]},
            {"id": "ninurta", "name": "Ninurta", "callings": ["guardian", "hunter", "warrior"], "purviews": ["epicStrength", "sky", "war", "wild"]},
            {"id": "tammuz", "name": "Tammuz", "callings": ["lover", "shepherd", "liminal"], "purviews": ["fertility", "health", "passion", "death"]},
        ],
    },
    "bogovi": {
        "id": "bogovi",
        "name": "Bogovi — Slavic Pantheon",
        "assetSkills": ["closeCombat", "culture"],
        "description": "Forest law, storm kings, and the old pacts that keep the world turning under Slavic skies.",
        "mechanicalEffects": "Society Path: two pantheon Asset Skills plus one more Skill (Origin p. 97).",
        "source": f"{PB} — Bogovi pantheon; confirm patrons at the table.",
        "signaturePurviewId": "dvoeverie",
        "deities": [
            {"id": "perun", "name": "Perun", "callings": ["guardian", "leader", "warrior"], "purviews": ["epicStrength", "sky", "war", "order"]},
            {"id": "veles", "name": "Veles", "callings": ["guardian", "trickster", "liminal"], "purviews": ["beasts", "death", "deception", "earth", "prosperity", "water"]},
            {"id": "mokosh", "name": "Mokosh", "callings": ["creator", "guardian", "healer"], "purviews": ["earth", "fertility", "health", "wild"]},
            {"id": "dazhbog", "name": "Dazhbog", "callings": ["lover", "leader", "sage"], "purviews": ["fire", "health", "sun", "prosperity"]},
            {"id": "morena", "name": "Morena", "callings": ["destroyer", "judge", "liminal"], "purviews": ["darkness", "death", "frost", "health"]},
            {"id": "stribog", "name": "Stribog", "callings": ["judge", "sage", "trickster"], "purviews": ["chaos", "journeys", "sky"]},
            {"id": "chors", "name": "Chors", "callings": ["guardian", "lover", "sage"], "purviews": ["moon", "sky", "stars", "sun"]},
            {"id": "svarozhich", "name": "Svarozhich", "callings": ["creator", "leader", "sage"], "purviews": ["fire", "forge", "order", "sun"]},
            {"id": "radegast", "name": "Radegast", "callings": ["liminal", "sage", "lover"], "purviews": ["artistry", "journeys", "moon", "stars"]},
            {"id": "svantovit", "name": "Svantovit", "callings": ["guardian", "warrior", "sage"], "purviews": ["fortune", "order", "war", "wild"]},
        ],
    },
    "apu": {
        "id": "apu",
        "name": "Apu — Andean Pantheon",
        "assetSkills": ["athletics", "survival"],
        "description": "Apus of peak and storm—ancestors on the heights, lightning on the cordillera, and cities older than their stones remember.",
        "mechanicalEffects": "Society Path: two pantheon Asset Skills plus one more Skill (Origin p. 97).",
        "source": f"{PB} — Apu pantheon.",
        "signaturePurviewId": "pachakutic",
        "deities": [
            {"id": "viracocha", "name": "Viracocha", "callings": ["creator", "sage", "trickster"], "purviews": ["artistry", "earth", "journeys", "sky", "water"]},
            {"id": "inti", "name": "Inti", "callings": ["guardian", "leader", "healer"], "purviews": ["fire", "health", "order", "sun"]},
            {"id": "mamaQuilla", "name": "Mama Quilla", "callings": ["guardian", "lover", "sage"], "purviews": ["beauty", "moon", "passion", "stars"]},
            {"id": "illapa", "name": "Illapa", "callings": ["guardian", "warrior", "judge"], "purviews": ["death", "sky", "war"]},
            {"id": "supay", "name": "Supay", "callings": ["judge", "liminal", "trickster"], "purviews": ["darkness", "death", "deception", "earth"]},
            {"id": "pachamama", "name": "Pachamama", "callings": ["creator", "guardian", "healer"], "purviews": ["earth", "fertility", "health", "prosperity"]},
            {"id": "mamaOcllo", "name": "Mama Ocllo", "callings": ["creator", "sage", "lover"], "purviews": ["beauty", "earth", "fertility", "order"]},
            {"id": "mancoCapac", "name": "Manco Cápac", "callings": ["leader", "warrior", "sage"], "purviews": ["epicStrength", "order", "sun", "war"]},
        ],
    },
    "atua": {
        "id": "atua",
        "name": "Atua — Polynesian Pantheon",
        "assetSkills": ["culture", "closeCombat"],
        "description": "Sky, sea, and lineage woven together—atua who walk as storm, shark, and the obligations between cousins.",
        "mechanicalEffects": "Society Path: two pantheon Asset Skills plus one more Skill (Origin p. 97).",
        "source": f"{PB} — Atua pantheon.",
        "signaturePurviewId": "atuaMana",
        "deities": [
            {"id": "tane", "name": "Tāne", "callings": ["creator", "guardian", "lover"], "purviews": ["beasts", "beauty", "fertility", "wild"]},
            {"id": "tangaroa", "name": "Tangaroa", "callings": ["creator", "trickster", "liminal"], "purviews": ["beasts", "deception", "moon", "water"]},
            {"id": "tumatauenga", "name": "Tūmatauenga", "callings": ["guardian", "warrior", "leader"], "purviews": ["death", "epicStrength", "passion", "war"]},
            {"id": "rongo", "name": "Rongo", "callings": ["healer", "sage", "lover"], "purviews": ["fertility", "health", "passion", "prosperity"]},
            {"id": "haumia", "name": "Haumia-tiketike", "callings": ["guardian", "healer", "sage"], "purviews": ["earth", "fertility", "health", "wild"]},
            {"id": "tawhirimatea", "name": "Tāwhirimātea", "callings": ["destroyer", "hunter", "sage"], "purviews": ["chaos", "epicDexterity", "sky"]},
            {"id": "ruamoko", "name": "Ruaumoko", "callings": ["destroyer", "liminal", "warrior"], "purviews": ["earth", "fire", "journeys"]},
            {"id": "hinenuitepo", "name": "Hine-nui-te-pō", "callings": ["judge", "liminal", "guardian"], "purviews": ["darkness", "death", "moon", "order"]},
        ],
    },
    "balahala": {
        "id": "balahala",
        "name": "Balahala — Philippine Pantheon",
        "assetSkills": ["athletics", "subterfuge"],
        "description": "Island spirits, ancestor bargains, and the bright edge between jungle and sea.",
        "mechanicalEffects": "Society Path: two pantheon Asset Skills plus one more Skill (Origin p. 97).",
        "source": f"{PB} — Balahala pantheon.",
        "signaturePurviewId": "paganito",
        "deities": [
            {"id": "bathala", "name": "Bathala", "callings": ["creator", "judge", "leader"], "purviews": ["order", "sky", "stars", "sun"]},
            {"id": "mayari", "name": "Mayari", "callings": ["guardian", "lover", "sage"], "purviews": ["beauty", "moon", "passion", "wild"]},
            {"id": "apolaki", "name": "Apolaki", "callings": ["guardian", "warrior", "leader"], "purviews": ["epicStrength", "sky", "sun", "war"]},
            {"id": "tala", "name": "Tala", "callings": ["guardian", "lover", "trickster"], "purviews": ["beauty", "moon", "stars", "deception"]},
            {"id": "hanan", "name": "Hanan", "callings": ["healer", "lover", "sage"], "purviews": ["beauty", "fertility", "health", "sun"]},
            {"id": "idiyanale", "name": "Idiyanale", "callings": ["creator", "healer", "sage"], "purviews": ["earth", "fertility", "health", "prosperity"]},
        ],
    },
    "ilhm": {
        "id": "ilhm",
        "name": "Ilhm — Persian Pantheon",
        "assetSkills": ["academics", "culture"],
        "description": "Feast-law, fire-temples, and guests bound by salt—Ilhm remembers the table as altar.",
        "mechanicalEffects": "Society Path: two pantheon Asset Skills plus one more Skill (Origin p. 97).",
        "source": f"{PB} — Ilhm pantheon (distinct from Yazata in published chapters).",
        "signaturePurviewId": "marzeh",
        "deities": [
            {"id": "anahita", "name": "Anahita", "callings": ["guardian", "healer", "lover"], "purviews": ["beauty", "fertility", "health", "water"]},
            {"id": "mithra", "name": "Mithra", "callings": ["guardian", "judge", "warrior"], "purviews": ["order", "sun", "war", "wild"]},
            {"id": "rashnu", "name": "Rashnu", "callings": ["judge", "sage", "liminal"], "purviews": ["death", "order", "stars", "journeys"]},
            {"id": "verethragna", "name": "Verethragna", "callings": ["warrior", "hunter", "guardian"], "purviews": ["beasts", "epicStrength", "sky", "war"]},
            {"id": "atar", "name": "Atar", "callings": ["guardian", "lover", "sage"], "purviews": ["fire", "health", "passion", "prosperity"]},
            {"id": "haoma", "name": "Haoma", "callings": ["healer", "sage", "creator"], "purviews": ["fertility", "health", "prosperity", "wild"]},
        ],
    },
    "kuh": {
        "id": "kuh",
        "name": "K’uh — Maya Pantheon",
        "assetSkills": ["academics", "occult"],
        "description": "Calendar priests, storm serpents, and the old cities whose stones still count days.",
        "mechanicalEffects": "Society Path: two pantheon Asset Skills plus one more Skill (Origin p. 97).",
        "source": f"{PB} — K’uh pantheon.",
        "signaturePurviewId": "tzolkin",
        "deities": [
            {"id": "kinichAhau", "name": "K’inich Ajaw", "callings": ["leader", "guardian", "warrior"], "purviews": ["epicStrength", "fire", "health", "sun"]},
            {"id": "chaac", "name": "Chaac", "callings": ["guardian", "healer", "warrior"], "purviews": ["fertility", "health", "sky", "water"]},
            {"id": "ixchel", "name": "Ixchel", "callings": ["creator", "healer", "sage"], "purviews": ["earth", "fertility", "moon", "water"]},
            {"id": "itzamna", "name": "Itzamna", "callings": ["creator", "sage", "judge"], "purviews": ["death", "health", "order", "sky"]},
            {"id": "kukulkan", "name": "K’uk’ulkan", "callings": ["liminal", "trickster", "warrior"], "purviews": ["beasts", "deception", "sky"]},
            {"id": "bulucChabtan", "name": "Buluc Chabtan", "callings": ["destroyer", "warrior", "hunter"], "purviews": ["death", "passion", "war"]},
        ],
    },
    "tengri": {
        "id": "tengri",
        "name": "Tengri — Turko-Mongol Pantheon",
        "assetSkills": ["athletics", "survival"],
        "description": "Eternal blue sky, steppe law, and shamans who bargain where soul meets storm.",
        "mechanicalEffects": "Society Path: two pantheon Asset Skills plus one more Skill (Origin p. 97).",
        "source": f"{PB} — Tengri pantheon.",
        "signaturePurviewId": "qut",
        "deities": [
            {"id": "kokTengri", "name": "Kök Tengri", "callings": ["judge", "leader", "sage"], "purviews": ["order", "sky", "stars"]},
            {"id": "erlik", "name": "Erlik", "callings": ["destroyer", "judge", "trickster"], "purviews": ["chaos", "darkness", "death", "deception"]},
            {"id": "umay", "name": "Umay", "callings": ["guardian", "healer", "lover"], "purviews": ["beasts", "fertility", "health", "wild"]},
            {"id": "mergen", "name": "Mergen", "callings": ["hunter", "sage", "warrior"], "purviews": ["epicDexterity", "journeys", "sky", "war"]},
            {"id": "kizagan", "name": "Kizagan", "callings": ["destroyer", "warrior", "adversary"], "purviews": ["death", "epicStrength", "war"]},
        ],
    },
    "palas": {
        "id": "palas",
        "name": "Pālas — Tibetan Pantheon",
        "assetSkills": ["academics", "occult"],
        "description": "Vows, mandalas, and wrathful compassion worn like armor—Pālas walk the ridge between miracle and rule.",
        "mechanicalEffects": "Society Path: two pantheon Asset Skills plus one more Skill (Origin p. 97).",
        "source": f"{PB} — Pālas pantheon.",
        "signaturePurviewId": "yidam",
        "deities": [
            {"id": "chenrezig", "name": "Chenrezig", "callings": ["healer", "guardian", "sage"], "purviews": ["beauty", "health", "passion", "prosperity"]},
            {"id": "greenTara", "name": "Green Tārā", "callings": ["guardian", "lover", "warrior"], "purviews": ["earth", "journeys", "passion", "wild"]},
            {"id": "manjushri", "name": "Mañjuśrī", "callings": ["sage", "warrior", "creator"], "purviews": ["artistry", "deception", "order", "war"]},
            {"id": "vajrapani", "name": "Vajrapāṇi", "callings": ["guardian", "warrior", "destroyer"], "purviews": ["epicStrength", "fire", "sky", "war"]},
            {"id": "paldenLhamo", "name": "Palden Lhamo", "callings": ["destroyer", "judge", "guardian"], "purviews": ["darkness", "death", "moon", "war"]},
        ],
    },
    "zem": {
        "id": "zem",
        "name": "Zem — Taíno Pantheon",
        "assetSkills": ["medicine", "culture"],
        "description": "Caribbean atabeys and yucahuas—storm, cassava, and spirits who remember the islands before the maps.",
        "mechanicalEffects": "Society Path: two pantheon Asset Skills plus one more Skill (Origin p. 97).",
        "source": f"{PB} — Zem pantheon.",
        "signaturePurviewId": "behique",
        "deities": [
            {"id": "yucahu", "name": "Yúcahu", "callings": ["creator", "guardian", "leader"], "purviews": ["earth", "fertility", "sky"]},
            {"id": "atabey", "name": "Atabey", "callings": ["creator", "healer", "lover"], "purviews": ["fertility", "health", "moon", "water"]},
            {"id": "boinayel", "name": "Boinayel", "callings": ["healer", "hunter", "sage"], "purviews": ["beasts", "health", "water", "wild"]},
            {"id": "juracan", "name": "Juracán", "callings": ["destroyer", "warrior", "trickster"], "purviews": ["chaos", "sky", "water"]},
            {"id": "guabancex", "name": "Guabancex", "callings": ["destroyer", "judge", "guardian"], "purviews": ["death", "fertility", "sky", "water"]},
        ],
    },
}

SIGNATURE_RETARGETS: dict[str, str] = {
    "manitou": "dodaem",
    "netjer": "heku",
    "deva": "yoga",
    "shen": "tianming",
    "kami": "yaoyorozuNoKamigami",
}

NEW_VIRTUES: dict[str, dict[str, Any]] = {
    "anunna": {
        "pantheonId": "anunna",
        "virtues": [
            {"id": "order", "name": "Order", "description": "Civilization measured against chaos—laws, ziggurats, and rightful stations.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
            {"id": "piety", "name": "Piety", "description": "The debt owed to what came before—ancestors, tablets, and the high heavens.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
        ],
    },
    "bogovi": {
        "pantheonId": "bogovi",
        "virtues": [
            {"id": "duty", "name": "Duty", "description": "The law between worlds that keeps mortals and gods from breaking each other.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
            {"id": "harmony", "name": "Harmony", "description": "Dvoeverie—two truths held without tearing the whole.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
        ],
    },
    "apu": {
        "pantheonId": "apu",
        "virtues": [
            {"id": "reciprocity", "name": "Reciprocity", "description": "What is taken must be returned—in offerings, labor, or story.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
            {"id": "endurance", "name": "Endurance", "description": "The long breath of peoples who live in thin air and long memory.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
        ],
    },
    "atua": {
        "pantheonId": "atua",
        "virtues": [
            {"id": "tapu", "name": "Tapu", "description": "Sacred limits—what must not be crossed without price.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
            {"id": "manaVirtue", "name": "Mana", "description": "Presence that reshapes the room—authority without apology.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
        ],
    },
    "balahala": {
        "pantheonId": "balahala",
        "virtues": [
            {"id": "utangNaLoob", "name": "Utang na Loob", "description": "Debts of the soul—gratitude, obligation, and the weave of favors.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
            {"id": "kapwa", "name": "Kapwa", "description": "Shared self—neighbor and stranger folded into one hearth.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
        ],
    },
    "ilhm": {
        "pantheonId": "ilhm",
        "virtues": [
            {"id": "hospitality", "name": "Hospitality", "description": "The guest is law; the table is covenant.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
            {"id": "lineage", "name": "Lineage", "description": "Names recited backward until they touch fire.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
        ],
    },
    "kuh": {
        "pantheonId": "kuh",
        "virtues": [
            {"id": "cosmicOrder", "name": "Cosmic Order", "description": "Days have owners; owners have duties.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
            {"id": "prophecy", "name": "Prophecy", "description": "What was read at the fire returns at the door.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
        ],
    },
    "tengri": {
        "pantheonId": "tengri",
        "virtues": [
            {"id": "courage", "name": "Courage", "description": "To stand in the ring—contest as prayer.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
            {"id": "freedom", "name": "Freedom", "description": "The open horizon—no fence that cannot be outridden.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
        ],
    },
    "palas": {
        "pantheonId": "palas",
        "virtues": [
            {"id": "compassion", "name": "Compassion", "description": "Mercy sharpened until it cuts delusion.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
            {"id": "discipline", "name": "Discipline", "description": "Vows kept when no one is watching the shrine.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
        ],
    },
    "zem": {
        "pantheonId": "zem",
        "virtues": [
            {"id": "survival", "name": "Survival", "description": "Island wit—root, reef, and rumor.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
            {"id": "reverence", "name": "Reverence", "description": "Spirits close enough to taste the salt on your skin.", "mechanicalEffects": "Momentum per Storypath rules; confirm wording in your PDF.", "source": PB},
        ],
    },
}


def main() -> int:
    pant: dict[str, Any] = json.loads(PANTHEONS_PATH.read_text(encoding="utf-8"))
    pur: dict[str, Any] = json.loads(PURVIEWS_PATH.read_text(encoding="utf-8"))
    vir: dict[str, Any] = json.loads(VIRTUES_PATH.read_text(encoding="utf-8"))

    for pid, row in NEW_PURVIEWS.items():
        if pid in pur and isinstance(pur[pid], dict):
            raise SystemExit(f"Refusing to overwrite existing purview key: {pid}")
        pur[pid] = row

    for pant_id, pant_row in NEW_PANTHEONS.items():
        if pant_id in pant and isinstance(pant[pant_id], dict):
            raise SystemExit(f"Refusing to overwrite existing pantheon key: {pant_id}")
        pant[pant_id] = pant_row

    for pant_id, sig in SIGNATURE_RETARGETS.items():
        if pant_id not in pant:
            raise SystemExit(f"Missing pantheon for retarget: {pant_id}")
        pant[pant_id]["signaturePurviewId"] = sig

    for vid, block in NEW_VIRTUES.items():
        if vid in vir:
            raise SystemExit(f"Refusing to overwrite virtues key: {vid}")
        vir[vid] = block

    PANTHEONS_PATH.write_text(json.dumps(pant, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    PURVIEWS_PATH.write_text(json.dumps(pur, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    VIRTUES_PATH.write_text(json.dumps(vir, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Updated:", PANTHEONS_PATH, PURVIEWS_PATH, VIRTUES_PATH, sep="\n  ")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
