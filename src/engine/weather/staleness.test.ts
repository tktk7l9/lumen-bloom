import { shouldKeepStale } from "./staleness";
import type { WeatherSnapshot } from "./types";

function snapshotAt(fetchedAt: number): WeatherSnapshot {
  return {
    condition: "clear",
    cloudCoverPct: 0,
    precipitationMm: 0,
    temperatureC: 20,
    isDay: true,
    fetchedAt,
  };
}

describe("shouldKeepStale", () => {
  it("is false when weather has never once succeeded", () => {
    expect(shouldKeepStale(null, 100_000, 60_000)).toBe(false);
  });

  it("is true within the max age window", () => {
    expect(shouldKeepStale(snapshotAt(0), 30_000, 60_000)).toBe(true);
  });

  it("is true exactly at the boundary", () => {
    expect(shouldKeepStale(snapshotAt(0), 60_000, 60_000)).toBe(true);
  });

  it("is false once past the max age", () => {
    expect(shouldKeepStale(snapshotAt(0), 60_001, 60_000)).toBe(false);
  });
});
