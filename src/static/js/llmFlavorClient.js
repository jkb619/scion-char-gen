/**
 * Client helpers for POST /api/llm/character-flavor.
 * Per field: empty → generate; any text → enhance (keep keywords / intent).
 */

/** @typedef {"generate" | "enhance" | "skip"} FlavorFieldMode */

/** @param {unknown} text */
export function flavorFieldMode(text) {
  return String(text ?? "").trim() ? "enhance" : "generate";
}

/** @returns {Promise<{ configured: boolean; providers: string[] }>} */
export async function fetchLlmStatus() {
  const res = await fetch("/api/llm/status", { headers: { Accept: "application/json" } });
  if (!res.ok) return { configured: false, providers: [] };
  return res.json();
}

/**
 * @param {Record<string, unknown>} summary
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function requestCharacterFlavor(summary) {
  const res = await fetch("/api/llm/character-flavor", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(summary),
  });
  if (res.status === 503) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.detail || res.statusText || "LLM request failed";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  const data = await res.json();
  return data?.flavor && typeof data.flavor === "object" ? data.flavor : null;
}

/**
 * @param {Record<string, unknown>} character
 * @param {Record<string, unknown>} bundle
 */
export function isDragonHeirCharacter(character) {
  const x = String(character?.chargenLineage ?? "").trim().toLowerCase();
  return x === "dragonheir" || x === "dragon_heir";
}

/**
 * @param {Record<string, unknown>} character
 * @param {Record<string, unknown>} bundle
 */
export function buildCharacterFlavorSummary(character, bundle) {
  const dragon = isDragonHeirCharacter(character);
  const d = dragon && character.dragon && typeof character.dragon === "object" ? character.dragon : null;

  const callings = [];
  const slots = dragon ? d?.callingSlots : character.callingSlots;
  if (Array.isArray(slots)) {
    for (const s of slots) {
      const id = String(s?.id || "").trim();
      if (id) callings.push(bundle.callings?.[id]?.name || id);
    }
  } else if (character.callingId) {
    callings.push(bundle.callings?.[character.callingId]?.name || character.callingId);
  }

  const skills = [];
  const skillSource = dragon ? d?.skillDots : character.skillDots;
  const specSource = dragon ? d?.skillSpecialties : character.skillSpecialties;
  for (const [sid, dots] of Object.entries(skillSource || {})) {
    const n = Math.round(Number(dots) || 0);
    if (n <= 0) continue;
    skills.push({
      id: sid,
      name: bundle.skills?.[sid]?.name || sid,
      dots: n,
      specialty: specSource?.[sid] || "",
    });
  }
  skills.sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const pantheon = bundle.pantheons?.[character.pantheonId];
  const kind = character.patronKind === "titan" ? "titans" : "deities";
  const patrons = Array.isArray(pantheon?.[kind]) ? pantheon[kind] : [];
  const parentRow = patrons.find((row) => row && row.id === character.parentDeityId);

  const pathDraft = dragon
    ? {
        origin: String(d?.paths?.origin ?? character.paths?.origin ?? ""),
        role: String(d?.paths?.role ?? character.paths?.role ?? ""),
        flight: String(d?.paths?.flight ?? character.paths?.society ?? ""),
      }
    : {
        origin: String(character.paths?.origin ?? ""),
        role: String(character.paths?.role ?? ""),
        society: String(character.paths?.society ?? ""),
      };

  const deeds = character.deeds && typeof character.deeds === "object" ? character.deeds : {};
  const specialtyModes = {};
  for (const row of skills) {
    if ((row.dots || 0) >= 3) specialtyModes[row.id] = flavorFieldMode(row.specialty);
  }

  const fieldModes = {
    characterName: flavorFieldMode(character.characterName),
    concept: flavorFieldMode(character.concept),
    notes: flavorFieldMode(character.notes),
    sheetDescription: flavorFieldMode(character.sheetDescription),
    deeds: {
      short: flavorFieldMode(deeds.short),
      long: flavorFieldMode(deeds.long),
      band: flavorFieldMode(deeds.band),
      ...(deeds.mythos != null ? { mythos: flavorFieldMode(deeds.mythos) } : {}),
    },
    paths: dragon
      ? {
          origin: flavorFieldMode(pathDraft.origin),
          role: flavorFieldMode(pathDraft.role),
          flight: flavorFieldMode(pathDraft.flight),
        }
      : {
          origin: flavorFieldMode(pathDraft.origin),
          role: flavorFieldMode(pathDraft.role),
          society: flavorFieldMode(pathDraft.society),
        },
    skillSpecialties: specialtyModes,
  };

  let tierLabel = bundle.tier?.[character.tier]?.name || character.tier;
  let flightName = "";
  let inheritance = null;
  if (dragon && d) {
    inheritance = Math.round(Number(d.inheritance) || 1);
    const inhRow = bundle.dragonTier?.inheritanceTrack?.[String(inheritance)];
    tierLabel = inhRow?.name ? `Dragon Heir — ${inhRow.name}` : `Dragon Heir (Inheritance ${inheritance})`;
    const fid = String(d.flightId || "").trim();
    flightName = bundle.dragonFlights?.[fid]?.name || fid;
  }

  return {
    lineage: dragon ? "dragonHeir" : "scion",
    tier: tierLabel,
    inheritance,
    flight: flightName,
    pantheon: pantheon?.name || character.pantheonId || "",
    parent: parentRow?.name || character.parentDeityId || "",
    callings,
    characterName: String(character.characterName || ""),
    concept: String(character.concept || ""),
    notes: String(character.notes || ""),
    sheetDescription: String(character.sheetDescription || ""),
    deeds: {
      short: String(deeds.short || ""),
      long: String(deeds.long || ""),
      band: String(deeds.band || ""),
      mythos: String(deeds.mythos || ""),
    },
    paths: pathDraft,
    skills,
    fieldModes,
  };
}

