/**
 * Hover hints: short in-play examples + primary core-book citations
 * (Scion: Origin Revised, Hero, Demigod, God — 2nd edition).
 */

export const BOOK = {
  origin: "Scion: Origin (Revised)",
  hero: "Scion: Hero (2nd ed.)",
  demigod: "Scion: Demigod (2nd ed.)",
  god: "Scion: God (2nd ed.)",
};

/** @param {keyof typeof BOOK} book @param {string} section @param {string} [pages] */
export function cite(book, section, pages) {
  const title = BOOK[book];
  return pages ? `${title}, ${section}, pp. ${pages}` : `${title}, ${section}`;
}

/** @param {string} example @param {string} source */
export function docHint(example, source) {
  return `Example: ${example}\n\nSource: ${source}`;
}

/** @type {Record<string, { example: string; source: string }>} */
export const HELP = {
  "welcome-line-select": {
    example: "Deity: Mortal through God. Titan: Titanic Hero through God. Dragon: Heir — Inheritance on Welcome. Sorcerer: Mortal-band through God-band tiers (Saints & Monsters ch. 3).",
    source: `${cite("origin", "Character Creation (tiers)", "94–106")}; Scion_-_Titanomachy_(Final_Download).pdf; Scion_Dragon_(Final_Download).pdf; Scion_Players_Guide__Saints__Monsters_(Final_Download).pdf (Sorcerer).`,
  },
  "welcome-tier-select": {
    example: "Mortal/Origin through God on Deity, Titanic through God on Titan, Sorcerer (Mortal band) through Sorcerer (God band) on the Sorcerer line. Hidden for Dragon (use Inheritance row).",
    source: `${cite("origin", "Character Creation", "94–106")}; TItans_Rising_(Final_Download).pdf; Scion_Dragon_(Final_Download).pdf; Scion_Players_Guide__Saints__Monsters_(Final_Download).pdf.`,
  },
  "welcome-dragon-inheritance-select": {
    example: "Inheritance 1 (Hatchling) through 10 (True Dragon / Apotheosis): where you are on the Heir curve (Scion: Dragon).",
    source: "Scion_Dragon_(Final_Download).pdf (Inheritance track, pp. 117–119).",
  },

  "tier-advance": {
    example: "After Review, bump the sheet to the next core tier (Mortal → Hero → Demigod → God) using the Visitation / Apotheosis steps in the cited chapter.",
    source: `${cite("hero", "Visitation (Origin to Hero)", "172")}; ${cite("demigod", "Apotheosis / Second Visitation", "16+")}; ${cite("god", "Apotheosis / Godhood", "")}.`,
  },

  "dragon-inheritance-advance": {
    example: "Between stories, move the Heir up one Inheritance dot (Hatchling → … → True Dragon). Apply milestone Knacks, Spells, Calling dots, etc. from Scion: Dragon — your Storyguide may gate jumps.",
    source: "Scion_Dragon_(Final_Download).pdf (Inheritance & Character Advancement, pp. 117–119).",
  },

  "f-char-name": {
    example: "The name the character goes by on the sheet (can differ from the player’s name in notes).",
    source: `${cite("origin", "Character Creation", "94–106")} (sheet identity; fill as you like for your table).`,
  },
  "f-concept": {
    example: "“Street-corner oracle who hears the subway sing”; “Mercenary to the Gods.”",
    source: cite("origin", "Step One: Concept", "94"),
  },
  "f-notes": {
    example: "Player name, chronicle name, art links, or table agreements.",
    source: `${cite("origin", "Character Creation", "94–106")} (sheet extras; no single required field).`,
  },
  "f-deed-short": {
    example: "“Drop my mixtape to wide acclaim”; something achievable soon in play.",
    source: cite("origin", "Deeds (short-term)", "94"),
  },
  "f-deed-long": {
    example: "“Learn the esoteric secrets of the Wudang Fist”—ties to a Path.",
    source: cite("origin", "Deeds (long-term)", "94"),
  },
  "f-deed-band": {
    example: "A goal the whole band pursues together; often decided in session one.",
    source: cite("origin", "Deeds (group / band)", "94"),
  },
  "f-sheet-description": {
    example: "Age, look, mannerisms, public story—whatever your table wants on the sheet’s Description block.",
    source: `${cite("origin", "Character Creation", "94–106")} (sheet appearance / details; freeform like the community four-pager).`,
  },
  "d-deed-name": {
    example: "“Seal the broken gate before the eclipse”; a punchy title for the Draconic deed line on the Heir sheet.",
    source:
      "Scion_Dragon_(Final_Download).pdf — Heir Deeds (p. 110) and Finishing / sheet notes (p. 112); compare Origin Deed procedure in Scion: Origin (Revised) pp. 94–95.",
  },

  "p-origin": {
    example: "“Globetrotting Army Brat”; “Daughter of Harlem”; formative backstory phrase.",
    source: cite("origin", "Step Two: Paths — Origin Path", "95–96"),
  },
  "p-role": {
    example: "“Trauma Surgeon with Life in His Hands”; “Martial Arts Master of Ceremonies.”",
    source: cite("origin", "Step Two: Paths — Role Path", "96"),
  },
  "p-soc": {
    example: "“Daughter of Oya Iyansan”; “Loki-Defying Vanaheim Refugee”; cult, pantheon, or group tie.",
    source: cite("origin", "Step Two: Paths — Society / Pantheon Path", "96–97"),
  },
  "p-flight-path": {
    example: "“Serpent-flight courier in the tri-city sprawl”; brood, Flight culture, or draconic society tie (Dragon p. 112).",
    source: "Scion_Dragon_(Final_Download).pdf — Paths / Flight Path (confirm wording at table).",
  },
  "p-dragon-flight": {
    example: "Wyrm, Serpent, etc. — sets signature Dragon Magic and which two Skills the Flight Path must include.",
    source: "Scion_Dragon_(Final_Download).pdf — Flights / broods (chargen).",
  },
  "p-pantheon": {
    example: "Òrìshà, Theoi, Æsir — sets your two automatic Society Path Skills. Divine vs Titan parent lists follow your Welcome line (Deity or Titan).",
    source: cite("origin", "Pantheon list (Character Creation)", "95"),
  },
  "p-deity": {
    example: "Odin — lists patron innate Purview ids from Appendix 2 (reference for Society Path + for Hero Visitation; Mortal chargen does not assign them as picks).",
    source: `${cite("origin", "Appendix 2: Pantheons (gods, Callings, Purviews)", "170–177")}; ${cite("hero", "Visitation / Purviews from your divine parent", "182+")}.`,
  },
  "p-mythos-deed": {
    example: "Fourth Deed tied to Mythos play (MotM) — distinct from Short-term, Long-term, and Band.",
    source: "Scion_Players_Guide__Saints__Monsters_(Final_Download).pdf — Masks of the Mythos / Deeds (confirm wording at table).",
  },
  "patron-purviews": {
    example: "Hero+: pick patron Purviews only from that parent’s list (slot count from tier data, default four); duplicate slots swap.",
    source: `${cite("origin", "Appendix 2 — patron Purviews per deity (reference)", "170–177")}; ${cite("hero", "Visitation / Purviews from your divine parent", "182+")}.`,
  },

  "path-rank-primary": {
    example: "Whichever Path is most central gets three dots in each of its Skills (before overlaps).",
    source: cite("origin", "Step Three: Skills — Path priority", "97"),
  },
  "path-rank-secondary": {
    example: "Second focus — two dots per listed Skill from this Path.",
    source: cite("origin", "Step Three: Skills — Path priority", "97"),
  },
  "path-rank-tertiary": {
    example: "Third focus — one dot per listed Skill from this Path (cumulative with other Paths).",
    source: cite("origin", "Step Three: Skills — Path priority", "97"),
  },
  "path-skills-origin": {
    example: "Pick exactly three Skills (e.g. Culture, Empathy, Subterfuge) tied to your Origin phrase.",
    source: cite("origin", "Path Skills (three per Path)", "96–97"),
  },
  "path-skills-role": {
    example: "Three Skills for your profession or role (e.g. Medicine, Science, Integrity).",
    source: cite("origin", "Path Skills — Role", "96–97"),
  },
  "path-skills-society": {
    example: "Both highlighted Asset Skills (e.g. Close Combat & Occult for Æsir) plus exactly one other Skill — three total.",
    source: cite("origin", "Society Path Skills (two pantheon Skills + one choice)", "97"),
  },
  "skill-dots": {
    example: "On the Skills step, totals come only from Path 3/2/1 math (read-only dots). At 3+ dots, add a free Specialty during chargen.",
    source: cite("origin", "Skills, Specialties", "59–60, 97"),
  },
  "skill-clear": {
    example: "Finishing step only: resets this Skill to its pre-finishing baseline (change Path picks on Skills to alter chargen totals).",
    source: cite("origin", "Step Three: Skills", "97"),
  },
  "skill-specialty": {
    example: "“Internal School Boxing” for Close Combat; “Rock the Mic” for Culture — narrow focus you can invoke for +1 Enhancement when it fits.",
    source: cite("origin", "Skills — Specialties (free at chargen for each Skill at 3+ dots)", "59–60, 97"),
  },

  "arena-rank-0": {
    example: "The Arena where the character is strongest — distribute 6 extra dots (beyond 1 each) among its three Attributes.",
    source: cite("origin", "Step Four: Attributes — Arena priority", "97–98"),
  },
  "arena-rank-1": {
    example: "Middle Arena — 4 extra dots split among its three Attributes.",
    source: cite("origin", "Step Four: Attributes — Arena priority", "97–98"),
  },
  "arena-rank-2": {
    example: "Lowest Arena — 2 extra dots split among its three Attributes.",
    source: cite("origin", "Step Four: Attributes — Arena priority", "97–98"),
  },
  "fav-approach": {
    example: "Force = direct power; Finesse = precision; Resilience = endurance — +2 dots (pre-cap) to each Attribute in that Approach.",
    source: cite("origin", "Step Four: Attributes — Favored Approach", "97–98"),
  },

  "attr-might": {
    example: "Lifting gates off hinges; holding a line in a brawl.",
    source: cite("origin", "Attributes — Physical Arena (Might / Force)", "63, 97–98"),
  },
  "attr-dexterity": {
    example: "Weaving strikes; parkour across rooftops.",
    source: cite("origin", "Attributes — Physical Arena (Dexterity / Finesse)", "63, 97–98"),
  },
  "attr-stamina": {
    example: "Going the distance; Injury track extras at high Stamina.",
    source: cite("origin", "Attributes — Physical Arena (Stamina / Resilience); Injury", "63, 97–99"),
  },
  "attr-intellect": {
    example: "Citing precedent; brute-forcing a puzzle with raw brainpower.",
    source: cite("origin", "Attributes — Mental Arena (Intellect / Force)", "63, 97–98"),
  },
  "attr-cunning": {
    example: "Bluffing inspectors; gambits that shouldn’t work but do.",
    source: cite("origin", "Attributes — Mental Arena (Cunning / Finesse)", "63, 97–98"),
  },
  "attr-resolve": {
    example: "Staring down a spirit; staying on mission after setbacks.",
    source: cite("origin", "Attributes — Mental Arena (Resolve / Resilience)", "63, 97–98"),
  },
  "attr-presence": {
    example: "Filling the room; command voice.",
    source: cite("origin", "Attributes — Social Arena (Presence / Force)", "63, 97–98"),
  },
  "attr-manipulation": {
    example: "Spin; whisper campaigns; forged paperwork.",
    source: cite("origin", "Attributes — Social Arena (Manipulation / Finesse)", "63, 97–98"),
  },
  "attr-composure": {
    example: "Keeping a straight face; social rope-a-dope.",
    source: cite("origin", "Attributes — Social Arena (Composure / Resilience)", "63, 97–98"),
  },

  "f-calling": {
    example: "Guardian, Sage, Trickster — one Calling. At Origin, Calling rating is fixed at 1 dot (shown next to the menu). At Hero+, use the five dots to set Calling rating (1–5).",
    source: cite("origin", "Step Five: Calling and Knacks", "98–99"),
  },
  "knack-select": {
    example:
      "Hero: each dot in a Calling buys Knacks for that Calling; you may never know more Knacks than your total Calling dots across all three Callings. This step uses one Calling rating row as the slot budget for the chip list (each Heroic Knack = one slot; at most one Immortal = two slots). Origin: one Mortal Knack only. Finishing “extra Knacks” do not spend Calling dots.",
    source: `${cite("origin", "Knacks at Origin", "98–99")}; ${cite("hero", "Heroic Knacks / higher-tier options", "201+")}.`,
  },
  "purview-select": {
    example: "At Hero: one innate Purview from the parent list (Paths or chips) plus the pantheon Signature Purview from pantheons.json; Demigod+ can add more Purviews (e.g. Relics).",
    source: `${cite("origin", "Appendix 2 (Purviews listed per deity — reference)", "170–177")}; ${cite("hero", "Purviews, Boons, Marvels", "200+")}.`,
  },
  "birthrights-step": {
    example: "Costs stack toward your tier cap: seven points at Hero (Birthrights step only; Finishing does not add a second pool), four at Mortal/Sorcerer Finishing, eleven for Demigod/God in this wizard.",
    source: `${cite("hero", "Birthrights (Character Generation)", "186+")}; ${cite("hero", "Finishing Touches — Knacks vs Birthrights", "201+")}; Pandora’s Box (Revised) Birthright chapters.`,
  },
  "boon-select": {
    example: "Boons appear only for Purviews you track: merged patron slots (Paths) plus sheet Purviews; Mythos also counts a draft Awareness Purview from the Purviews step when it matches your parent’s list (unless a different patron chip is selected). Innate summaries under a heading are reference only — the Boon chips here are the selectable catalog entries in this app.",
    source: `${cite("hero", "Purviews & Boons", "200+")}; ${cite("demigod", "Advanced Boons", "")}; ${cite("god", "God-tier Boons", "")}.`,
  },

  "fin-skill": {
    example: "Origin default five extra Skill dots to place anywhere (respect max 5 per Skill).",
    source: cite("origin", "Step Six: Finishing Touches", "99"),
  },
  "fin-attr": {
    example: "Origin default one extra Attribute dot (still respect post–Favored Approach cap 5 at chargen).",
    source: cite("origin", "Step Six: Finishing Touches", "99"),
  },
  "fin-focus": {
    example: "Either two extra Knacks or four Birthright points — Hero details Birthrights further.",
    source: `${cite("origin", "Finishing Touches (Knacks vs Birthrights)", "99")}; ${cite("hero", "Birthrights / chargen", "201+")}.`,
  },
};

