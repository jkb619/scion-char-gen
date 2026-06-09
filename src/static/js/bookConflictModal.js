/**
 * Conflict warning modal for the Book Source Filter feature.
 *
 * Displays a modal listing affected character selections when a book
 * is being removed, grouped by type. Returns a Promise that resolves
 * to `true` (user confirms removal) or `false` (user cancels).
 */

/**
 * Show a conflict warning modal and return the user's decision.
 *
 * The modal lists all affected selections grouped by type, formatted as
 * "Type: Name — Book Title". It blocks wizard interaction via a
 * full-screen overlay until the user confirms or cancels.
 *
 * @param {Array<{type: string, name: string, id: string, bookTitle: string}>} conflicts
 * @returns {Promise<boolean>} Resolves `true` on confirm, `false` on cancel.
 */
export function showConflictModal(conflicts) {
  return new Promise((resolve) => {
    const overlay = createOverlay();
    const dialog = createDialog(conflicts, (confirmed) => {
      cleanup(overlay);
      resolve(confirmed);
    });

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Focus the cancel button by default (safer default action)
    const cancelBtn = dialog.querySelector('[data-role="cancel"]');
    if (cancelBtn) cancelBtn.focus();

    // Escape key dismisses the modal (cancel)
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cleanup(overlay);
        resolve(false);
      }
      // Focus trap: keep Tab within the modal
      if (e.key === "Tab") {
        trapFocus(e, dialog);
      }
    });
  });
}

/**
 * Create the full-screen overlay element that blocks wizard interaction.
 * @returns {HTMLElement}
 */
function createOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "book-conflict-overlay";
  overlay.setAttribute("role", "presentation");
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "10000",
  });
  return overlay;
}

/**
 * Create the modal dialog element with conflict list and action buttons.
 *
 * @param {Array<{type: string, name: string, id: string, bookTitle: string}>} conflicts
 * @param {(confirmed: boolean) => void} onResolve
 * @returns {HTMLElement}
 */
function createDialog(conflicts, onResolve) {
  const dialog = document.createElement("div");
  dialog.className = "book-conflict-dialog";
  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "book-conflict-heading");
  dialog.setAttribute("aria-describedby", "book-conflict-description");
  Object.assign(dialog.style, {
    backgroundColor: "#fff",
    borderRadius: "8px",
    padding: "1.5rem",
    maxWidth: "500px",
    width: "90%",
    maxHeight: "80vh",
    overflowY: "auto",
    boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
  });

  // Heading
  const heading = document.createElement("h2");
  heading.id = "book-conflict-heading";
  heading.textContent = "Remove Book Source?";
  heading.style.margin = "0 0 0.75rem 0";
  dialog.appendChild(heading);

  // Description
  const desc = document.createElement("p");
  desc.id = "book-conflict-description";
  desc.textContent =
    "The following selections will be removed from your character because they belong to the book being disabled:";
  desc.style.margin = "0 0 1rem 0";
  dialog.appendChild(desc);

  // Grouped conflict list
  const list = buildGroupedList(conflicts);
  dialog.appendChild(list);

  // Button row
  const btnRow = document.createElement("div");
  Object.assign(btnRow.style, {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
    marginTop: "1.25rem",
  });

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.textContent = "Confirm";
  confirmBtn.setAttribute("data-role", "confirm");
  confirmBtn.addEventListener("click", () => onResolve(true));

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  cancelBtn.setAttribute("data-role", "cancel");
  cancelBtn.addEventListener("click", () => onResolve(false));

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  dialog.appendChild(btnRow);

  return dialog;
}

/**
 * Build the grouped list of affected selections.
 * Groups conflicts by `type`, then lists items within each group
 * formatted as "Type: Name — Book Title".
 *
 * @param {Array<{type: string, name: string, id: string, bookTitle: string}>} conflicts
 * @returns {HTMLElement}
 */
function buildGroupedList(conflicts) {
  const container = document.createElement("ul");
  container.className = "book-conflict-list";
  Object.assign(container.style, {
    listStyle: "none",
    padding: "0",
    margin: "0",
  });

  // Group by type
  const grouped = new Map();
  for (const c of conflicts) {
    const key = c.type || "Unknown";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(c);
  }

  // Render each group
  for (const [type, items] of grouped) {
    for (const item of items) {
      const li = document.createElement("li");
      li.style.padding = "0.25rem 0";
      li.textContent = `${type}: ${item.name} \u2014 ${item.bookTitle}`;
      container.appendChild(li);
    }
  }

  return container;
}

/**
 * Remove the overlay from the DOM.
 * @param {HTMLElement} overlay
 */
function cleanup(overlay) {
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
}

/**
 * Trap focus within the dialog when Tab or Shift+Tab is pressed.
 * @param {KeyboardEvent} e
 * @param {HTMLElement} dialog
 */
function trapFocus(e, dialog) {
  const focusable = dialog.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
