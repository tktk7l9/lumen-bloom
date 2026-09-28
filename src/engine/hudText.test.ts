import { formatHud, moonPhaseLabel } from "./hudText";
import type { WeatherSnapshot } from "./weather/types";

const weather: WeatherSnapshot = {
  condition: "rain",
  cloudCoverPct: 90,
  precipitationMm: 1.2,
  temperatureC: 17.6,
  isDay: true,
  fetchedAt: 0,
};

describe("moonPhaseLabel", () => {
  it("names every phase in Japanese", () => {
    expect(moonPhaseLabel("new")).toBe("新月");
    expect(moonPhaseLabel("waxingCrescent")).toBe("三日月");
    expect(moonPhaseLabel("firstQuarter")).toBe("上弦の月");
    expect(moonPhaseLabel("waxingGibbous")).toBe("十三夜月");
    expect(moonPhaseLabel("full")).toBe("満月");
    expect(moonPhaseLabel("waningGibbous")).toBe("寝待月");
    expect(moonPhaseLabel("lastQuarter")).toBe("下弦の月");
    expect(moonPhaseLabel("waningCrescent")).toBe("有明月");
  });
});

describe("formatHud", () => {
  it("shows only the zero-padded time when nothing else is known", () => {
    const out = formatHud({
      now: new Date(2026, 0, 2, 7, 5),
      weather: null,
      arrangementName: null,
      moonPhaseName: null,
    });
    expect(out.text).toBe("07:05");
    expect(out.label).toBe("07:05（押すと隠します）");
  });

  it("joins weather, flower and moon glyph, and spells the moon out for the label", () => {
    const out = formatHud({
      now: new Date(2026, 5, 21, 22, 0),
      weather,
      arrangementName: "ラベンダー",
      moonPhaseName: "firstQuarter",
    });
    expect(out.text).toBe("22:00 · 雨 18°C · ラベンダー · \u{1F313}");
    expect(out.label).toBe("22:00 · 雨 18°C · ラベンダー · 上弦の月（押すと隠します）");
  });
});
