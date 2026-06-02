"""Generate data/pantheons.json from structured tables (Appendix 2, Scion Origin Revised).

Extended pantheons from Pandora’s Box (Revised) are merged into `data/pantheons.json` via
`scripts/apply_pb_pantheon_bundle.py` (run once after pulling); re-run this generator only when
editing the Origin core `PANTHEONS` list below, then re-apply the PB bundle if needed.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "pantheons.json"

# Asset skills follow Character Creation summary (Origin ~p. 95), not every appendix header variant.
PANTHEONS = [
    {
        "id": "aesir",
        "name": "Æsir — Norse Gods",
        "assetSkills": ["closeCombat", "occult"],
        "description": "Gods of the Norse sphere—fate, storms, and the long winter.",
        "mechanicalEffects": "Society Path grants these two Asset Skills plus one more Skill of your choice (Origin p. 97).",
        "source": "Scion_Origin_(Revised_Download).pdf, Character Creation pantheon list p. 95; Appendix 2 pp. 170–171",
        "deities": [
            {"id": "odin", "name": "Odin", "callings": ["leader", "sage", "trickster"], "purviews": ["artistry", "death", "deception", "epicStamina", "fortune", "journeys", "war"]},
            {"id": "thor", "name": "Thor", "callings": ["guardian", "leader", "warrior"], "purviews": ["epicStamina", "epicStrength", "fertility", "sky"]},
            {"id": "frigg", "name": "Frigg", "callings": ["guardian", "lover", "sage"], "purviews": ["beasts", "fortune", "order", "wild"]},
            {"id": "hel", "name": "Hel", "callings": ["guardian", "judge", "liminal"], "purviews": ["death", "forge", "frost", "health", "passion"]},
            {"id": "baldr", "name": "Baldr", "callings": ["guardian", "liminal", "lover"], "purviews": ["beauty", "passion", "health", "epicStamina", "sun"]},
            {"id": "heimdall", "name": "Heimdall", "callings": ["creator", "guardian", "hunter"], "purviews": ["artistry", "beauty", "epicStamina", "journeys"]},
            {"id": "loki", "name": "Loki", "callings": ["liminal", "lover", "trickster"], "purviews": ["chaos", "deception", "epicStrength", "fire"]},
            {"id": "sif", "name": "Sif", "callings": ["creator", "guardian", "lover"], "purviews": ["beauty", "earth", "fertility", "order"]},
            {"id": "tyr", "name": "Tyr", "callings": ["judge", "leader", "warrior"], "purviews": ["epicStamina", "order", "passion", "war"]},
            {"id": "freya", "name": "Freya", "callings": ["lover", "guardian", "sage"], "purviews": ["beauty", "epicStamina", "death", "fertility", "fortune", "passion", "war"]},
            {"id": "freyr", "name": "Freyr", "callings": ["lover", "warrior", "leader"], "purviews": ["beauty", "fertility", "order", "war", "wild"]},
            {"id": "skadi", "name": "Skaði", "callings": ["hunter", "judge", "warrior"], "purviews": ["earth", "epicDexterity", "frost", "journeys", "order"]},
            {"id": "njord", "name": "Njörðr", "callings": ["creator", "hunter", "liminal"], "purviews": ["fertility", "fire", "journeys", "prosperity", "sky", "water"]},
        ],
    },
    {
        "id": "manitou",
        "name": "Manitou — Algonquian Pantheon",
        "assetSkills": ["medicine", "occult"],
        "description": "Spirits and culture heroes tied to lakes, forests, and Skyworld stories.",
        "mechanicalEffects": "Society Path Asset Skills plus one more Skill (Origin p. 97).",
        "source": "Scion_Origin_(Revised_Download).pdf, p. 95; Appendix 2 pp. 171–172",
        "deities": [
            {"id": "geezhigoQuae", "name": "Geezhigo-Quae", "callings": ["guardian", "healer", "sage"], "purviews": ["beasts", "moon", "order", "sky", "stars"]},
            {"id": "muzzuKumikQuae", "name": "Muzzu-Kumik-Quae", "callings": ["healer", "hunter", "sage"], "purviews": ["beasts", "earth", "fertility", "sky", "water", "wild"]},
            {"id": "winonah", "name": "Winonah", "callings": ["guardian", "healer", "lover"], "purviews": ["epicStamina", "fortune", "health", "passion", "prosperity"]},
            {"id": "maudjeeKawiss", "name": "Maudjee-Kawiss", "callings": ["hunter", "leader", "warrior"], "purviews": ["beasts", "epicDexterity", "epicStrength", "war"]},
            {"id": "pukawiss", "name": "Pukawiss", "callings": ["lover", "sage", "trickster"], "purviews": ["epicDexterity", "artistry", "passion", "fortune", "deception"]},
            {"id": "cheebyAubOozoo", "name": "Cheeby-aub-oozoo", "callings": ["hunter", "judge", "liminal"], "purviews": ["artistry", "beasts", "darkness", "death", "epicStamina", "order"]},
            {"id": "nanaboozoo", "name": "Nana’b’oozoo", "callings": ["hunter", "trickster", "warrior"], "purviews": ["beasts", "chaos", "epicDexterity", "fortune", "journeys"]},
            {"id": "ioskeha", "name": "Ioskeha", "callings": ["creator", "leader", "warrior"], "purviews": ["forge", "sun", "sky", "order", "beasts", "health", "passion"]},
            {"id": "tawiscara", "name": "Tawiscara", "callings": ["creator", "trickster", "warrior"], "purviews": ["chaos", "deception", "darkness", "death", "passion", "forge", "war"]},
        ],
    },
    {
        "id": "theoi",
        "name": "Theoi — Greco-Roman Pantheon",
        "assetSkills": ["empathy", "persuasion"],
        "description": "Olympians and their rivals—politics, passion, and polis.",
        "mechanicalEffects": "Society Path Asset Skills plus one more Skill (Origin p. 97).",
        "source": "Scion_Origin_(Revised_Download).pdf, p. 95; Appendix 2 pp. 171–173",
        "deities": [
            {"id": "zeus", "name": "Zeus", "callings": ["leader", "lover", "trickster"], "purviews": ["deception", "epicStrength", "epicStamina", "fortune", "order", "sky"]},
            {"id": "hera", "name": "Hera", "callings": ["judge", "leader", "lover"], "purviews": ["beauty", "fertility", "health", "order", "passion", "prosperity"]},
            {"id": "athena", "name": "Athena", "callings": ["guardian", "sage", "warrior"], "purviews": ["artistry", "beasts", "epicDexterity", "order", "war"]},
            {"id": "apollo", "name": "Apollo", "callings": ["healer", "judge", "sage"], "purviews": ["artistry", "epicDexterity", "health", "sun"]},
            {"id": "artemis", "name": "Artemis", "callings": ["guardian", "healer", "hunter"], "purviews": ["beasts", "epicDexterity", "health", "moon", "wild"]},
            {"id": "aphrodite", "name": "Aphrodite", "callings": ["creator", "guardian", "lover"], "purviews": ["beauty", "fertility", "passion", "prosperity"]},
            {"id": "ares", "name": "Ares", "callings": ["guardian", "lover", "warrior"], "purviews": ["chaos", "fertility", "order", "passion", "prosperity", "war"]},
            {"id": "hephaestus", "name": "Hephaestus", "callings": ["creator", "sage", "trickster"], "purviews": ["epicStamina", "fire", "forge", "fortune"]},
            {"id": "hermes", "name": "Hermes", "callings": ["liminal", "sage", "trickster"], "purviews": ["death", "deception", "epicDexterity", "journeys", "prosperity"]},
            {"id": "poseidon", "name": "Poseidon", "callings": ["guardian", "hunter", "leader"], "purviews": ["beasts", "epicStrength", "earth", "water"]},
            {"id": "hades", "name": "Hades", "callings": ["judge", "leader", "liminal"], "purviews": ["darkness", "death", "earth", "prosperity"]},
            {"id": "dionysus", "name": "Dionysus", "callings": ["liminal", "lover", "sage"], "purviews": ["artistry", "chaos", "deception", "fertility", "passion", "wild"]},
        ],
    },
    {
        "id": "netjer",
        "name": "Netjer — Egyptian Pantheon",
        "assetSkills": ["academics", "occult"],
        "description": "The court of lives, death, and starlit deserts.",
        "mechanicalEffects": "Society Path Asset Skills plus one more Skill (Origin p. 97).",
        "source": "Scion_Origin_(Revised_Download).pdf, p. 95; Appendix 2 pp. 172–173",
        "deities": [
            {"id": "re", "name": "Re", "callings": ["creator", "judge", "leader"], "purviews": ["beasts", "death", "epicStamina", "fire", "journeys", "order", "sun"]},
            {"id": "wesir", "name": "Wesir", "callings": ["creator", "judge", "leader"], "purviews": ["beasts", "death", "earth", "fertility", "order"]},
            {"id": "aset", "name": "Aset", "callings": ["guardian", "healer", "trickster"], "purviews": ["beasts", "death", "deception", "fertility", "fortune", "health", "stars"]},
            {"id": "set", "name": "Set", "callings": ["guardian", "leader", "trickster"], "purviews": ["beasts", "chaos", "earth", "epicStrength", "journeys", "sky", "war"]},
            {"id": "anpu", "name": "Anpu", "callings": ["guardian", "judge", "liminal"], "purviews": ["beasts", "darkness", "death", "order"]},
            {"id": "bast", "name": "Bast", "callings": ["guardian", "hunter", "warrior"], "purviews": ["artistry", "beasts", "epicDexterity", "fertility", "fortune", "health", "moon", "sun", "war"]},
            {"id": "heru", "name": "Heru", "callings": ["guardian", "leader", "warrior"], "purviews": ["beasts", "moon", "order", "sky", "sun", "war"]},
            {"id": "djehuty", "name": "Djehuty", "callings": ["guardian", "liminal", "sage"], "purviews": ["beasts", "deception", "fortune", "health", "moon", "order"]},
        ],
    },
    {
        "id": "kami",
        "name": "Kami — Japanese Gods",
        "assetSkills": ["closeCombat", "culture"],
        "description": "Amatsukami and Kunitsukami—myriad kami of shrine and story.",
        "mechanicalEffects": "Society Path Asset Skills plus one more Skill (Origin p. 95 list).",
        "source": "Scion_Origin_(Revised_Download).pdf, p. 95; Appendix 2 pp. 173–174",
        "deities": [
            {"id": "amaterasu", "name": "Amaterasu", "callings": ["judge", "leader", "sage"], "purviews": ["epicStrength", "fertility", "order", "prosperity", "sun"]},
            {"id": "tsukiyomi", "name": "Tsukiyomi", "callings": ["healer", "liminal", "judge"], "purviews": ["artistry", "darkness", "moon", "order"]},
            {"id": "susanoo", "name": "Susano-o", "callings": ["creator", "trickster", "warrior"], "purviews": ["artistry", "chaos", "death", "epicStrength", "forge", "sky", "water"]},
            {"id": "hachiman", "name": "Hachiman", "callings": ["leader", "sage", "warrior"], "purviews": ["artistry", "beasts", "order", "prosperity", "war"]},
            {"id": "inari", "name": "Inari", "callings": ["creator", "healer", "liminal"], "purviews": ["beasts", "fertility", "fortune", "health", "journeys", "prosperity"]},
            {"id": "takemikazuchi", "name": "Takemikazuchi", "callings": ["guardian", "leader", "warrior"], "purviews": ["beasts", "epicDexterity", "epicStamina", "epicStrength", "sky", "war"]},
        ],
    },
    {
        "id": "tuathaDeDanann",
        "name": "Tuatha Dé Danann — Irish Gods",
        "assetSkills": ["closeCombat", "culture"],
        "description": "Gods of hills, brughs, and bargains struck in torchlight.",
        "mechanicalEffects": "Society Path Asset Skills plus one more Skill (Origin p. 97).",
        "source": "Scion_Origin_(Revised_Download).pdf, p. 95; Appendix 2 pp. 173–174",
        "deities": [
            {"id": "theDagda", "name": "The Dagda", "callings": ["guardian", "leader", "sage"], "purviews": ["epicStamina", "epicStrength", "fertility", "forge", "prosperity", "war"]},
            {"id": "brigid", "name": "Brigid", "callings": ["healer", "sage", "trickster"], "purviews": ["artistry", "fertility", "fire", "forge", "health"]},
            {"id": "lugh", "name": "Lugh", "callings": ["creator", "leader", "warrior"], "purviews": ["artistry", "epicDexterity", "epicStrength", "forge", "health", "order", "prosperity", "war"]},
            {"id": "morrigan", "name": "The Morrígan", "callings": ["liminal", "lover", "sage"], "purviews": ["beasts", "chaos", "death", "epicDexterity", "fortune", "prosperity", "war"]},
            {"id": "manannan", "name": "Manannán mac Lir", "callings": ["guardian", "liminal", "trickster"], "purviews": ["deception", "journeys", "prosperity", "stars", "water"]},
            {"id": "aengus", "name": "Aengus", "callings": ["guardian", "lover", "trickster"], "purviews": ["beasts", "beauty", "deception", "moon", "passion"]},
        ],
    },
    {
        "id": "orisha",
        "name": "Òrìshà — Yorùbá Pantheon",
        "assetSkills": ["medicine", "subterfuge"],
        "description": "Orishas of river, forge, and drum—community and trial woven together.",
        "mechanicalEffects": "Society Path Asset Skills plus one more Skill (Origin p. 97).",
        "source": "Scion_Origin_(Revised_Download).pdf, p. 95; Appendix 2 pp. 174–175",
        "deities": [
            {"id": "oya", "name": "Oya Iyansan", "callings": ["guardian", "liminal", "warrior"], "purviews": ["beasts", "epicDexterity", "epicStrength", "death", "prosperity", "sky", "water"]},
            {"id": "shango", "name": "Shàngó", "callings": ["leader", "lover", "warrior"], "purviews": ["artistry", "beauty", "epicStrength", "fire", "order", "passion", "prosperity", "sky", "war"]},
            {"id": "oshun", "name": "Òshun", "callings": ["healer", "lover", "sage"], "purviews": ["beasts", "beauty", "fertility", "fortune", "frost", "health", "passion", "prosperity", "water"]},
            {"id": "ogun", "name": "Ògún", "callings": ["creator", "hunter", "warrior"], "purviews": ["earth", "epicStrength", "epicStamina", "forge", "passion", "war"]},
            {"id": "obatala", "name": "Obàtálá", "callings": ["creator", "judge", "leader"], "purviews": ["artistry", "health", "order", "sky"]},
            {"id": "eshu", "name": "Èshù Elègbará", "callings": ["liminal", "lover", "trickster"], "purviews": ["artistry", "chaos", "deception", "epicDexterity", "fortune", "journeys"]},
        ],
    },
    {
        "id": "deva",
        "name": "Devá — Gods of South Asia",
        "assetSkills": ["athletics", "survival"],
        "description": "Vedic currents, storm thrones, and wheel-turning kings.",
        "mechanicalEffects": "Society Path Asset Skills plus one more Skill (Origin p. 97).",
        "source": "Scion_Origin_(Revised_Download).pdf, p. 95; Appendix 2 pp. 175–176",
        "deities": [
            {"id": "indra", "name": "Indra", "callings": ["guardian", "leader", "warrior"], "purviews": ["beasts", "epicStrength", "epicDexterity", "fertility", "order", "sky", "war", "wild"]},
            {"id": "agni", "name": "Agni", "callings": ["guardian", "liminal", "sage"], "purviews": ["epicStrength", "epicDexterity", "fire", "journeys", "prosperity", "water"]},
            {"id": "shiva", "name": "Shiva", "callings": ["hunter", "lover", "sage"], "purviews": ["artistry", "beasts", "chaos", "death", "deception", "epicStrength", "epicDexterity", "epicStamina", "fertility", "fire", "moon", "sky"]},
            {"id": "vishnu", "name": "Vishnu", "callings": ["guardian", "lover", "trickster"], "purviews": ["artistry", "beauty", "deception", "epicStamina", "epicStrength", "epicDexterity", "order", "passion"]},
            {"id": "kali", "name": "Kali", "callings": ["guardian", "liminal", "warrior"], "purviews": ["epicStrength", "epicDexterity", "epicStamina", "artistry", "chaos", "darkness", "death", "deception", "fire"]},
            {"id": "ganesha", "name": "Ganesha", "callings": ["guardian", "liminal", "sage"], "purviews": ["artistry", "beasts", "chaos", "fortune", "journeys", "prosperity"]},
        ],
    },
    {
        "id": "shen",
        "name": "Shén — Chinese Pantheon",
        "assetSkills": ["academics", "leadership"],
        "description": "Celestial bureaucracy, rivers of ink, and monkey-king mischief.",
        "mechanicalEffects": "Society Path Asset Skills plus one more Skill (Origin p. 97).",
        "source": "Scion_Origin_(Revised_Download).pdf, p. 95; Appendix 2 pp. 175–176",
        "deities": [
            {"id": "nuwa", "name": "Nuwā", "callings": ["creator", "guardian", "healer"], "purviews": ["earth", "fertility", "forge", "health", "moon", "sky"]},
            {"id": "fuxi", "name": "Fuxi", "callings": ["creator", "hunter", "sage"], "purviews": ["artistry", "beasts", "fertility", "forge", "fortune", "health", "order", "sun"]},
            {"id": "guanYu", "name": "Guan Yu", "callings": ["guardian", "leader", "warrior"], "purviews": ["artistry", "epicStrength", "epicStamina", "order", "passion", "prosperity", "sky", "war"]},
            {"id": "sunWukong", "name": "Sun Wukong", "callings": ["liminal", "trickster", "warrior"], "purviews": ["artistry", "beasts", "chaos", "deception", "epicDexterity", "epicStamina", "epicStrength", "journeys", "war"]},
            {"id": "nezha", "name": "Prince Nezha", "callings": ["guardian", "trickster", "warrior"], "purviews": ["artistry", "epicStamina", "epicStrength", "health", "war"]},
            {"id": "change", "name": "Chang’e", "callings": ["healer", "lover", "trickster"], "purviews": ["beasts", "beauty", "epicStamina", "health", "moon"]},
            {"id": "huangdi", "name": "Huangdi", "callings": ["creator", "leader", "sage"], "purviews": ["beasts", "death", "earth", "forge", "health", "order", "prosperity", "war"]},
        ],
    },
    {
        "id": "teotl",
        "name": "Teōtl — Aztec Gods",
        "assetSkills": ["culture", "empathy"],
        "description": "Flower wars, thirsty suns, and altars that remember.",
        "mechanicalEffects": "Society Path Asset Skills plus one more Skill (Origin p. 97).",
        "source": "Scion_Origin_(Revised_Download).pdf, p. 95; Appendix 2 pp. 176–177",
        "deities": [
            {"id": "quetzalcoatl", "name": "Quetzalcoatl", "callings": ["creator", "liminal", "sage"], "purviews": ["artistry", "beasts", "fertility", "journeys", "order", "sky", "stars"]},
            {"id": "huitzilopochtli", "name": "Huītzilōpōchtli", "callings": ["guardian", "leader", "warrior"], "purviews": ["beasts", "death", "epicStrength", "prosperity", "sun", "war"]},
            {"id": "tezcatlipoca", "name": "Tezcatlipoca", "callings": ["hunter", "leader", "trickster"], "purviews": ["beasts", "chaos", "darkness", "deception", "earth", "fortune", "war"]},
            {"id": "tlaloc", "name": "Tlāloc", "callings": ["guardian", "healer", "hunter"], "purviews": ["death", "earth", "fertility", "frost", "health", "sky"]},
            {"id": "xochipilli", "name": "Xochipilli", "callings": ["guardian", "lover", "trickster"], "purviews": ["artistry", "beauty", "fortune", "passion", "prosperity"]},
        ],
    },
]


def main() -> None:
    data = {p["id"]: p for p in PANTHEONS}
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
