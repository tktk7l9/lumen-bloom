// Open-Meteo current-weather client — free, no API key, CORS-enabled.
// https://open-meteo.com/en/docs

import type { GeoLocation } from "../astro/types";
import { wmoToCondition } from "./mapping";
import type { WeatherFetchResult, WeatherSnapshot } from "./types";

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";
// A poll that never answers must not hang the weather loop until the next
// interval fires on top of it; a stalled connection is treated like a
// network failure (the last good snapshot is kept, see staleness.ts).
export const WEATHER_TIMEOUT_MS = 10_000;
// A current-weather reply is a few hundred bytes. Anything beyond this is
// not the shape we asked for and is rejected before it reaches JSON.parse.
export const WEATHER_MAX_BODY_BYTES = 64 * 1024;

/** Pure URL builder — no network, so it's directly assertable in tests. */
export function buildWeatherUrl(loc: GeoLocation): string {
  const params = new URLSearchParams({
    latitude: loc.lat.toFixed(4),
    longitude: loc.lng.toFixed(4),
    current: "weather_code,cloud_cover,precipitation,temperature_2m,is_day",
    timezone: "auto",
  });
  return `${ENDPOINT}?${params.toString()}`;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Shape-validates and converts an Open-Meteo response body (pure, no network). */
export function parseWeatherResponse(json: unknown, fetchedAt: number = Date.now()): WeatherFetchResult {
  if (typeof json !== "object" || json === null) return { ok: false, error: "parse" };

  const current = (json as { current?: unknown }).current;
  if (typeof current !== "object" || current === null) return { ok: false, error: "parse" };

  const { weather_code, cloud_cover, precipitation, temperature_2m, is_day } = current as Record<string, unknown>;
  if (
    !isFiniteNumber(weather_code) ||
    !isFiniteNumber(cloud_cover) ||
    !isFiniteNumber(precipitation) ||
    !isFiniteNumber(temperature_2m) ||
    !isFiniteNumber(is_day)
  ) {
    return { ok: false, error: "parse" };
  }

  const snapshot: WeatherSnapshot = {
    condition: wmoToCondition(weather_code),
    cloudCoverPct: cloud_cover,
    precipitationMm: precipitation,
    temperatureC: temperature_2m,
    isDay: is_day === 1,
    fetchedAt,
  };
  return { ok: true, snapshot };
}

export interface WeatherFetchOptions {
  /** DI hook so this is testable without a real network call. */
  fetchImpl?: typeof fetch;
  /** Caller-owned abort signal; without one the request times out on its own. */
  signal?: AbortSignal;
}

export async function fetchCurrentWeather(
  loc: GeoLocation,
  opts: WeatherFetchOptions = {},
): Promise<WeatherFetchResult> {
  const doFetch = opts.fetchImpl ?? fetch;

  const signal = opts.signal ?? AbortSignal.timeout(WEATHER_TIMEOUT_MS);

  let response: Response;
  try {
    response = await doFetch(buildWeatherUrl(loc), { signal });
  } catch {
    return { ok: false, error: "network" };
  }

  if (!response.ok) return { ok: false, error: "http" };

  let json: unknown;
  try {
    const text = await response.text();
    if (text.length > WEATHER_MAX_BODY_BYTES) return { ok: false, error: "parse" };
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "parse" };
  }

  return parseWeatherResponse(json);
}