/**
 * @param {HTMLElement | null} el
 * @param {string} key
 */
export function applyHint(el, key) {
  const h = HELP[key];
  if (!el || !h) return;
  el.title = docHint(h.example, h.source);
  el.classList.add("has-doc-hint");
}

/**
 * @param {HTMLElement | null} el
 * @param {string} example
 * @param {string} source
 */
export function applyHintDirect(el, example, source) {
  if (!el) return;
  el.title = docHint(example, source);
  el.classList.add("has-doc-hint");
}

/**
 * Tooltip from bundled game entities (skills, attributes, knacks, etc.):
 * name, description, optional mechanics line, source. Optional `prefix` (e.g. Asset Skill callout).
 * @param {HTMLElement | null} el
 * @param {{ name?: string; description?: string; mechanicalEffects?: string; source?: string } | null | undefined} entity
 * @param {{ prefix?: string } | undefined} [opts]
 */
export function applyGameDataHint(el, entity, opts) {
  if (!el || !entity) return;
  const prefix = opts?.prefix?.trim();
  const name = (entity.name || "").trim();
  const desc = (entity.description || "").trim();
  const mech = (entity.mechanicalEffects || "").trim();
  const src = (entity.source || "").trim();
  const chunks = [];
  if (prefix) chunks.push(prefix);
  if (name) chunks.push(name);
  if (desc) chunks.push(desc);
  if (mech) chunks.push(`Mechanics: ${mech}`);
  if (src) chunks.push(`Source: ${src}`);
  el.title = chunks.length ? chunks.join("\n\n") : "";
  if (el.title) el.classList.add("has-doc-hint");
}

