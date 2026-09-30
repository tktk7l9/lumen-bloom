// @vitest-environment jsdom
//
// Behavioural tests for the app orchestrator with the Three.js stage mocked
// out: what the user sees in the DOM overlays, how the undo/restore flow
// behaves, the geolocation prompt, weather polling and the pause/resume of
// periodic work. WebGL rendering itself is out of scope for jsdom.

import { getByRole, getByText, queryByRole } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { arrangementForDate, findArrangement } from "./engine/arrangements";
import { formatHud } from "./engine/hudText";
import { sunPosition } from "./engine/astro/solar";
import { moonPhase } from "./engine/astro/moonphase";

const stage = vi.hoisted(() => {
  const ctx = {
    renderer: {},
    scene: {},
    resize: vi.fn(),
    render: vi.fn(),
    precompile: vi.fn(async (yieldBetween: () => Promise<void>) => {
      await yieldBetween();
    }),
  };
  const rig = {
    update: vi.fn(),
    applySceneState: vi.fn(),
    setArrangement: vi.fn(),
    setBloomStage: vi.fn(),
    wantsHighFps: vi.fn(() => false),
  };
  return {
    ctx,
    rig,
    applyProceduralEnvironment: vi.fn(),
    createRenderContext: vi.fn(() => ctx),
    createSceneRig: vi.fn(() => rig),
  };
});

vi.mock("./scene/stage", () => ({
  applyProceduralEnvironment: stage.applyProceduralEnvironment,
  createRenderContext: stage.createRenderContext,
  createSceneRig: stage.createSceneRig,
}));

import { startApp } from "./orchestrator";

const TOKYO = { lat: 35.6762, lng: 139.6503 };
const NOW = new Date("2026-06-15T03:00:00Z"); // 12:00 JST, daytime in Tokyo
const NIGHT = "2026-06-15T15:00:00Z"; // 00:00 JST
const MIN = 60 * 1000;

function weatherBody(overrides: Record<string, number> = {}): unknown {
  return {
    current: {
      weather_code: 61,
      cloud_cover: 90,
      precipitation: 2,
      temperature_2m: 17.6,
      is_day: 1,
      ...overrides,
    },
  };
}

function okResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response;
}

// startApp() has no teardown (a wallpaper never unmounts), so the listeners
// it puts on document/window are recorded here and removed after each test.
const trackedListeners: Array<[EventTarget, string, EventListenerOrEventListenerObject | null]> = [];

let fetchMock: ReturnType<typeof vi.fn>;
let getCurrentPosition: ReturnType<typeof vi.fn>;

function setUrl(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
}

function setReducedMotion(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  });
}

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

function app(): HTMLElement {
  return document.getElementById("app")!;
}

function hud(): HTMLElement {
  return app().querySelector<HTMLElement>(".hud")!;
}

/** The visible toast's message, or null while it is closed. */
function toastText(): string | null {
  const toast = app().querySelector<HTMLElement>(".toast")!;
  if (toast.hidden) return null;
  expect(getByRole(app(), "status").textContent).toBe(toast.querySelector("span")!.textContent);
  return toast.querySelector("span")!.textContent;
}

function veil(): HTMLElement | null {
  return document.getElementById("loading");
}

/** Run the staged boot to completion (paint fallback + yields + precompile). */
async function boot(): Promise<void> {
  await vi.advanceTimersByTimeAsync(300);
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "Date",
      // The frame loop measures dt against performance.now(); keep it on the
      // same fake clock as requestAnimationFrame's timestamps.
      "performance",
    ],
  });
  trackedListeners.length = 0;
  for (const target of [document, window]) {
    const original = target.addEventListener.bind(target);
    vi.spyOn(target, "addEventListener").mockImplementation((type, listener, options) => {
      trackedListeners.push([target, type, listener]);
      original(type, listener, options);
    });
  }
  vi.setSystemTime(NOW);
  localStorage.clear();
  document.body.innerHTML =
    '<canvas id="scene"></canvas><div id="loading" class="loading"></div><div id="app"></div>';
  setUrl("");
  setReducedMotion(false);
  Object.defineProperty(document, "hidden", { value: false, configurable: true });

  fetchMock = vi.fn(async () => okResponse(weatherBody()));
  vi.stubGlobal("fetch", fetchMock);
  getCurrentPosition = vi.fn();
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});

  stage.applyProceduralEnvironment.mockClear();
  stage.createRenderContext.mockClear();
  stage.createSceneRig.mockClear();
  stage.ctx.resize.mockClear();
  stage.ctx.render.mockClear();
  stage.ctx.precompile.mockClear();
  stage.ctx.precompile.mockImplementation(async (yieldBetween: () => Promise<void>) => {
    await yieldBetween();
  });
  stage.rig.update.mockClear();
  stage.rig.applySceneState.mockClear();
  stage.rig.setArrangement.mockClear();
  stage.rig.setBloomStage.mockClear();
  stage.rig.wantsHighFps.mockReturnValue(false);
});

