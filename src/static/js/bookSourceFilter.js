/**
 * Book Source Filter panel for the Scion character creator.
 *
 * Renders a collapsible checkbox panel grouped by book category that lets
 * users toggle which sourcebooks are included in picker filtering.
 * Dispatches a `book-filter-changed` custom event on `document` when the
 * Allowed_Books_Set changes.
 */

/** Group display order and labels. */
const GROUP_CONFIG = [
  { key: "core", label: "Core" },
  { key: "core_plus", label: "Core+" },
  { key: "official", label: "Official Companions" },
  { key: "third_party", label: "3rd Party / Community" },
];

/** Fixed display order for Core books (by slug). Others sort alphabetically. */
const CORE_SORT_ORDER = ["scion_origin", "scion_hero", "scion_demigod", "scion_god"];

/**
 * Dispatch the book-filter-changed custom event on document.
 * @param {Set<string>} allowedBooks
 */
function dispatchFilterChanged(allowedBooks) {
  document.dispatchEvent(
    new CustomEvent("book-filter-changed", {
      detail: { allowedBooks },
    })
  );
}

/**
 * Create the Book Source Filter panel.
 *
 * @param {Array<{slug: string, title: string, group?: string}>} registry - source registry entries
 * @param {Set<string>} allowedBooks - mutable reference to character state
 * @param {(changedSlug: string, isNowAllowed: boolean) => void} onChange - callback per toggle
 * @param {((slug: string) => Promise<boolean>) | null} [onBeforeUncheck] - async interceptor called before unchecking; return false to cancel
 * @returns {HTMLElement} - the panel DOM element (a <details> element)
 */
export function createBookSourceFilterPanel(registry, allowedBooks, onChange, onBeforeUncheck) {
  const details = document.createElement("details");
  details.className = "book-source-filter";

  const summary = document.createElement("summary");
  summary.textContent = "Source Books";
  details.appendChild(summary);

  // Toolbar with Select All / Deselect All buttons
  const toolbar = document.createElement("div");
  toolbar.className = "book-source-filter-toolbar";

  const selectAllBtn = document.createElement("button");
  selectAllBtn.type = "button";
  selectAllBtn.textContent = "Select All";
  selectAllBtn.addEventListener("click", () => {
    selectAll(details, allowedBooks, onChange);
  });

  const deselectAllBtn = document.createElement("button");
  deselectAllBtn.type = "button";
  deselectAllBtn.textContent = "Deselect All";
  deselectAllBtn.addEventListener("click", () => {
    deselectAll(details, allowedBooks, onChange);
  });

  toolbar.appendChild(selectAllBtn);
  toolbar.appendChild(deselectAllBtn);
  details.appendChild(toolbar);

  // Group entries by their group key
  const grouped = new Map();
  for (const g of GROUP_CONFIG) {
    grouped.set(g.key, []);
  }
  for (const entry of registry) {
    const groupKey = entry.group || "third_party";
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, []);
    }
    grouped.get(groupKey).push(entry);
  }

  // Render each group as a fieldset
  for (const { key, label } of GROUP_CONFIG) {
    const entries = grouped.get(key);
    if (!entries || entries.length === 0) continue;

    // Sort: core group uses fixed order; others sort alphabetically
    if (key === "core") {
      entries.sort((a, b) => {
        const ai = CORE_SORT_ORDER.indexOf(a.slug);
        const bi = CORE_SORT_ORDER.indexOf(b.slug);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
    } else {
      entries.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }

    const fieldset = document.createElement("fieldset");
    fieldset.className = "book-source-filter-group";

    const legend = document.createElement("legend");
    legend.textContent = label;
    fieldset.appendChild(legend);

    for (const entry of entries) {
      const labelEl = document.createElement("label");
      labelEl.className = "book-source-filter-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = entry.slug;
      checkbox.checked = allowedBooks.has(entry.slug);

      checkbox.addEventListener("change", async () => {
        const isChecked = checkbox.checked;
        if (!isChecked && onBeforeUncheck) {
          // Temporarily re-check — don't modify allowedBooks until interceptor decides
          checkbox.checked = true;
          const proceed = await onBeforeUncheck(entry.slug);
          if (!proceed) return; // cancel — leave everything unchanged
          checkbox.checked = false; // confirmed — proceed with uncheck
        }
        if (isChecked) {
          allowedBooks.add(entry.slug);
        } else {
          allowedBooks.delete(entry.slug);
        }
        onChange(entry.slug, isChecked);
        dispatchFilterChanged(allowedBooks);
      });

      const span = document.createElement("span");
      span.textContent = entry.title;

      labelEl.appendChild(checkbox);
      labelEl.appendChild(span);
      fieldset.appendChild(labelEl);
    }

    details.appendChild(fieldset);
  }

  return details;
}

/**
 * Check all book checkboxes and add all slugs to the allowed set.
 * Only triggers onChange for books that were not already allowed.
 *
 * @param {HTMLElement} panel - the panel DOM element returned by createBookSourceFilterPanel
 * @param {Set<string>} allowedBooks - mutable reference to character state
 * @param {(changedSlug: string, isNowAllowed: boolean) => void} onChange
 */
export function selectAll(panel, allowedBooks, onChange) {
  const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
  for (const cb of checkboxes) {
    if (!cb.checked) {
      cb.checked = true;
      allowedBooks.add(cb.value);
      onChange(cb.value, true);
    }
  }
  dispatchFilterChanged(allowedBooks);
}

/**
 * Uncheck all book checkboxes and remove all slugs from the allowed set.
 * Only triggers onChange for books that were previously allowed.
 *
 * @param {HTMLElement} panel - the panel DOM element returned by createBookSourceFilterPanel
 * @param {Set<string>} allowedBooks - mutable reference to character state
 * @param {(changedSlug: string, isNowAllowed: boolean) => void} onChange
 */
export function deselectAll(panel, allowedBooks, onChange) {
  const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
  for (const cb of checkboxes) {
    if (cb.checked) {
      cb.checked = false;
      allowedBooks.delete(cb.value);
      onChange(cb.value, false);
    }
  }
  dispatchFilterChanged(allowedBooks);
}
