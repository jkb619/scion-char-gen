/**
 * Sorcerer-line random chargen: Mortal Finishing (S&M p. 87) and Heroic+ profile, Workings, Purviews, Paraphernalia, Boons.
 */

import { isEntryVisibleForBooks } from "./bookFilter.js";
import { boonEligible, boonPrimaryPurview, maxWizardBoonPicksForTier } from "./eligibility.js";
import { boonBudgetSnapshot } from "./boonBudget.js";
import { pick, shuffle } from "./randomChargenUtils.js";

const FINISHING_PACKAGES = ["four_paraphernalia", "two_techniques", "one_technique_two_paraphernalia"];

const MOTIF_TEMPLATES = [
  "Secrets traded for power",
  "Blood and candle smoke",
  "The price of knowing",
  "Borrowed fire, owned regret",
  "What the dead refuse to tell",
  "Salt circles and sharp bargains",
];

const PRIMARY_SOURCES = ["invocation", "patronage", "prohibition", "talisman"];

const INVOCATION_TEMPLATES = [
  "Whispered formulas that cost a drop of blood each casting.",
  "Names of power spoken only when the moon is waning.",
  "A litany memorized from a mentor who never wrote it down.",
];

const PATRONAGE_TEMPLATES = [
  "A distant spirit who answers when called by its true name.",
  "A Fatebinding to an ancestor who demands proof before aid.",
  "Patronage traded for service at the Storyguide’s discretion.",
];

const PROHIBITION_TEMPLATES = [
  "Cannot cast without removing iron from the body.",
  "Must refuse payment in coin for any working.",
  "Breaking silence during a rite imposes Sorcerous Prohibition until dawn.",
];

const TALISMAN_TEMPLATES = [
  "An inherited ring that holds one point of Legend in reserve.",
  "A bone needle that must pierce the caster’s skin to channel power.",
  "A reliquary charm bonded at Heroic tier (S&M p. 64).",
];

const HEROIC_TIER_IDS = new Set(["sorcerer_hero", "sorcerer_demigod", "sorcerer_god"]);

/** @param {string} tierId */
function sorcererWorkingPickCap(tierId) {
  const t = String(tierId || "").trim().toLowerCase();
  if (t === "sorcerer") return 1;
  if (t === "sorcerer_hero") return 2;
  if (t === "sorcerer_demigod") return 3;
  if (t === "sorcerer_god") return 4;
  return 1;
}

/** @param {string} tierId */
function birthrightBudgetForSorcererTier(tierId) {
  const t = String(tierId || "").trim().toLowerCase();
  if (t === "sorcerer_hero") return 7;
  if (t === "sorcerer_demigod" || t === "sorcerer_god") return 11;
  return 0;
}

/** @param {Record<string, unknown>} bundle @param {string} bid */
function birthrightPointCost(bundle, bid) {
  const br = bundle.birthrights?.[bid];
  const c = Math.round(Number(br?.pointCost ?? br?.dots ?? 1));
  return Number.isFinite(c) && c > 0 ? Math.min(5, c) : 1;
}

/** @param {Record<string, unknown>} bundle */
function birthrightPickPool(bundle) {
  return Object.keys(bundle?.birthrights || {}).filter((id) => {
    if (id.startsWith("_")) return false;
    return bundle.birthrights[id] && typeof bundle.birthrights[id] === "object";
  });
}

/**
 * @param {Record<string, unknown>} bundle
 * @param {number} target
 * @param {() => number} rng
 * @returns {string[]}
 */
function pickBirthrightIdsForPointBudget(bundle, target, rng) {
  if (target <= 0) return [];
  const pool = birthrightPickPool(bundle);
  for (let attempt = 0; attempt < 200; attempt += 1) {
    /** @type {string[]} */
    const picks = [];
    let spent = 0;
    for (const bid of shuffle([...pool], rng)) {
      const cost = birthrightPointCost(bundle, bid);
      if (spent + cost > target) continue;
      picks.push(bid);
      spent += cost;
      if (spent === target) return picks;
    }
  }
  const twos = pool.filter((id) => birthrightPointCost(bundle, id) === 2);
  const ones = pool.filter((id) => birthrightPointCost(bundle, id) === 1);
  /** @type {string[]} */
  let picks = [];
  let spent = 0;
  for (const bid of shuffle(twos, rng)) {
    if (spent + 2 > target) continue;
    picks.push(bid);
    spent += 2;
  }
  for (const bid of shuffle(ones, rng)) {
    if (spent + 1 > target) continue;
    picks.push(bid);
    spent += 1;
  }
  if (spent === target) return picks;
  if (target === 4 && twos.length >= 2) return shuffle(twos, rng).slice(0, 2);
  if (target === 2 && twos.length) return [twos[0]];
  if (ones.length >= target) return shuffle(ones, rng).slice(0, target);
  return pool.length ? [pool[0]] : [];
}

