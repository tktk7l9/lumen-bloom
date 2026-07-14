// Small clock + weather readout in the corner, so the wallpaper doubles as
// an ambient clock. Click hides it (remembered per browser); ?hud=1/0
// overrides the stored preference.

import type { MoonPhaseName } from "../engine/astro/moonphase";
import { moonGlyph } from "../engine/astro/moonphase";
import type { WeatherSnapshot } from "../engine/weather/types";
import { el } from "./dom";

const DISMISS_KEY = "lumen-bloom:hud-hidden";

const CONDITION_LABELS: Record<WeatherSnapshot["condition"], string> = {
  clear: "晴れ",
  cloudy: "くもり",
  fog: "霧",
  rain: "雨",
  snow: "雪",
  storm: "雷雨",
};

export interface HudData {
  now: Date;
  weather: WeatherSnapshot | null;
  /** Shown at night instead of nothing — the moon phase glyph. */
  moonPhaseName: MoonPhaseName | null;
}

export interface Hud {
  render(data: HudData): void;
}

export function createHud(mount: HTMLElement, forced: boolean | null): Hud {
  const node = el("button", {
    type: "button",
    class: "hud",
    title: "クリックで非表示",
  });

  const hidden = forced === null ? localStorage.getItem(DISMISS_KEY) !== null : !forced;
  node.hidden = hidden;

  node.addEventListener("click", () => {
    node.hidden = true;
    localStorage.setItem(DISMISS_KEY, "1");
  });
  mount.append(node);

  return {
    render(data: HudData): void {
      if (node.hidden) return;
      const hh = String(data.now.getHours()).padStart(2, "0");
      const mm = String(data.now.getMinutes()).padStart(2, "0");
      const parts = [`${hh}:${mm}`];
      if (data.weather) {
        parts.push(
          `${CONDITION_LABELS[data.weather.condition]} ${Math.round(data.weather.temperatureC)}°C`,
        );
      }
      if (data.moonPhaseName) parts.push(moonGlyph(data.moonPhaseName));
      node.textContent = parts.join(" · ");
    },
  };
}
