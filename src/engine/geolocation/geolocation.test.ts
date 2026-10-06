import { isValidLocation, loadSavedLocation, requestLocation, saveLocation } from "./geolocation";

function memoryStorage(initial: Record<string, string> = {}): {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
} {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

describe("geolocation", () => {
  it("resolves coordinates from the provider", async () => {
    const loc = await requestLocation({
      getCurrentPosition: (success) =>
        success({ coords: { latitude: 35.1, longitude: 139.2 } }),
    });
    expect(loc).toEqual({ lat: 35.1, lng: 139.2 });
  });

  it("resolves null on provider error (denied/timeout)", async () => {
    const loc = await requestLocation({
      getCurrentPosition: (_s, error) => error(new Error("denied")),
    });
    expect(loc).toBeNull();
  });

  it("resolves null when the API is missing entirely", async () => {
    expect(await requestLocation(undefined)).toBeNull();
  });

  it("treats a non-finite or out-of-range fix from the provider as a failure", async () => {
    for (const coords of [
      { latitude: Number.NaN, longitude: 139.2 },
      { latitude: 35.1, longitude: Number.POSITIVE_INFINITY },
      { latitude: 91, longitude: 0 },
      { latitude: 0, longitude: -181 },
    ]) {
      const loc = await requestLocation({
        getCurrentPosition: (success) => success({ coords }),
      });
      expect(loc, JSON.stringify(coords)).toBeNull();
    }
  });

  it("isValidLocation accepts only finite in-range numeric pairs", () => {
    expect(isValidLocation({ lat: 90, lng: -180 })).toBe(true);
    expect(isValidLocation({ lat: 0, lng: 0 })).toBe(true);
    expect(isValidLocation(null)).toBe(false);
    expect(isValidLocation("35,139")).toBe(false);
    expect(isValidLocation({ lat: "35", lng: 139 })).toBe(false);
    expect(isValidLocation({ lat: 35 })).toBe(false);
    expect(isValidLocation({ lat: Number.NaN, lng: 139 })).toBe(false);
    expect(isValidLocation({ lat: 90.0001, lng: 0 })).toBe(false);
    expect(isValidLocation({ lat: 0, lng: 180.0001 })).toBe(false);
  });

  it("save/load round-trips through storage", () => {
    const storage = memoryStorage();
    saveLocation(storage, { lat: -33.8688, lng: 151.2093 });
    expect(loadSavedLocation(storage)).toEqual({ lat: -33.8688, lng: 151.2093 });
  });

  it("load returns null for absent, corrupt or out-of-range data", () => {
    expect(loadSavedLocation(memoryStorage())).toBeNull();
    expect(
      loadSavedLocation(memoryStorage({ "lumen-bloom:location": "not json{" })),
    ).toBeNull();
    expect(
      loadSavedLocation(memoryStorage({ "lumen-bloom:location": '{"lat":999,"lng":0}' })),
    ).toBeNull();
    expect(
      loadSavedLocation(memoryStorage({ "lumen-bloom:location": '{"lat":"35","lng":139}' })),
    ).toBeNull();
    expect(
      loadSavedLocation(memoryStorage({ "lumen-bloom:location": "null" })),
    ).toBeNull();
    expect(
      loadSavedLocation(memoryStorage({ "lumen-bloom:location": "[35,139]" })),
    ).toBeNull();
  });

  it("load copies only lat/lng out of stored JSON (extra keys never travel further)", () => {
    const stored = '{"lat":35.1,"lng":139.2,"__proto__":{"polluted":1},"extra":"x"}';
    const loc = loadSavedLocation(memoryStorage({ "lumen-bloom:location": stored }));
    expect(loc).toEqual({ lat: 35.1, lng: 139.2 });
    expect(Object.keys(loc ?? {})).toEqual(["lat", "lng"]);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });
});
