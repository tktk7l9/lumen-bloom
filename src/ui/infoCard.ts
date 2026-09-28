// Small bottom-right card describing this week's flower. × hides it
// (remembered per browser) — the orchestrator offers an undo toast and a
// restore button so the hide is never a dead end (SHIG 54, 60).
// ?info=1/0 overrides the stored preference.

import { el } from "./dom";

const DISMISS_KEY = "lumen-bloom:info-hidden";

export interface InfoCard {
  render(name: string, description: string): void;
  /** Whether the user (not a ?info=0 URL) has hidden it. */
  isUserHidden(): boolean;
  /** Bring it back and forget the stored preference. */
  show(): void;
  /** Move keyboard focus to its close button (after an undo / restore). */
  focus(): void;
}

export function createInfoCard(
  mount: HTMLElement,
  forced: boolean | null,
  onUserHide: () => void,
): InfoCard {
  const title = el("div", { class: "title", id: "info-card-title" });
  const body = el("div", { class: "body" });
  const closeButton = el(
    "button",
    { type: "button", class: "close", "aria-label": "花の説明を閉じる" },
    "×",
  );
  const node = el(
    "aside",
    { class: "info-card", hidden: true, "aria-labelledby": "info-card-title" },
    closeButton,
    title,
    body,
  );

  node.hidden = forced === null ? localStorage.getItem(DISMISS_KEY) !== null : !forced;
  let userHidden = forced === null && node.hidden;

  closeButton.addEventListener("click", () => {
    node.hidden = true;
    userHidden = true;
    localStorage.setItem(DISMISS_KEY, "1");
    onUserHide();
  });
  mount.append(node);

  let renderedName: string | null = null;
  let latest: { name: string; description: string } | null = null;

  function paint(): void {
    if (node.hidden || !latest || renderedName === latest.name) return;
    renderedName = latest.name;
    title.textContent = latest.name;
    body.textContent = latest.description;
  }

  return {
    render(name: string, description: string): void {
      latest = { name, description };
      paint();
    },
    isUserHidden: () => userHidden,
    show(): void {
      node.hidden = false;
      userHidden = false;
      localStorage.removeItem(DISMISS_KEY);
      paint();
    },
    focus(): void {
      if (!node.hidden) closeButton.focus();
    },
  };
}
