/**
 * Standard Scion 2e skill list split (Origin `skills.json` order):
 * left Academics–Leadership, right Medicine–Technology.
 * Used for Skills + Finishing dot tables (not Path skill chip pickers).
 */
export const SKILL_TABLE_IDS_LEFT = Object.freeze([
  "academics",
  "athletics",
  "closeCombat",
  "culture",
  "empathy",
  "firearms",
  "integrity",
  "leadership",
]);

export const SKILL_TABLE_IDS_RIGHT = Object.freeze([
  "medicine",
  "occult",
  "persuasion",
  "pilot",
  "science",
  "subterfuge",
  "survival",
  "technology",
]);

/**
 * @param {Record<string, unknown> | undefined} bundle
 * @returns {{ left: string[]; right: string[] }}
 */
export function skillIdsSplitForSkillsTables(bundle) {
  const skills = bundle?.skills;
  const valid = new Set(
    Object.keys(skills && typeof skills === "object" ? skills : {}).filter((k) => !k.startsWith("_")),
  );
  const left = SKILL_TABLE_IDS_LEFT.filter((id) => valid.has(id));
  const rightListed = SKILL_TABLE_IDS_RIGHT.filter((id) => valid.has(id));
  const listed = new Set([...SKILL_TABLE_IDS_LEFT, ...SKILL_TABLE_IDS_RIGHT]);
  const orphan = [...valid].filter((id) => !listed.has(id)).sort();
  return { left, right: [...rightListed, ...orphan] };
}

/** Shared Skill | Dots header for skill rating tables. */
export function appendSkillRatingsTableThead(table) {
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  ["Skill", "Dots"].forEach((label, idx) => {
    const th = document.createElement("th");
    th.textContent = label;
    if (idx > 0) th.className = "skill-ratings-th-num";
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);
}