/** Hover text for the free Specialty field at 3+ dots — tailored by skill id (matches `data/skills.json`). */
const SKILL_SPECIALTY_EXAMPLES = {
  academics: "e.g. “Classical Latin,” “Maritime law,” “Cold War espionage history” — a narrow topic where your Academics apply.",
  athletics: "e.g. “Parkour,” “Marathon distance,” “Olympic fencing footwork” for Athletics.",
  closeCombat: "e.g. “Internal school boxing,” “Messer fencing,” “Greco-Roman clinch” for Close Combat.",
  culture: "e.g. “Yoruba oral tradition,” “Berlin techno scene,” “High tea etiquette” for Culture.",
  empathy: "e.g. “Trauma-informed counseling,” “Poker tells,” “Reading cult recruits” for Empathy.",
  firearms: "e.g. “CQB room clearing,” “Long-range precision,” “Cowboy action reloads” for Firearms.",
  integrity: "e.g. “Vows to your divine parent,” “Resisting geasa,” “Whistleblower ethics” for Integrity.",
  leadership: "e.g. “Volunteer firehouse crews,” “Union strike lines,” “Startup all-hands” for Leadership.",
  medicine: "e.g. “Field surgery,” “Forensic toxicology,” “Sports medicine” for Medicine.",
  occult: "e.g. “New Orleans vodou,” “Solomonic seals,” “Urban cryptid lore” for Occult.",
  persuasion: "e.g. “High-stakes plea deals,” “Cult deprogramming,” “Car-lot haggling” for Persuasion.",
  pilot: "e.g. “Helicopter evasion,” “Coastal patrol boats,” “Vintage muscle cars” for Pilot.",
  science: "e.g. “Organic chemistry,” “Ballistics reconstruction,” “Volcanology fieldwork” for Science.",
  subterfuge: "e.g. “Forged travel documents,” “Shaking a tail,” “Social-engineering calls” for Subterfuge.",
  survival: "e.g. “Arctic travel,” “Urban feral living,” “Tracking in rainforest” for Survival.",
  technology: "e.g. “Zero-day research,” “Industrial SCADA,” “Vintage broadcast gear” for Technology.",
};

/**
 * @param {HTMLElement | null} labelEl
 * @param {HTMLElement | null} inputEl
 * @param {string} skillId
 */
export function applySkillSpecialtyHints(labelEl, inputEl, skillId) {
  const h = HELP["skill-specialty"];
  if (!h) return;
  const ex = SKILL_SPECIALTY_EXAMPLES[skillId] ?? h.example;
  applyHintDirect(labelEl, ex, h.source);
  applyHintDirect(inputEl, ex, h.source);
}
