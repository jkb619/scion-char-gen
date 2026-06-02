#!/usr/bin/env python3
"""
Enrich data/tags.json with Origin/Hero tag point costs and Divine Armory citations.
Descriptions are short paraphrases (not full reproduced rules text).

  python3 scripts/merge_storypath_weapon_tags.py
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TAGS = ROOT / "data" / "tags.json"

# (id, display_name, book_category, point_cost, point_cost_alt, tag_type, applies_to, desc, source_short)
# book_category: Weapon | Armor | Follower; point_cost_alt only for tiered purchases (unused on most rows)
WEAPON = [
    ("aggravated", "Aggravated", "Weapon", 2, None, "weapon", ["equipment", "relic", "creature"], "Supernatural grievous harm; Aggravated Conditions need magic to heal.", "Origin (Revised) p. 123"),
    ("arcing", "Arcing", "Weapon", 1, None, "weapon", ["equipment", "relic"], "Arcing shots: downgrade target cover one step when firing around it.", "Origin (Revised) p. 123"),
    ("automatic", "Automatic", "Weapon", 2, None, "weapon", ["equipment", "relic"], "Burst fire: +1 Enhancement to Critical Hit stunt; incompatible with Melee and Shockwave; complications after Empty the Clip per book.", "Origin (Revised) p. 124"),
    ("firearm", "Firearm", "Weapon", 0, None, "weapon", ["equipment", "relic"], "Gun: use Firearms; +1 Enhancement to Firearms.", "Origin (Revised) p. 124"),
    ("grappling", "Grappling", "Weapon", 1, None, "weapon", ["equipment", "relic", "creature"], "+1 Enhancement to Grapple attacks with this weapon.", "Origin (Revised) p. 124"),
    ("longRange", "Long range", "Weapon", 1, None, "weapon", ["equipment", "relic"], "Effective range band extends to long.", "Origin (Revised) p. 124"),
    ("messy", "Messy", "Weapon", -1, None, "weapon", ["equipment", "relic"], "Ragged wounds or splattered cover; leaves an obvious trail.", "Origin (Revised) p. 125"),
    ("natural", "Natural", "Weapon", 1, None, "weapon", ["equipment", "relic", "creature"], "Body weapon (fangs, claws); cannot be disarmed; injuries may still impose penalties.", "Origin (Revised) p. 125"),
    ("piercing", "Piercing", "Weapon", 2, None, "weapon", ["equipment", "relic", "creature"], "When dealing damage, reduce target hard armor by 1 or soft armor by 2.", "Origin (Revised) p. 125"),
    ("pushing", "Pushing", "Weapon", 1, None, "weapon", ["equipment", "relic", "creature"], "After Stress or Injury, may also knock the target prone.", "Origin (Revised) p. 125"),
    ("returning", "Returning", "Weapon", 1, None, "weapon", ["equipment", "relic"], "Thrown or fired weapon returns to the wielder (boomerang, tethered harpoon, etc.).", "Origin (Revised) p. 125"),
    ("shockwave", "Shockwave", "Weapon", 4, None, "weapon", ["equipment", "relic"], "Can strike all targets in the same range band; large Scale or magic—rare on mundane weapons.", "Origin (Revised) p. 125"),
    ("slow", "Slow", "Weapon", -1, None, "weapon", ["equipment", "relic"], "Setup, reload, or repositioning: dedicate an action to the slow aspect.", "Origin (Revised) p. 125"),
    ("stun", "Stun", "Weapon", 1, None, "weapon", ["equipment", "relic", "creature"], "Injury outcomes limited to listed bruising/stagger/stun/battered; Taken Out means unconscious.", "Origin (Revised) p. 125"),
    ("thrown", "Thrown", "Weapon", 0, None, "weapon", ["equipment", "relic"], "Thrown to medium range; use Athletics or Firearms per build; harder to use at Close (see book).", "Origin (Revised) p. 125"),
    ("twoHanded", "Two-handed", "Weapon", -1, None, "weapon", ["equipment", "relic"], "Requires both hands.", "Origin (Revised) p. 125"),
    ("unconcealable", "Unconcealable", "Weapon", -1, None, "weapon", ["equipment", "relic"], "Too bulky to hide without serious smuggling effort.", "Origin (Revised) p. 125"),
    ("weaponVersatile", "Versatile (weapon)", "Weapon", 2, None, "weapon", ["equipment", "relic"], "+1 Enhancement when using this weapon for Stunts (table weapon tag, not generic gear versatility).", "Origin (Revised) p. 126"),
    ("worn", "Worn", "Weapon", 2, None, "weapon", ["equipment", "relic"], "Strapped on; cannot be disarmed.", "Origin (Revised) p. 126"),
    ("concealableWeapon", "Concealable (weapon)", "Weapon", 1, None, "weapon", ["equipment", "relic"], "+1 Enhancement to sneak this weapon into a place unseen.", "Origin (Revised) p. 124"),
    ("weaponLoud", "Loud (weapon)", "Weapon", -1, None, "weapon", ["equipment", "relic"], "Cannot be silenced; firing where people can hear draws attention.", "Origin (Revised) p. 125"),
]

ARMOR = [
    ("cumbersome", "Cumbersome", "Armor", -1, None, "armor", ["equipment", "relic", "creature"], "+1 Difficulty to athletic feats while worn.", "Origin (Revised) p. 126"),
    ("concealableArmor", "Concealable (armor)", "Armor", 2, None, "armor", ["equipment", "relic"], "Can be hidden under clothing.", "Origin (Revised) p. 126"),
    ("innocuous", "Innocuous", "Armor", 2, None, "armor", ["equipment", "relic"], "Looks like ordinary clothes or sports pads; common on Relic armor.", "Origin (Revised) p. 126"),
    ("resistant", "Resistant", "Armor", 2, None, "armor", ["equipment", "relic", "creature"], "Tuned vs a damage type (e.g. bulletproof vs Firearms+Piercing); may be taken more than once if points allow.", "Origin (Revised) p. 126"),
    ("weighty", "Weighty", "Armor", -1, None, "armor", ["equipment", "relic", "creature"], "Long labor or sleeping in it risks Fatigued (Athletics+Stamina vs Difficulty 3 per book).", "Origin (Revised) p. 126"),
]

FOLLOWER = [
    ("followerArchetype", "Archetype (follower)", "Follower", None, None, "follower", ["follower"], "Extra archetype (Heavy, Entourage, Consultant).", "Hero (Final) p. 204"),
    ("followerGroup", "Group (follower)", "Follower", None, None, "follower", ["follower"], "Five to ten people; mixed action to issue two orders at once.", "Hero (Final) p. 204"),
    ("followerMob", "Mob (follower)", "Follower", None, None, "follower", ["follower"], "Twenty to fifty people; Scale one higher than the Hero on numbers; mixed action for two orders.", "Hero (Final) p. 204"),
    ("followerSavage", "Savage (follower)", "Follower", None, None, "follower", ["follower", "creature"], "+2 Enhancement on actions meant to harm (physical or emotional).", "Hero (Final) p. 204"),
    ("followerAccess", "Access (follower)", "Follower", None, None, "follower", ["follower"], "Opens one Terra Incognita, Overworld, Underworld, or a broad class of mortal institution (repeatable).", "Hero (Final) p. 204"),
    ("followerSmooth", "Smooth (follower)", "Follower", None, None, "follower", ["follower"], "Improves Storyguide character Attitude by 1 when present and receptive.", "Hero (Final) p. 204"),
]

MAP_CATEGORY = {"Weapon": "combat", "Armor": "protection", "Follower": "social"}

DA = "7711-Divine_Armory.pdf; 7711-Divine_Armory_-_List_of_Weapons.pdf (local Scion/books)."


def row_to_entry(
    tid: str,
    name: str,
    book_cat: str,
    pc: int | None,
    pca: int | None,
    tag_type: str,
    applies: list[str],
    desc: str,
    src: str,
) -> dict:
    out: dict = {
        "id": tid,
        "name": name,
        "bookCategory": book_cat,
        "pointCost": pc,
        "tagType": tag_type,
        "category": MAP_CATEGORY[book_cat],
        "appliesTo": applies,
        "description": desc,
        "source": f"{src} See also {DA}",
    }
    if pca is not None:
        out["pointCostAlt"] = pca
        out["pointCostNote"] = "Tiered purchase on the table — verify second tier cost in Origin (Revised) p. 126."
    return out


def dedupe_list(seq: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for x in seq:
        if x in seen:
            continue
        seen.add(x)
        out.append(x)
    return out


def main() -> None:
    data = json.loads(TAGS.read_text(encoding="utf-8"))
    meta = data.setdefault("_meta", {})
    meta["pointCostNote"] = (
        "`pointCost` is the Storypath tag dot cost from Origin (Revised) weapon and armor lists (pp. 123–126) "
        "and Hero follower tags (p. 204). Negative values are flaw credits. `null` means the table does not "
        "assign a dot price on that line. Confirm costs at the PDF before autopricing in play."
    )
    meta["bookCategories"] = ["", "Weapon", "Armor", "Follower"]
    meta["sourceDocuments"] = dedupe_list(
        list(meta.get("sourceDocuments", []))
        + [
            "Scion_Origin_(Revised_Download).pdf — weapon and armor tags pp. 123–126",
            "Scion_Hero_(Final_Download).pdf — follower tags p. 204",
            r"C:\Users\John\Desktop\Scion\books\7711-Divine_Armory.pdf",
            r"C:\Users\John\Desktop\Scion\books\7711-Divine_Armory_-_List_of_Weapons.pdf",
            "/mnt/c/Users/John/Desktop/Scion/books/7711-Divine_Armory.pdf",
            "/mnt/c/Users/John/Desktop/Scion/books/7711-Divine_Armory_-_List_of_Weapons.pdf",
        ],
    )
    tt = list(meta.get("tagTypes", []))
    if "follower" not in tt:
        tt.append("follower")
    meta["tagTypes"] = dedupe_list(tt)

    for block in (WEAPON, ARMOR, FOLLOWER):
        for row in block:
            data[row[0]] = row_to_entry(*row)

    if "hardArmor" in data:
        ha = data["hardArmor"]
        ha["pointCost"] = 1
        ha["pointCostAlt"] = 3
        ha["bookCategory"] = "Armor"
        ha["pointCostNote"] = (
            "Hard armor adds Injury Condition boxes per Origin (Revised) p. 126: cheaper tier one box, "
            "higher tier an additional box; boxes stay filled until scene end; not combined with Soft on the same armor."
        )
        ha["source"] = f"Origin (Revised) p. 126. See also {DA}"

    if "softArmor" in data:
        sa = data["softArmor"]
        sa["pointCost"] = 1
        sa["bookCategory"] = "Armor"
        sa["pointCostNote"] = (
            "Soft armor raises Difficulty to Inflict Damage; Hard and Soft do not stack on the same armor "
            "but may from different sources (Origin p. 126)."
        )
        sa["description"] = (
            "Flexible protection: +1 Difficulty to the Inflict Damage stunt against the wearer; confirm stacking with SG."
        )
        sa["source"] = f"Origin (Revised) p. 126. See also {DA}"

    core = {
        "bashing": ("Weapon", 0, "Blunt harm; Broken/Battered-style outcomes; not for severing.", "Origin (Revised) p. 124"),
        "lethal": ("Weapon", 0, "Lethal track (Scratched, Cut, Bleeding Out); not Bruised/Battered from this tag.", "Origin (Revised) p. 124"),
        "melee": ("Weapon", 0, "Close range only; Close Combat +1 Enhancement.", "Origin (Revised) p. 125"),
        "ranged": ("Weapon", 0, "Medium band; +1 Difficulty firing at Close; Firearms or Athletics +1 Enhancement.", "Origin (Revised) p. 125"),
        "reach": ("Weapon", 1, "Close Combat attacks reach out to short range (long haft, whip, etc.).", "Origin (Revised) p. 125"),
        "brutal": ("Weapon", 1, "Critical Stunt needs one fewer success.", "Origin (Revised) p. 124"),
    }
    for tid, (bc, pc, desc, src) in core.items():
        if tid not in data:
            continue
        e = data[tid]
        e["bookCategory"] = bc
        e["pointCost"] = pc
        e["description"] = desc
        e["source"] = f"{src} See also {DA}"

    if "brutal" not in data:
        data["brutal"] = row_to_entry(
            "brutal",
            "Brutal",
            "Weapon",
            1,
            None,
            "weapon",
            ["equipment", "relic", "creature"],
            "Critical Stunt needs one fewer success.",
            "Origin (Revised) p. 124",
        )

    TAGS.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    n = len([k for k in data if not k.startswith("_")])
    print("Wrote", TAGS, "tag count:", n)


if __name__ == "__main__":
    main()
