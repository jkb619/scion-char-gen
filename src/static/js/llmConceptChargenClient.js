/**
 * POST /api/llm/character-from-concept — concept-driven chargen with Scion 2e collection RAG.
 */

/** @returns {Promise<{ configured: boolean; collectionConfigured?: boolean }>} */
export async function fetchLlmStatusExtended() {
  const res = await fetch("/api/llm/status", { headers: { Accept: "application/json" } });
  if (!res.ok) return { configured: false };
  return res.json();
}

/**
 * @param {{ conceptPrompt: string; welcomeTrack: string; mechanical: Record<string, unknown> }} body
 * @returns {Promise<{ character: Record<string, unknown>; override?: Record<string, unknown>; usedCollection?: boolean }>}
 */
export async function requestCharacterFromConcept(body) {
  const res = await fetch("/api/llm/character-from-concept", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.detail || res.statusText || "Concept chargen request failed";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  const data = await res.json();
  if (!data?.character || typeof data.character !== "object") {
    throw new Error("Server returned no character payload");
  }
  return data;
}
