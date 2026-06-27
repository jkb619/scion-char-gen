/**
 * Progress meter for Welcome → Generate Character from Concept.
 */

/** @param {HTMLElement} container */
export function mountConceptGenProgress(container) {
  const panel = document.createElement("div");
  panel.className = "welcome-concept-progress welcome-chargen-progress-span";
  panel.hidden = true;

  const track = document.createElement("div");
  track.className = "welcome-concept-progress-track";
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-valuenow", "0");

  const fill = document.createElement("div");
  fill.className = "welcome-concept-progress-fill";
  track.appendChild(fill);

  const label = document.createElement("p");
  label.className = "welcome-concept-progress-label";

  panel.appendChild(track);
  panel.appendChild(label);
  container.appendChild(panel);

  /** @type {ReturnType<typeof setInterval> | null} */
  let creepTimer = null;
  let lastLabel = "";
  let lastPct = 0;

  const stopCreep = () => {
    if (creepTimer != null) {
      clearInterval(creepTimer);
      creepTimer = null;
    }
  };

  const set = (pct, text) => {
    const n = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    lastPct = n;
    lastLabel = String(text || "").trim();
    fill.style.width = `${n}%`;
    track.setAttribute("aria-valuenow", String(n));
    label.textContent = lastLabel || "";
    panel.classList.toggle("is-complete", n >= 100);
    panel.classList.toggle("is-error", false);
  };

  return {
    show() {
      panel.hidden = false;
      panel.classList.remove("is-complete", "is-error");
    },
    hide() {
      stopCreep();
      panel.hidden = true;
      panel.classList.remove("is-complete", "is-error");
      set(0, "");
    },
    set,
    /** Slowly advance while waiting on LLM (no streaming progress available). */
    startCreep(fromPct, toPct, durationMs = 90_000) {
      stopCreep();
      const from = Math.max(0, Math.min(100, fromPct));
      const to = Math.max(from, Math.min(100, toPct));
      const start = Date.now();
      creepTimer = setInterval(() => {
        const t = Math.min(1, (Date.now() - start) / durationMs);
        const n = Math.round(from + (to - from) * t);
        fill.style.width = `${n}%`;
        track.setAttribute("aria-valuenow", String(n));
        lastPct = n;
        if (t >= 1) stopCreep();
      }, 250);
    },
    stopCreep,
    complete(text = "Character ready.") {
      stopCreep();
      set(100, text);
      panel.classList.add("is-complete");
    },
    fail(text = "Generation failed.") {
      stopCreep();
      panel.classList.add("is-error");
      label.textContent = text;
    },
    get lastPct() {
      return lastPct;
    },
  };
}