/** @typedef {"concept" | "paths" | "specialties" | "all"} FlavorScope */

/**
 * @param {Record<string, unknown>} summary
 * @param {FlavorScope} scope
 */
export function scopeFlavorSummary(summary, scope) {
  if (!scope || scope === "all") return summary;
  const fm = summary.fieldModes && typeof summary.fieldModes === "object" ? summary.fieldModes : {};
  /** @param {Record<string, string>} obj */
  const allSkip = (obj) => {
    const out = {};
    for (const k of Object.keys(obj || {})) out[k] = "skip";
    return out;
  };
  /** @type {Record<string, unknown>} */
  const next = { ...fm };
  if (scope === "concept") {
    next.paths = allSkip(/** @type {Record<string, string>} */ (fm.paths));
    next.skillSpecialties = allSkip(/** @type {Record<string, string>} */ (fm.skillSpecialties));
    for (const key of ["characterName", "concept", "notes", "sheetDescription"]) {
      if (next[key] !== "skip") next[key] = flavorFieldMode(summary[key]);
    }
    const deedDraft = summary.deeds && typeof summary.deeds === "object" ? summary.deeds : {};
    const deedModes = fm.deeds && typeof fm.deeds === "object" ? { ...fm.deeds } : {};
    for (const key of ["short", "long", "band", "mythos"]) {
      if (Object.prototype.hasOwnProperty.call(deedDraft, key)) {
        deedModes[key] = flavorFieldMode(deedDraft[key]);
      }
    }
    next.deeds = deedModes;
  } else if (scope === "paths") {
    next.characterName = "skip";
    next.concept = "skip";
    next.notes = "skip";
    next.sheetDescription = "skip";
    next.deeds = allSkip(/** @type {Record<string, string>} */ (fm.deeds));
    next.skillSpecialties = allSkip(/** @type {Record<string, string>} */ (fm.skillSpecialties));
  } else if (scope === "specialties") {
    next.characterName = "skip";
    next.concept = "skip";
    next.notes = "skip";
    next.sheetDescription = "skip";
    next.deeds = allSkip(/** @type {Record<string, string>} */ (fm.deeds));
    next.paths = allSkip(/** @type {Record<string, string>} */ (fm.paths));
  }
  return { ...summary, fieldModes: next };
}

function summaryHasFlavorWork(summary) {
  const fm = summary.fieldModes;
  if (!fm || typeof fm !== "object") return false;
  const modes = [
    fm.characterName,
    fm.concept,
    fm.notes,
    fm.sheetDescription,
    ...Object.values(fm.deeds && typeof fm.deeds === "object" ? fm.deeds : {}),
    ...Object.values(fm.paths && typeof fm.paths === "object" ? fm.paths : {}),
    ...Object.values(fm.skillSpecialties && typeof fm.skillSpecialties === "object" ? fm.skillSpecialties : {}),
  ];
  return modes.some((m) => m === "generate" || m === "enhance");
}

