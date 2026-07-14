// Small bottom-right card describing this week's flower. × hides it
// (remembered per browser); ?info=1/0 overrides the stored preference —
// ?info=1 is also the way back after dismissing it.

import { el } from "./dom";

const DISMISS_KEY = "lumen-bloom:info-hidden";

export interface InfoCard {
  render(name: string, description: string): void;
}

export function createInfoCard(mount: HTMLElement, forced: boolean | null): InfoCard {
  const title = el("div", { class: "title" });
  const body = el("div", { class: "body" });
  const closeButton = el("button", { type: "button", class: "close", "aria-label": "閉じる" }, "×");
  const node = el("aside", { class: "info-card", hidden: true }, closeButton, title, body);

  const hidden = forced === null ? localStorage.getItem(DISMISS_KEY) !== null : !forced;
  node.hidden = hidden;

  closeButton.addEventListener("click", () => {
    node.hidden = true;
    localStorage.setItem(DISMISS_KEY, "1");
  });
  mount.append(node);

  let renderedName: string | null = null;

  return {
    render(name: string, description: string): void {
      if (node.hidden || renderedName === name) return;
      renderedName = name;
      title.textContent = name;
      body.textContent = description;
    },
  };
}
