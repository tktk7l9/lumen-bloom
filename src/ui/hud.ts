// Small clock + weather readout in the corner, so the wallpaper doubles as
// an ambient clock. A press hides it (remembered per browser) — the
// orchestrator offers an undo toast and a restore button so the hide is
// never a dead end (SHIG 54, 60). ?hud=1/0 overrides the stored preference.

import { formatHud, type HudData } from "../engine/hudText";
import { el } from "./dom";

export type { HudData } from "../engine/hudText";

const DISMISS_KEY = "lumen-bloom:hud-hidden";

export interface Hud {
  render(data: HudData): void;
  /** Whether the user (not a ?hud=0 URL) has hidden it. */
  isUserHidden(): boolean;
  /** Bring it back and forget the stored preference. */
  show(): void;
}

export function createHud(
  mount: HTMLElement,
  forced: boolean | null,
  onUserHide: () => void,
): Hud {
  const node = el("button", { type: "button", class: "hud" });

  node.hidden = forced === null ? localStorage.getItem(DISMISS_KEY) !== null : !forced;
  let userHidden = forced === null && node.hidden;
  let lastData: HudData | null = null;

  function paint(): void {
    if (node.hidden || !lastData) return;
    const { text, label } = formatHud(lastData);
    node.textContent = text;
    node.setAttribute("aria-label", label);
  }

  node.addEventListener("click", () => {
    node.hidden = true;
    userHidden = true;
    localStorage.setItem(DISMISS_KEY, "1");
    onUserHide();
  });
  mount.append(node);

  return {
    render(data: HudData): void {
      lastData = data;
      paint();
    },
    isUserHidden: () => userHidden,
    show(): void {
      node.hidden = false;
      userHidden = false;
      localStorage.removeItem(DISMISS_KEY);
      paint();
    },
  };
}
