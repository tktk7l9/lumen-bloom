// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { el } from "./dom";

describe("el", () => {
  it("creates the tag with plain string attributes", () => {
    const node = el("button", { type: "button", "aria-label": "閉じる" });
    expect(node.tagName).toBe("BUTTON");
    expect(node.getAttribute("type")).toBe("button");
    expect(node.getAttribute("aria-label")).toBe("閉じる");
  });

  it("maps class to className", () => {
    const node = el("div", { class: "hud extra" });
    expect(node.className).toBe("hud extra");
    expect(node.classList.contains("extra")).toBe(true);
  });

  it("sets boolean attributes only when true", () => {
    const hiddenNode = el("aside", { hidden: true });
    const visibleNode = el("aside", { hidden: false });
    expect(hiddenNode.hidden).toBe(true);
    expect(hiddenNode.hasAttribute("hidden")).toBe(true);
    expect(visibleNode.hasAttribute("hidden")).toBe(false);
  });

  it("binds function attributes as event listeners without the on prefix", () => {
    const onClick = vi.fn();
    const node = el("button", { onclick: onClick });
    node.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("appends string and node children and skips null/undefined", () => {
    const child = el("span", {}, "inner");
    const node = el("div", {}, "text", null, child, undefined);
    expect(node.childNodes).toHaveLength(2);
    expect(node.textContent).toBe("textinner");
    expect(node.firstChild?.nodeType).toBe(Node.TEXT_NODE);
    expect(node.lastChild).toBe(child);
  });
});
