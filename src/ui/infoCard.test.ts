// @vitest-environment jsdom
import { getByRole, queryByRole } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInfoCard } from "./infoCard";

const DISMISS_KEY = "lumen-bloom:info-hidden";

let mount: HTMLElement;

beforeEach(() => {
  localStorage.clear();
  mount = document.createElement("div");
  document.body.append(mount);
});

afterEach(() => {
  mount.remove();
});

describe("createInfoCard", () => {
  it("renders the flower name and description as a labelled region landmark", () => {
    const card = createInfoCard(mount, null, vi.fn());
    card.render("ひまわり", "夏の花。");

    const region = getByRole(mount, "region", { name: "ひまわり" });
    // A <section>, not <aside>: the card lives inside <main>, where a
    // complementary landmark must not be nested.
    expect(region.tagName).toBe("SECTION");
    expect(queryByRole(mount, "complementary")).toBeNull();
    expect(region.textContent).toContain("夏の花。");
    expect(getByRole(region, "button", { name: "花の説明を閉じる" })).toBeTruthy();
  });

  it("re-renders only when the flower changes", () => {
    const card = createInfoCard(mount, null, vi.fn());
    card.render("ひまわり", "夏の花。");
    card.render("ひまわり", "別の説明");
    expect(mount.textContent).toContain("夏の花。");
    expect(mount.textContent).not.toContain("別の説明");

    card.render("チューリップ", "春の花。");
    expect(getByRole(mount, "region", { name: "チューリップ" }).textContent).toContain(
      "春の花。",
    );
  });

  it("× hides it, remembers it and notifies the orchestrator", async () => {
    const user = userEvent.setup();
    const onUserHide = vi.fn();
    const card = createInfoCard(mount, null, onUserHide);
    card.render("ひまわり", "夏の花。");

    await user.click(getByRole(mount, "button", { name: "花の説明を閉じる" }));

    expect(queryByRole(mount, "region")).toBeNull();
    expect(localStorage.getItem(DISMISS_KEY)).toBe("1");
    expect(onUserHide).toHaveBeenCalledTimes(1);
    expect(card.isUserHidden()).toBe(true);
  });

  it("starts hidden from the stored preference; show() paints the latest flower", () => {
    localStorage.setItem(DISMISS_KEY, "1");
    const card = createInfoCard(mount, null, vi.fn());
    expect(card.isUserHidden()).toBe(true);

    card.render("ひまわり", "夏の花。");
    expect(queryByRole(mount, "region")).toBeNull();

    card.show();
    expect(card.isUserHidden()).toBe(false);
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
    expect(getByRole(mount, "region", { name: "ひまわり" }).textContent).toContain(
      "夏の花。",
    );
  });

  it("show() before any render leaves the card empty but visible", () => {
    localStorage.setItem(DISMISS_KEY, "1");
    const card = createInfoCard(mount, null, vi.fn());
    card.show();
    expect(mount.querySelector<HTMLElement>(".info-card")?.hidden).toBe(false);
    expect(mount.querySelector(".title")?.textContent).toBe("");
  });

  it("?info=0 hides without a user choice; ?info=1 overrides a stored dismissal", () => {
    const forcedOff = createInfoCard(mount, false, vi.fn());
    expect(queryByRole(mount, "region")).toBeNull();
    expect(forcedOff.isUserHidden()).toBe(false);
    // One card per page (its title id is fixed), so start over for the next one.
    mount.replaceChildren();

    localStorage.setItem(DISMISS_KEY, "1");
    const forcedOn = createInfoCard(mount, true, vi.fn());
    forcedOn.render("ひまわり", "夏の花。");
    expect(getByRole(mount, "region", { name: "ひまわり" })).toBeTruthy();
    expect(forcedOn.isUserHidden()).toBe(false);
  });

  it("focus() goes to the close button only while visible", () => {
    const card = createInfoCard(mount, null, vi.fn());
    card.render("ひまわり", "夏の花。");
    card.focus();
    expect(document.activeElement).toBe(getByRole(mount, "button", { name: "花の説明を閉じる" }));

    (document.activeElement as HTMLElement).click();
    (document.activeElement as HTMLElement | null)?.blur();
    card.focus();
    expect(document.activeElement).toBe(document.body);
  });
});