/**
 * @param {Record<string, unknown>} character
 * @param {Record<string, unknown>} flavor
 * @param {Record<string, unknown>} [fieldModes]
 */
export function applyCharacterFlavor(character, flavor, fieldModes) {
  if (!character || !flavor || typeof flavor !== "object") return;
  const dragon = isDragonHeirCharacter(character);
  const d = dragon && character.dragon && typeof character.dragon === "object" ? character.dragon : null;
  const modes = fieldModes && typeof fieldModes === "object" ? fieldModes : null;

  const shouldApply = (mode) => !modes || mode !== "skip";

  if (shouldApply(modes?.characterName) && typeof flavor.characterName === "string" && flavor.characterName.trim()) {
    character.characterName = flavor.characterName.trim();
  }
  if (shouldApply(modes?.concept) && typeof flavor.concept === "string" && flavor.concept.trim()) {
    character.concept = flavor.concept.trim();
  }
  if (shouldApply(modes?.notes) && typeof flavor.notes === "string" && flavor.notes.trim()) {
    character.notes = flavor.notes.trim();
  }
  if (
    shouldApply(modes?.sheetDescription) &&
    typeof flavor.sheetDescription === "string" &&
    flavor.sheetDescription.trim()
  ) {
    character.sheetDescription = flavor.sheetDescription.trim();
  }

  if (flavor.deeds && typeof flavor.deeds === "object") {
    if (!character.deeds || typeof character.deeds !== "object") character.deeds = {};
    for (const key of ["short", "long", "band", "mythos"]) {
      if (!shouldApply(modes?.deeds?.[key])) continue;
      const v = flavor.deeds[key];
      if (typeof v === "string" && v.trim()) character.deeds[key] = v.trim();
    }
  }

  if (flavor.paths && typeof flavor.paths === "object") {
    if (!character.paths || typeof character.paths !== "object") character.paths = {};
    if (dragon && d) {
      if (!d.paths || typeof d.paths !== "object") d.paths = { origin: "", role: "", flight: "" };
      for (const key of ["origin", "role", "flight"]) {
        if (!shouldApply(modes?.paths?.[key])) continue;
        const v = flavor.paths[key];
        if (typeof v === "string" && v.trim()) {
          d.paths[key] = v.trim();
          if (key === "flight") character.paths.society = v.trim();
          else character.paths[key] = v.trim();
        }
      }
    } else {
      for (const key of ["origin", "role", "society"]) {
        if (!shouldApply(modes?.paths?.[key])) continue;
        const v = flavor.paths[key];
        if (typeof v === "string" && v.trim()) character.paths[key] = v.trim();
      }
    }
  }

  if (flavor.skillSpecialties && typeof flavor.skillSpecialties === "object") {
    const targetSpecs = dragon && d ? d : character;
    if (!targetSpecs.skillSpecialties || typeof targetSpecs.skillSpecialties !== "object") {
      targetSpecs.skillSpecialties = {};
    }
    const dotsMap = dragon && d ? d.skillDots : character.skillDots;
    for (const [sid, text] of Object.entries(flavor.skillSpecialties)) {
      if (!shouldApply(modes?.skillSpecialties?.[sid])) continue;
      if (typeof text === "string" && text.trim() && (dotsMap?.[sid] || 0) >= 3) {
        targetSpecs.skillSpecialties[sid] = text.trim();
      }
    }
  }
}

/**
 * Run AI flavor: empty fields generated fresh; fields with text enhanced in place.
 * @param {Record<string, unknown>} character
 * @param {Record<string, unknown>} bundle
 * @param {{ scope?: FlavorScope }} [options]
 * @returns {Promise<boolean>} true when LLM ran successfully
 */
export async function runAutoCharacterFlavor(character, bundle, options = {}) {
  const status = await fetchLlmStatus();
  if (!status.configured) return false;
  const scope = options.scope || "all";
  let summary = buildCharacterFlavorSummary(character, bundle);
  summary = scopeFlavorSummary(summary, scope);
  if (!summaryHasFlavorWork(summary)) return false;

  const flavor = await requestCharacterFlavor(summary);
  if (!flavor) return false;
  applyCharacterFlavor(character, flavor, summary.fieldModes);
  return true;
}
