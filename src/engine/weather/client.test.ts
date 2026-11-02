import {
  WEATHER_MAX_BODY_BYTES,
  buildWeatherUrl,
  fetchCurrentWeather,
  parseWeatherResponse,
} from "./client";

const TOKYO = { lat: 35.6762, lng: 139.6503 };

describe("buildWeatherUrl", () => {
  it("includes rounded coordinates and the expected current fields", () => {
    const url = buildWeatherUrl(TOKYO);
    expect(url).toContain("https://api.open-meteo.com/v1/forecast?");
    expect(url).toContain("latitude=35.6762");
    expect(url).toContain("longitude=139.6503");
    expect(url).toContain("current=weather_code%2Ccloud_cover%2Cprecipitation%2Ctemperature_2m%2Cis_day");
  });
});

const VALID_BODY = {
  current: {
    weather_code: 61,
    cloud_cover: 80,
    precipitation: 1.2,
    temperature_2m: 18.4,
    is_day: 1,
  },
};

describe("parseWeatherResponse", () => {
  it("parses a valid Open-Meteo response into a snapshot", () => {
    const result = parseWeatherResponse(VALID_BODY, 12345);
    expect(result).toEqual({
      ok: true,
      snapshot: {
        condition: "rain",
        cloudCoverPct: 80,
        precipitationMm: 1.2,
        temperatureC: 18.4,
        isDay: true,
        fetchedAt: 12345,
      },
    });
  });

  it("treats is_day 0 as night", () => {
    const result = parseWeatherResponse({ current: { ...VALID_BODY.current, is_day: 0 } });
    expect(result.ok && result.snapshot.isDay).toBe(false);
  });

  it("rejects a non-object top level", () => {
    expect(parseWeatherResponse(null)).toEqual({ ok: false, error: "parse" });
    expect(parseWeatherResponse("nope")).toEqual({ ok: false, error: "parse" });
  });

  it("rejects a missing or malformed current block", () => {
    expect(parseWeatherResponse({})).toEqual({ ok: false, error: "parse" });
    expect(parseWeatherResponse({ current: null })).toEqual({ ok: false, error: "parse" });
  });

  it("rejects when any required field is missing or the wrong type", () => {
    for (const key of ["weather_code", "cloud_cover", "precipitation", "temperature_2m", "is_day"]) {
      const body = { current: { ...VALID_BODY.current, [key]: "not-a-number" } };
      expect(parseWeatherResponse(body)).toEqual({ ok: false, error: "parse" });
    }
  });

  it("defaults fetchedAt to now when omitted", () => {
    const before = Date.now();
    const result = parseWeatherResponse(VALID_BODY);
    const after = Date.now();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.fetchedAt).toBeGreaterThanOrEqual(before);
      expect(result.snapshot.fetchedAt).toBeLessThanOrEqual(after);
    }
  });
});

type FakeResponse = { ok: boolean; text(): Promise<string> };

function fakeFetch(impl: (url: string, init?: RequestInit) => Promise<FakeResponse>): typeof fetch {
  return impl as unknown as typeof fetch;
}

function okBody(body: unknown): FakeResponse {
  return { ok: true, text: async () => JSON.stringify(body) };
}

describe("fetchCurrentWeather", () => {
  it("resolves a snapshot on a successful, well-formed response", async () => {
    const fetchImpl = fakeFetch(async () => okBody(VALID_BODY));
    const result = await fetchCurrentWeather(TOKYO, { fetchImpl });
    expect(result.ok).toBe(true);
  });

  it("times out on its own when the caller passes no signal", async () => {
    let seen: AbortSignal | null | undefined;
    const fetchImpl = fakeFetch(async (_url, init) => {
      seen = init?.signal;
      return okBody(VALID_BODY);
    });
    await fetchCurrentWeather(TOKYO, { fetchImpl });
    expect(seen).toBeInstanceOf(AbortSignal);
    expect(seen?.aborted).toBe(false);
  });

  it("forwards a caller-owned signal instead of its own timeout", async () => {
    const controller = new AbortController();
    let seen: AbortSignal | null | undefined;
    const fetchImpl = fakeFetch(async (_url, init) => {
      seen = init?.signal;
      return okBody(VALID_BODY);
    });
    await fetchCurrentWeather(TOKYO, { fetchImpl, signal: controller.signal });
    expect(seen).toBe(controller.signal);
  });

  it("reports 'network' when the request is aborted (timeout)", async () => {
    const fetchImpl = fakeFetch(async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    });
    const result = await fetchCurrentWeather(TOKYO, { fetchImpl });
    expect(result).toEqual({ ok: false, error: "network" });
  });

  it("rejects a body larger than the bound before parsing it", async () => {
    const huge = JSON.stringify(VALID_BODY).padEnd(WEATHER_MAX_BODY_BYTES + 1, " ");
    const fetchImpl = fakeFetch(async () => ({ ok: true, text: async () => huge }));
    const result = await fetchCurrentWeather(TOKYO, { fetchImpl });
    expect(result).toEqual({ ok: false, error: "parse" });
  });

  it("reports 'network' when the fetch call itself rejects", async () => {
    const fetchImpl = fakeFetch(async () => {
      throw new Error("offline");
    });
    const result = await fetchCurrentWeather(TOKYO, { fetchImpl });
    expect(result).toEqual({ ok: false, error: "network" });
  });

  it("reports 'http' on a non-ok response", async () => {
    const fetchImpl = fakeFetch(async () => ({ ok: false, text: async () => "{}" }));
    const result = await fetchCurrentWeather(TOKYO, { fetchImpl });
    expect(result).toEqual({ ok: false, error: "http" });
  });

  it("reports 'parse' when the body isn't valid JSON", async () => {
    const fetchImpl = fakeFetch(async () => ({ ok: true, text: async () => "{not json" }));
    const result = await fetchCurrentWeather(TOKYO, { fetchImpl });
    expect(result).toEqual({ ok: false, error: "parse" });
  });

  it("uses the global fetch when no fetchImpl is provided", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fakeFetch(async () => okBody(VALID_BODY));
    try {
      const result = await fetchCurrentWeather(TOKYO);
      expect(result.ok).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