/** @param {Record<string, unknown>} bundle */
function sorcererWorkingsCatalog(bundle) {
  const rows = bundle?.saintsMonsters?.sorcererWorkingsCatalog;
  return Array.isArray(rows) ? rows.filter((r) => r && typeof r === "object" && r.id) : [];
}

/** @param {Record<string, unknown>} bundle */
function sorcererTechniquesTable(bundle) {
  const t = bundle?.saintsMonsters?.sorcererTechniquesByWorking;
  return t && typeof t === "object" ? t : null;
}

/**
 * @param {Record<string, unknown>} bundle
 * @param {string} workingId
 * @returns {{ inherent: { id?: string; name?: string } | null; additional: { id?: string; name?: string }[] }}
 */
function techniquesForWorking(bundle, workingId) {
  const tbl = sorcererTechniquesTable(bundle);
  const def = tbl?.[workingId];
  if (!def || typeof def !== "object") return { inherent: null, additional: [] };
  const inherent = def.inherent && typeof def.inherent === "object" ? def.inherent : null;
  const additional = Array.isArray(def.additional) ? def.additional.filter((x) => x && x.id) : [];
  return { inherent, additional };
}

/** @param {Record<string, unknown>} bundle */
function sorcererOptionalPurviewPool(bundle) {
  const sigIds = new Set();
  for (const [k, v] of Object.entries(bundle?.pantheons || {})) {
    if (k.startsWith("_") || !v || typeof v !== "object") continue;
    const id = String(v.signaturePurviewId || "").trim();
    if (id) sigIds.add(id);
  }
  return Object.keys(bundle?.purviews || {}).filter((pid) => {
    if (pid.startsWith("_") || pid === "magic") return false;
    const row = bundle.purviews[pid];
    if (!row || typeof row !== "object") return false;
    if (row.denizenPurview === true) return false;
    if (row.denizenOrSorcery === true) return false;
    if (sigIds.has(pid)) return false;
    return true;
  });
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle */
function eligibleBoonPool(character, bundle) {
  const books =
    character.allowedBooks && Array.isArray(character.allowedBooks)
      ? new Set(character.allowedBooks.map(String))
      : new Set();
  return Object.values(bundle?.boons || {}).filter(
    (b) => b && typeof b === "object" && boonEligible(b, character, bundle) && isEntryVisibleForBooks(b, books),
  );
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle @param {() => number} rng */
function assignChargenSpecialties(character, bundle, rng) {
  void rng;
  if (!character.skillSpecialties || typeof character.skillSpecialties !== "object") character.skillSpecialties = {};
  for (const sid of Object.keys(bundle?.skills || {}).filter((k) => !k.startsWith("_"))) {
    const dots = character.skillDots?.[sid] || 0;
    if (dots >= 3 && !String(character.skillSpecialties[sid] || "").trim()) {
      const name = bundle.skills?.[sid]?.name || sid;
      character.skillSpecialties[sid] = `${name} focus`;
    }
  }
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle @param {() => number} rng */
function buildSorcererTechniquesNotes(character, bundle, rng) {
  void rng;
  const sp = character.sorceryProfile;
  if (!sp || typeof sp !== "object") return;
  const lines = [];
  const catalog = sorcererWorkingsCatalog(bundle);
  const byId = new Map(catalog.map((r) => [String(r.id), r]));
  for (const wid of sp.workingIds || []) {
    const wname = byId.get(String(wid))?.name || wid;
    const { inherent } = techniquesForWorking(bundle, String(wid));
    if (inherent?.name) lines.push(`Working ${wname}: inherent ${inherent.name}.`);
    else lines.push(`Working ${wname}.`);
  }
  for (const tid of sp.additionalTechniqueIds || []) {
    for (const wid of sp.workingIds || []) {
      const { additional } = techniquesForWorking(bundle, String(wid));
      const row = additional.find((x) => x.id === tid);
      if (row?.name) {
        lines.push(`Technique: ${row.name} (${byId.get(String(wid))?.name || wid}).`);
        break;
      }
    }
  }
  for (const bid of character.finishing?.birthrightPicks || []) {
    const br = bundle.birthrights?.[bid];
    if (br?.name) {
      const cost = birthrightPointCost(bundle, bid);
      lines.push(`Paraphernalia: ${br.name} (${cost} dot${cost === 1 ? "" : "s"}).`);
    }
  }
  if (lines.length) sp.techniquesNotes = lines.join("\n");
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle @param {() => number} rng */
function fillHeroicSorceryProfileFields(character, bundle, rng) {
  const sp = character.sorceryProfile;
  if (!sp || typeof sp !== "object") return;
  const catalog = sorcererWorkingsCatalog(bundle);
  const wname = catalog.find((r) => r.id === sp.workingIds?.[0])?.name || sp.workingIds?.[0] || "sorcery";

  if (!String(sp.motif || "").trim()) {
    sp.motif = `${pick(MOTIF_TEMPLATES, rng) || "Hidden power"} — ${wname} path`;
  }

  let primary = String(sp.primaryPowerSource || "").trim();
  if (!PRIMARY_SOURCES.includes(primary)) primary = pick(PRIMARY_SOURCES, rng) || "invocation";
  sp.primaryPowerSource = primary;

  if (!String(sp.invocation || "").trim() && (primary === "invocation" || !String(sp.patronage || "").trim())) {
    sp.invocation = pick(INVOCATION_TEMPLATES, rng) || "";
  }
  if (!String(sp.patronage || "").trim() && primary === "patronage") {
    sp.patronage = pick(PATRONAGE_TEMPLATES, rng) || "";
  }
  if (!String(sp.prohibition || "").trim() && primary === "prohibition") {
    sp.prohibition = pick(PROHIBITION_TEMPLATES, rng) || "";
  }
  if (!String(sp.talisman || "").trim()) {
    sp.talisman = pick(TALISMAN_TEMPLATES, rng) || "";
  }
  if (!String(sp.powerSource || "").trim()) {
    sp.powerSource = `Primary source: ${primary}. Workings and Techniques per Saints & Monsters ch. 3.`;
  }
}

/**
 * @param {Record<string, unknown>} character
 * @param {Record<string, unknown>} bundle
 * @param {() => number} rng
 */
function assignSorcererWorkingsAndTechniques(character, bundle, rng) {
  const tier = String(character.tier || "").trim().toLowerCase();
  const cap = sorcererWorkingPickCap(tier);
  const catalog = sorcererWorkingsCatalog(bundle);
  const sp = character.sorceryProfile;
  if (!sp || typeof sp !== "object") return;

  let wids = (sp.workingIds || []).map((x) => String(x).trim()).filter(Boolean);
  if (wids.length < cap) {
    const need = cap - wids.length;
    const pool = shuffle(
      catalog.map((r) => String(r.id)).filter((id) => !wids.includes(id)),
      rng,
    );
    wids = [...wids, ...pool.slice(0, need)];
  }
  sp.workingIds = wids.slice(0, cap);

  /** @type {string[]} */
  const techIds = [];
  for (const wid of sp.workingIds) {
    const { additional } = techniquesForWorking(bundle, String(wid));
    const pickRow = pick(shuffle(additional, rng), rng);
    if (pickRow?.id) techIds.push(String(pickRow.id));
  }
  sp.additionalTechniqueIds = techIds;
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle @param {() => number} rng */
function assignSorcererPurviews(character, bundle, rng) {
  const tier = String(character.tier || "").trim().toLowerCase();
  /** @type {string[]} */
  let ids = ["magic"];
  if (tier === "sorcerer_hero") {
    character.purviewIds = ids;
    return;
  }
  if (tier === "sorcerer_demigod" || tier === "sorcerer_god") {
    const trial = { ...character, purviewIds: [...ids] };
    if (!eligibleBoonPool(trial, bundle).length) {
      for (const pid of shuffle(sorcererOptionalPurviewPool(bundle), rng)) {
        trial.purviewIds = [...ids, pid];
        if (eligibleBoonPool(trial, bundle).length) {
          ids = trial.purviewIds;
          break;
        }
      }
    }
    character.purviewIds = [...new Set(ids)];
    return;
  }
  character.purviewIds = ids;
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle @param {() => number} rng */
function assignSorcererBirthrights(character, bundle, rng) {
  const budget = birthrightBudgetForSorcererTier(character.tier);
  if (budget <= 0) return;
  if (!character.finishing || typeof character.finishing !== "object") {
    character.finishing = { birthrightPicks: [] };
  }
  if (!Array.isArray(character.finishing.birthrightPicks)) character.finishing.birthrightPicks = [];
  character.finishing.knackOrBirthright = "birthrights";
  character.finishing.birthrightPicks = pickBirthrightIdsForPointBudget(bundle, budget, rng);
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle @param {() => number} rng */
function assignSorcererLegendBoons(character, bundle, rng) {
  const pool = eligibleBoonPool(character, bundle);
  if (!pool.length) return;

  const magicFirst = [...pool].sort((a, b) => {
    const am = boonPrimaryPurview(a) === "magic" ? 0 : 1;
    const bm = boonPrimaryPurview(b) === "magic" ? 0 : 1;
    if (am !== bm) return am - bm;
    return 0;
  });
  const shuffled = shuffle(magicFirst, rng);

  /** @type {string[]} */
  const picks = [];
  for (const b of shuffled) {
    const bid = String(b.id || "").trim();
    if (!bid || picks.includes(bid)) continue;
    picks.push(bid);
    const snap = boonBudgetSnapshot({ ...character, boonIds: picks }, bundle);
    if (snap.usesLegendBudget && snap.legendRemaining != null && snap.legendRemaining <= 0) break;
    const heroCap = maxWizardBoonPicksForTier(character.tier, bundle);
    if (Number.isFinite(heroCap) && picks.length >= heroCap) break;
  }
  if (picks.length) character.boonIds = picks;
}

/**
 * @param {Record<string, unknown>} character
 * @param {Record<string, unknown>} bundle
 * @param {() => number} rng
 */
export function assignSorcererMortalChargen(character, bundle, rng) {
  if (String(character.tier || "").trim().toLowerCase() !== "sorcerer") return;

  if (!character.finishing || typeof character.finishing !== "object") {
    character.finishing = { extraSkillDots: 5, extraAttributeDots: 1, birthrightPicks: [] };
  }
  character.finishing.extraSkillDots = Math.max(0, Math.round(Number(character.finishing.extraSkillDots) || 5));
  character.finishing.extraAttributeDots = Math.max(0, Math.round(Number(character.finishing.extraAttributeDots) || 1));

  if (!character.sorceryProfile || typeof character.sorceryProfile !== "object") {
    character.sorceryProfile = {
      motif: "",
      workingIds: [],
      additionalTechniqueIds: [],
      techniquesNotes: "",
      notes: "",
    };
  }
  const sp = character.sorceryProfile;

  const catalog = sorcererWorkingsCatalog(bundle);
  if (!Array.isArray(sp.workingIds) || !sp.workingIds.filter(Boolean).length) {
    const row = pick(catalog, rng);
    sp.workingIds = row?.id ? [String(row.id)] : ["divining"];
  } else {
    sp.workingIds = sp.workingIds.slice(0, 1).map((x) => String(x).trim()).filter(Boolean);
  }
  const workingId = sp.workingIds[0] || "divining";

  let pkg = String(character.finishing.sorcererMortalFinishingPackage || "").trim();
  if (!FINISHING_PACKAGES.includes(pkg)) {
    pkg = pick(FINISHING_PACKAGES, rng) || "four_paraphernalia";
  }
  character.finishing.sorcererMortalFinishingPackage = pkg;

  if (!Array.isArray(sp.additionalTechniqueIds)) sp.additionalTechniqueIds = [];
  if (!Array.isArray(character.finishing.birthrightPicks)) character.finishing.birthrightPicks = [];

  const { additional } = techniquesForWorking(bundle, workingId);
  const techPool = shuffle([...additional], rng);

  if (pkg === "two_techniques") {
    character.finishing.knackOrBirthright = "knacks";
    character.finishing.birthrightPicks = [];
    sp.additionalTechniqueIds = techPool.slice(0, 2).map((x) => String(x.id));
  } else if (pkg === "one_technique_two_paraphernalia") {
    character.finishing.knackOrBirthright = "birthrights";
    character.finishing.birthrightPicks = pickBirthrightIdsForPointBudget(bundle, 2, rng);
    sp.additionalTechniqueIds = techPool[0]?.id ? [String(techPool[0].id)] : [];
  } else {
    character.finishing.knackOrBirthright = "birthrights";
    character.finishing.birthrightPicks = pickBirthrightIdsForPointBudget(bundle, 4, rng);
    sp.additionalTechniqueIds = [];
  }

  if (!String(sp.motif || "").trim()) {
    const wname = catalog.find((r) => r.id === workingId)?.name || workingId;
    sp.motif = `${pick(MOTIF_TEMPLATES, rng) || "Hidden power"} — ${wname} path`;
  }

  buildSorcererTechniquesNotes(character, bundle, rng);
  assignChargenSpecialties(character, bundle, rng);
}

/**
 * Heroic / Divine band Sorcerer: Workings, Sources of Power, Magic Purview, Paraphernalia, Legend Boons.
 * @param {Record<string, unknown>} character
 * @param {Record<string, unknown>} bundle
 * @param {() => number} rng
 */
export function assignSorcererHeroicChargen(character, bundle, rng) {
  const tier = String(character.tier || "").trim().toLowerCase();
  if (!HEROIC_TIER_IDS.has(tier)) return;

  if (!character.sorceryProfile || typeof character.sorceryProfile !== "object") {
    character.sorceryProfile = {
      motif: "",
      primaryPowerSource: "",
      invocation: "",
      patronage: "",
      prohibition: "",
      talisman: "",
      workingIds: [],
      additionalTechniqueIds: [],
      techniquesNotes: "",
      notes: "",
    };
  }
  if (!Array.isArray(character.boonIds)) character.boonIds = [];
  if (!Array.isArray(character.purviewIds)) character.purviewIds = [];

  assignSorcererWorkingsAndTechniques(character, bundle, rng);
  fillHeroicSorceryProfileFields(character, bundle, rng);
  buildSorcererTechniquesNotes(character, bundle, rng);
  assignSorcererPurviews(character, bundle, rng);
  assignSorcererBirthrights(character, bundle, rng);
  assignSorcererLegendBoons(character, bundle, rng);
  assignChargenSpecialties(character, bundle, rng);
}

/**
 * All Sorcerer-line tiers (Mortal through God band).
 * @param {Record<string, unknown>} character
 * @param {Record<string, unknown>} bundle
 * @param {() => number} rng
 */
export function assignSorcererChargen(character, bundle, rng) {
  const tier = String(character.tier || "").trim().toLowerCase();
  if (tier === "sorcerer") assignSorcererMortalChargen(character, bundle, rng);
  else if (HEROIC_TIER_IDS.has(tier)) assignSorcererHeroicChargen(character, bundle, rng);
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle */
export function sorcererMortalChargenComplete(character, bundle) {
  if (String(character.tier || "").trim().toLowerCase() !== "sorcerer") return true;
  const fin = character.finishing;
  const sp = character.sorceryProfile;
  if (!fin || !sp) return false;
  if (!(sp.workingIds || []).filter(Boolean).length) return false;
  const pkg = String(fin.sorcererMortalFinishingPackage || "four_paraphernalia").trim();
  const used = (fin.birthrightPicks || []).reduce((s, id) => s + birthrightPointCost(bundle, id), 0);
  const addN = (sp.additionalTechniqueIds || []).filter(Boolean).length;
  if (pkg === "two_techniques") return addN === 2 && used === 0;
  if (pkg === "four_paraphernalia") return used === 4 && addN === 0;
  if (pkg === "one_technique_two_paraphernalia") return used === 2 && addN === 1;
  return false;
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle */
export function sorcererHeroicChargenComplete(character, bundle) {
  const tier = String(character.tier || "").trim().toLowerCase();
  if (!HEROIC_TIER_IDS.has(tier)) return true;
  const sp = character.sorceryProfile;
  if (!sp) return false;
  const cap = sorcererWorkingPickCap(tier);
  const wN = (sp.workingIds || []).filter(Boolean).length;
  const tN = (sp.additionalTechniqueIds || []).filter(Boolean).length;
  if (wN < cap || tN < cap) return false;
  if (!String(sp.motif || "").trim()) return false;
  if (!String(sp.primaryPowerSource || "").trim()) return false;
  if (!(character.purviewIds || []).includes("magic")) return false;
  const brBudget = birthrightBudgetForSorcererTier(tier);
  const brUsed = (character.finishing?.birthrightPicks || []).reduce((s, id) => s + birthrightPointCost(bundle, id), 0);
  if (brBudget > 0 && brUsed !== brBudget) return false;
  return true;
}
