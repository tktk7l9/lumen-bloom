// @vitest-environment jsdom
import { getByRole, queryByRole } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeatherSnapshot } from "../engine/weather/types";
import { createHud, type HudData } from "./hud";

const DISMISS_KEY = "lumen-bloom:hud-hidden";

const rain: WeatherSnapshot = {
  condition: "rain",
  cloudCoverPct: 90,
  precipitationMm: 2,
  temperatureC: 17.6,
  isDay: true,
  fetchedAt: 0,
};

function data(overrides: Partial<HudData> = {}): HudData {
  return {
    now: new Date(2026, 5, 15, 9, 5),
    weather: rain,
    arrangementName: "ひまわり",
    moonPhaseName: null,
    ...overrides,
  };
}

let mount: HTMLElement;

beforeEach(() => {
  localStorage.clear();
  mount = document.createElement("div");
  document.body.append(mount);
});

afterEach(() => {
  mount.remove();
});

describe("createHud", () => {
  it("renders the clock, weather, flower and moon as a button with an accessible label", () => {
    const hud = createHud(mount, null, vi.fn());
    hud.render(data({ moonPhaseName: "full" }));

    const button = getByRole(mount, "button", { name: /09:05 · 雨 18°C · ひまわり · 満月/ });
    expect(button.textContent).toBe("09:05 · 雨 18°C · ひまわり · 🌕");
    expect(button.getAttribute("aria-label")).toContain("押すと隠します");
    expect(button.hidden).toBe(false);
  });

  it("omits the weather part until a snapshot exists", () => {
    const hud = createHud(mount, null, vi.fn());
    hud.render(data({ weather: null, arrangementName: null }));
    expect(getByRole(mount, "button").textContent).toBe("09:05");
  });

  it("hides on press, remembers it and notifies the orchestrator", async () => {
    const user = userEvent.setup();
    const onUserHide = vi.fn();
    const hud = createHud(mount, null, onUserHide);
    hud.render(data());

    await user.click(getByRole(mount, "button"));

    expect(queryByRole(mount, "button")).toBeNull();
    expect(localStorage.getItem(DISMISS_KEY)).toBe("1");
    expect(onUserHide).toHaveBeenCalledTimes(1);
    expect(hud.isUserHidden()).toBe(true);
  });

  it("starts hidden when the stored preference says so and show() brings it back", () => {
    localStorage.setItem(DISMISS_KEY, "1");
    const hud = createHud(mount, null, vi.fn());
    expect(hud.isUserHidden()).toBe(true);
    expect(queryByRole(mount, "button")).toBeNull();

    hud.render(data());
    expect(mount.querySelector(".hud")?.textContent).toBe("");

    hud.show();
    expect(hud.isUserHidden()).toBe(false);
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
    // The last render is painted on show, so the pill is never blank.
    expect(getByRole(mount, "button").textContent).toBe("09:05 · 雨 18°C · ひまわり");
  });

  it("?hud=0 hides it without counting as a user choice", () => {
    const hud = createHud(mount, false, vi.fn());
    expect(queryByRole(mount, "button")).toBeNull();
    expect(hud.isUserHidden()).toBe(false);
  });

  it("?hud=1 overrides a stored dismissal", () => {
    localStorage.setItem(DISMISS_KEY, "1");
    const hud = createHud(mount, true, vi.fn());
    hud.render(data());
    expect(getByRole(mount, "button").textContent).toContain("09:05");
    expect(hud.isUserHidden()).toBe(false);
  });

  it("focus() lands on the pill only while it is visible", () => {
    const hud = createHud(mount, null, vi.fn());
    hud.render(data());
    hud.focus();
    expect(document.activeElement).toBe(getByRole(mount, "button"));

    (document.activeElement as HTMLElement).blur();
    mount.querySelector<HTMLButtonElement>(".hud")!.click();
    hud.focus();
    expect(document.activeElement).toBe(document.body);
  });
});
