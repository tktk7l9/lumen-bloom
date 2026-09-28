// HUD readout text. Pure so the wording (and its screen-reader label) is
// testable in node: the moon phase shows as an emoji glyph on screen, but
// the accessible label spells it out in Japanese (SHIG 94, 31).

import type { MoonPhaseName } from "./astro/moonphase";
import { moonGlyph } from "./astro/moonphase";
import type { WeatherSnapshot } from "./weather/types";

const CONDITION_LABELS: Record<WeatherSnapshot["condition"], string> = {
  clear: "晴れ",
  cloudy: "くもり",
  fog: "霧",
  rain: "雨",
  snow: "雪",
  storm: "雷雨",
};

const MOON_PHASE_LABELS: Record<MoonPhaseName, string> = {
  new: "新月",
  waxingCrescent: "三日月",
  firstQuarter: "上弦の月",
  waxingGibbous: "十三夜月",
  full: "満月",
  waningGibbous: "寝待月",
  lastQuarter: "下弦の月",
  waningCrescent: "有明月",
};

export interface HudData {
  now: Date;
  weather: WeatherSnapshot | null;
  /** This week's seasonal arrangement name. */
  arrangementName: string | null;
  /** Shown at night instead of nothing — the moon phase. */
  moonPhaseName: MoonPhaseName | null;
}

export interface HudText {
  /** What the pill shows. */
  text: string;
  /** Accessible name: same readout with the moon spelled out, plus what a press does. */
  label: string;
}

export function moonPhaseLabel(name: MoonPhaseName): string {
  return MOON_PHASE_LABELS[name];
}

export function formatHud(data: HudData): HudText {
  const hh = String(data.now.getHours()).padStart(2, "0");
  const mm = String(data.now.getMinutes()).padStart(2, "0");
  const parts = [`${hh}:${mm}`];
  if (data.weather) {
    parts.push(
      `${CONDITION_LABELS[data.weather.condition]} ${Math.round(data.weather.temperatureC)}°C`,
    );
  }
  if (data.arrangementName) parts.push(data.arrangementName);
  const spoken = [...parts];
  if (data.moonPhaseName) {
    parts.push(moonGlyph(data.moonPhaseName));
    spoken.push(moonPhaseLabel(data.moonPhaseName));
  }
  return { text: parts.join(" · "), label: `${spoken.join(" · ")}（押すと隠します）` };
}
