// One-line notice with an undo action. Hiding an overlay happens at once,
// without a confirm dialog; this toast is the fail-safe (SHIG 57, 54).
//
// Focus: the control the user pressed has just been hidden, which would
// drop keyboard focus onto <body>. The toast catches it on its undo button,
// and when the toast closes on its own while holding focus it hands focus
// to `onFocusExit` (the restore button) instead of losing it again.

import { el } from "./dom";

const TOAST_MS = 6000;

export interface Toast {
  show(message: string, onUndo: () => void): void;
}

// Chrome keeps reporting a just-hidden button as activeElement until its
// next focus fixup, so "inside a [hidden] subtree" counts as lost too.
function focusIsLost(): boolean {
  const active = document.activeElement;
  return active === null || active === document.body || active.closest("[hidden]") !== null;
}

export function createToast(mount: HTMLElement, onFocusExit: () => void): Toast {
  const text = el("span", {});
  const undoButton = el("button", { type: "button" }, "元に戻す");
  const node = el("div", { class: "toast", hidden: true }, text, undoButton);
  // A live region toggled with [hidden] is often not announced, so the
  // announcement goes through a region that is always in the tree.
  const announcer = el("div", { class: "visually-hidden", role: "status" });
  mount.append(node, announcer);

  let timer: number | null = null;
  let undo: (() => void) | null = null;

  function close(): boolean {
    const hadFocus = node.contains(document.activeElement);
    node.hidden = true;
    undo = null;
    announcer.textContent = "";
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    return hadFocus;
  }

  undoButton.addEventListener("click", () => {
    const action = undo;
    close();
    action?.();
  });

  return {
    show(message: string, onUndo: () => void): void {
      if (timer !== null) window.clearTimeout(timer);
      text.textContent = message;
      announcer.textContent = message;
      undo = onUndo;
      node.hidden = false;
      if (focusIsLost()) undoButton.focus();
      timer = window.setTimeout(() => {
        if (close()) onFocusExit();
      }, TOAST_MS);
    },
  };
}