afterEach(() => {
  for (const [target, type, listener] of trackedListeners) {
    target.removeEventListener(type, listener);
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("startApp", () => {
  it("does nothing when the page has no canvas or mount", () => {
    document.body.innerHTML = '<div id="app"></div>';
    startApp();
    expect(stage.createRenderContext).not.toHaveBeenCalled();
    expect(app().childElementCount).toBe(0);
  });

  it("paints the overlays before the 3D stage and boots it in stages", async () => {
    startApp();

    const expected = arrangementForDate(NOW, TOKYO.lat);
    expect(getByRole(app(), "complementary", { name: expected.name }).textContent).toContain(
      expected.description,
    );
    expect(hud().textContent).toMatch(/^\d{2}:\d{2} · /);
    expect(hud().textContent).toContain(expected.name);
    expect(stage.createRenderContext).not.toHaveBeenCalled();
    expect(veil()?.classList.contains("loading--done")).toBe(false);

    await boot();

    expect(stage.createRenderContext).toHaveBeenCalledWith(document.getElementById("scene"));
    expect(stage.applyProceduralEnvironment).toHaveBeenCalledWith(stage.ctx.renderer, stage.ctx.scene);
    expect(stage.createSceneRig).toHaveBeenCalledWith(stage.ctx, false);
    expect(stage.rig.setArrangement).toHaveBeenCalledWith(expected);
    expect(stage.rig.setBloomStage).toHaveBeenCalled();
    expect(stage.ctx.precompile).toHaveBeenCalled();
    expect(stage.ctx.render).toHaveBeenCalled();
    expect(veil()?.classList.contains("loading--done")).toBe(true);

    await vi.advanceTimersByTimeAsync(700);
    expect(veil()).toBeNull();

    // The frame loop is running now.
    const framesBefore = stage.rig.update.mock.calls.length;
    await vi.advanceTimersByTimeAsync(500);
    expect(stage.rig.update.mock.calls.length).toBeGreaterThan(framesBefore);
  });

  it("shows the weather in the HUD once the fetch lands and feeds it to the scene", async () => {
    startApp();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("latitude=35.6762");

    await boot();

    expect(hud().textContent).toContain("雨 18°C");
    const state = stage.rig.applySceneState.mock.calls.at(-1)![0];
    expect(state.mood.particle).toBe("rain");
  });

  it("boots even when the shader precompile fails", async () => {
    stage.ctx.precompile.mockRejectedValue(new Error("driver quirk"));
    startApp();
    await boot();

    expect(console.warn).toHaveBeenCalledWith(
      "Shader precompile failed; continuing without it",
      expect.any(Error),
    );
    expect(stage.ctx.render).toHaveBeenCalled();
    expect(veil()?.classList.contains("loading--done")).toBe(true);
  });

  it("keeps a stale weather for 30 minutes after a failed poll, then clears it", async () => {
    setReducedMotion(true);
    startApp();
    await boot();
    expect(hud().textContent).toContain("雨 18°C");

    fetchMock.mockRejectedValue(new Error("offline"));
    await vi.advanceTimersByTimeAsync(12 * MIN);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(hud().textContent).toContain("雨 18°C");

    await vi.advanceTimersByTimeAsync(12 * MIN);
    expect(hud().textContent).toContain("雨 18°C");

    await vi.advanceTimersByTimeAsync(12 * MIN); // 36 min old now
    expect(hud().textContent).not.toContain("雨");
    expect(stage.rig.applySceneState.mock.calls.at(-1)![0].mood.particle).toBe("none");
  });

  it("under reduced motion refreshes on timers instead of a frame loop", async () => {
    setReducedMotion(true);
    startApp();
    await boot();
    expect(stage.createSceneRig).toHaveBeenCalledWith(stage.ctx, true);

    const renders = stage.ctx.render.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5 * MIN);
    expect(stage.rig.update).not.toHaveBeenCalled();
    expect(stage.ctx.render.mock.calls.length).toBeGreaterThan(renders);
  });

  it("hiding the clock offers an undo toast that brings it back with focus", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    startApp();

    await user.click(getByRole(app(), "button", { name: /押すと隠します/ }));

    expect(hud().hidden).toBe(true);
    expect(toastText()).toBe("時計を隠しました");
    expect(getByRole(app(), "button", { name: "表示を戻す" })).toBeTruthy();

    await user.click(getByRole(app(), "button", { name: "元に戻す" }));

    expect(hud().hidden).toBe(false);
    expect(document.activeElement).toBe(hud());
    expect(queryByRole(app(), "button", { name: "表示を戻す" })).toBeNull();
    expect(localStorage.getItem("lumen-bloom:hud-hidden")).toBeNull();
  });

  it("hiding the flower card offers an undo that brings it back with focus on ×", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    startApp();

    await user.click(getByRole(app(), "button", { name: "花の説明を閉じる" }));
    expect(queryByRole(app(), "complementary")).toBeNull();
    await user.click(getByRole(app(), "button", { name: "元に戻す" }));

    expect(getByRole(app(), "complementary")).toBeTruthy();
    expect(document.activeElement).toBe(getByRole(app(), "button", { name: "花の説明を閉じる" }));
    expect(queryByRole(app(), "button", { name: "表示を戻す" })).toBeNull();
    expect(localStorage.getItem("lumen-bloom:info-hidden")).toBeNull();
  });

  it("the restore button remains after the toast expires and brings the card back", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    startApp();

    await user.click(getByRole(app(), "button", { name: "花の説明を閉じる" }));
    expect(toastText()).toBe("花の説明を隠しました");
    expect(queryByRole(app(), "complementary")).toBeNull();

    await vi.advanceTimersByTimeAsync(6000);
    expect(toastText()).toBeNull();
    // Focus went from the closed toast to the restore button.
    const restore = getByRole(app(), "button", { name: "表示を戻す" });
    expect(document.activeElement).toBe(restore);

    await user.click(restore);
    expect(getByRole(app(), "complementary")).toBeTruthy();
    expect(document.activeElement).toBe(getByRole(app(), "button", { name: "花の説明を閉じる" }));
    expect(queryByRole(app(), "button", { name: "表示を戻す" })).toBeNull();
  });

  it("restores every hidden overlay at once and focuses the clock first", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    startApp();

    await user.click(getByRole(app(), "button", { name: "花の説明を閉じる" }));
    await user.click(getByRole(app(), "button", { name: /押すと隠します/ }));
    await user.click(getByRole(app(), "button", { name: "位置情報の案内を閉じる" }));
    expect(toastText()).toBe("位置情報の案内を隠しました");

    await user.click(getByRole(app(), "button", { name: "表示を戻す" }));

    expect(hud().hidden).toBe(false);
    expect(getByRole(app(), "complementary")).toBeTruthy();
    expect(getByRole(app(), "button", { name: "位置情報を使う" })).toBeTruthy();
    expect(document.activeElement).toBe(hud());
  });

  it("first visit: the prompt asks for location, shows progress, then hides on a GPS fix", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    startApp();
    await boot();
    fetchMock.mockClear();

    await user.click(getByRole(app(), "button", { name: "位置情報を使う" }));
    const busy = getByRole(app(), "button", { name: "取得しています…" });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);

    const [onSuccess] = getCurrentPosition.mock.calls[0];
    onSuccess({ coords: { latitude: -33.87, longitude: 151.21 } });
    await vi.advanceTimersByTimeAsync(0);

    expect(app().querySelector<HTMLElement>(".location-prompt")!.hidden).toBe(true);
    expect(JSON.parse(localStorage.getItem("lumen-bloom:location")!)).toEqual({
      lat: -33.87,
      lng: 151.21,
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("latitude=-33.8700");
    // Southern hemisphere: the seasonal rotation shifts by six months.
    const expected = arrangementForDate(NOW, -33.87);
    expect(getByRole(app(), "complementary", { name: expected.name })).toBeTruthy();
    expect(queryByRole(app(), "button", { name: "表示を戻す" })).toBeNull();
  });

  it("a denied GPS request switches the prompt to retry wording", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    startApp();

    await user.click(getByRole(app(), "button", { name: "位置情報を使う" }));
    const [, onError] = getCurrentPosition.mock.calls[0];
    onError(new Error("denied"));
    await vi.advanceTimersByTimeAsync(0);

    expect(getByText(app(), /位置情報を取得できませんでした/)).toBeTruthy();
    const retry = getByRole(app(), "button", { name: "もう一度試す" });
    expect((retry as HTMLButtonElement).disabled).toBe(false);
    expect(localStorage.getItem("lumen-bloom:location")).toBeNull();

    await user.click(retry);
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it("closing the prompt with × offers an undo that brings it back with focus", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    startApp();

    await user.click(getByRole(app(), "button", { name: "位置情報の案内を閉じる" }));
    expect(app().querySelector<HTMLElement>(".location-prompt")!.hidden).toBe(true);
    expect(localStorage.getItem("lumen-bloom:location-prompt-dismissed")).toBe("1");

    await user.click(getByRole(app(), "button", { name: "元に戻す" }));

    const useLocation = getByRole(app(), "button", { name: "位置情報を使う" });
    expect(document.activeElement).toBe(useLocation);
    expect(localStorage.getItem("lumen-bloom:location-prompt-dismissed")).toBeNull();
    expect(queryByRole(app(), "button", { name: "表示を戻す" })).toBeNull();
  });

  it("the restore button brings a closed prompt back and focuses its main button", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    startApp();

    await user.click(getByRole(app(), "button", { name: "位置情報の案内を閉じる" }));
    await vi.advanceTimersByTimeAsync(6000); // the undo toast is gone
    await user.click(getByRole(app(), "button", { name: "表示を戻す" }));

    expect(app().querySelector<HTMLElement>(".location-prompt")!.hidden).toBe(false);
    expect(document.activeElement).toBe(getByRole(app(), "button", { name: "位置情報を使う" }));
    expect(queryByRole(app(), "button", { name: "表示を戻す" })).toBeNull();
    expect(localStorage.getItem("lumen-bloom:location-prompt-dismissed")).toBeNull();
  });

  it("a GPS fix that lands while the prompt's undo toast is open keeps the prompt gone", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    startApp();

    // Request in flight, then the user closes the pill with × (undo toast opens).
    await user.click(getByRole(app(), "button", { name: "位置情報を使う" }));
    await user.click(getByRole(app(), "button", { name: "位置情報の案内を閉じる" }));
    expect(toastText()).toBe("位置情報の案内を隠しました");
    expect(getByRole(app(), "button", { name: "表示を戻す" })).toBeTruthy();

    getCurrentPosition.mock.calls[0][0]({ coords: { latitude: 1, longitude: 2 } });
    await vi.advanceTimersByTimeAsync(0);
    expect(app().querySelector<HTMLElement>(".location-prompt")!.hidden).toBe(true);
    // The location is known now: the restore button has nothing to bring back.
    expect(queryByRole(app(), "button", { name: "表示を戻す" })).toBeNull();

    // The toast from the × is still open (6 s window) — its undo must not
    // re-offer a location the app already has.
    await user.click(getByRole(app(), "button", { name: "元に戻す" }));
    expect(app().querySelector<HTMLElement>(".location-prompt")!.hidden).toBe(true);
    expect(queryByRole(app(), "button", { name: "表示を戻す" })).toBeNull();
  });

  it("a dismissed prompt stays hidden on the next launch but the restore button offers it", () => {
    localStorage.setItem("lumen-bloom:location-prompt-dismissed", "1");
    startApp();
    expect(app().querySelector<HTMLElement>(".location-prompt")!.hidden).toBe(true);
    expect(getByRole(app(), "button", { name: "表示を戻す" })).toBeTruthy();
  });

  it("returning users with a saved location get no prompt and their own weather", () => {
    localStorage.setItem("lumen-bloom:location", JSON.stringify({ lat: 51.5, lng: -0.12 }));
    startApp();
    expect(app().querySelector(".location-prompt")).toBeNull();
    expect(String(fetchMock.mock.calls[0][0])).toContain("latitude=51.5000");
  });

  it("URL params pin the location, the centerpiece and the overlays", async () => {
    setUrl("?lat=-33.87&lng=151.21&obj=tulip&hud=0&info=0");
    startApp();

    expect(app().querySelector(".location-prompt")).toBeNull();
    expect(hud().hidden).toBe(true);
    expect(queryByRole(app(), "complementary")).toBeNull();
    expect(queryByRole(app(), "button", { name: "表示を戻す" })).toBeNull();
    expect(String(fetchMock.mock.calls[0][0])).toContain("longitude=151.2100");

    await boot();
    expect(stage.rig.setArrangement).toHaveBeenCalledWith(findArrangement("tulip"));
  });

  it("?t= shifts the clock and shows the moon phase at night", () => {
    setUrl(`?t=${NIGHT}`);
    startApp();

    const shifted = new Date(NIGHT);
    const sun = sunPosition(shifted, TOKYO);
    expect(sun.apparentAltitude).toBeLessThan(-6);
    const expected = formatHud({
      now: shifted,
      weather: null,
      arrangementName: arrangementForDate(shifted, TOKYO.lat).name,
      moonPhaseName: moonPhase(shifted).name,
    });
    expect(hud().textContent).toBe(expected.text);
    expect(hud().getAttribute("aria-label")).toBe(expected.label);
  });

  it("pauses the loop and polling while hidden and resumes with a fresh fetch", async () => {
    startApp();
    // Before the boot there is no loop to pause: the event is ignored.
    setHidden(true);
    setHidden(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await boot();
    setHidden(true);
    const frames = stage.rig.update.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(stage.rig.update.mock.calls.length).toBe(frames);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    setHidden(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(stage.rig.update.mock.calls.length).toBeGreaterThan(frames);
  });

  it("does not start the loop when the boot finishes in a hidden tab", async () => {
    startApp();
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    await boot();
    expect(stage.ctx.render).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(stage.rig.update).not.toHaveBeenCalled();

    setHidden(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(stage.rig.update).toHaveBeenCalled();
  });

  it("under reduced motion, hiding the tab stops the sun timer too", async () => {
    setReducedMotion(true);
    startApp();
    await boot();
    stage.ctx.render.mockClear();

    setHidden(true);
    await vi.advanceTimersByTimeAsync(20 * MIN);
    expect(stage.ctx.render).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("works without the loading veil in the page", async () => {
    document.body.innerHTML = '<canvas id="scene"></canvas><div id="app"></div>';
    startApp();
    await boot();
    expect(stage.ctx.render).toHaveBeenCalled();
    expect(veil()).toBeNull();
  });

  it("runs at 30 fps while the scene is busy and 10 fps when idle", async () => {
    startApp();
    await boot();

    stage.rig.update.mockClear();
    await vi.advanceTimersByTimeAsync(1000);
    const idle = stage.rig.update.mock.calls.length;
    expect(idle).toBeGreaterThanOrEqual(8);
    expect(idle).toBeLessThanOrEqual(12);

    stage.rig.wantsHighFps.mockReturnValue(true);
    stage.rig.update.mockClear();
    await vi.advanceTimersByTimeAsync(1000);
    // The fake clock ticks frames at a flat 16 ms (not 16.67), so the 1/30 s
    // budget needs three frames instead of two here: ~20 updates, not 30.
    const busy = stage.rig.update.mock.calls.length;
    expect(busy).toBeGreaterThanOrEqual(2 * idle);
    expect(busy).toBeLessThanOrEqual(32);
  });

  it("re-renders on window resize once the stage is up", async () => {
    startApp();
    window.dispatchEvent(new Event("resize"));
    expect(stage.ctx.resize).not.toHaveBeenCalled();

    await boot();
    stage.ctx.resize.mockClear();
    window.dispatchEvent(new Event("resize"));
    expect(stage.ctx.resize).toHaveBeenCalledTimes(1);
  });
});
