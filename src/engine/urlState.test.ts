import { parseUrlOverrides } from "./urlState";

const NOW = 1_784_000_000_000;

describe("parseUrlOverrides", () => {
  it("returns all-null for an empty query", () => {
    expect(parseUrlOverrides("", NOW)).toEqual({
      location: null,
      timeOffsetMs: null,
      objectId: null,
      hud: null,
      info: null,
    });
  });

  it("parses a valid lat/lng pair", () => {
    const o = parseUrlOverrides("?lat=-33.8688&lng=151.2093", NOW);
    expect(o.location).toEqual({ lat: -33.8688, lng: 151.2093 });
  });

  it("rejects lat without lng, out-of-range, and non-numeric coordinates", () => {
    expect(parseUrlOverrides("?lat=35", NOW).location).toBeNull();
    expect(parseUrlOverrides("?lng=139", NOW).location).toBeNull();
    expect(parseUrlOverrides("?lat=91&lng=0", NOW).location).toBeNull();
    expect(parseUrlOverrides("?lat=0&lng=181", NOW).location).toBeNull();
    expect(parseUrlOverrides("?lat=abc&lng=139", NOW).location).toBeNull();
  });

  it("turns t= into an offset from now", () => {
    const target = Date.parse("2026-01-01T20:00:00Z");
    const o = parseUrlOverrides("?t=2026-01-01T20:00:00Z", NOW);
    expect(o.timeOffsetMs).toBe(target - NOW);
  });

  it("ignores an unparsable t=", () => {
    expect(parseUrlOverrides("?t=not-a-date", NOW).timeOffsetMs).toBeNull();
  });

  it("accepts a kebab-case object id and rejects anything else", () => {
    expect(parseUrlOverrides("?obj=vase-tulips", NOW).objectId).toBe("vase-tulips");
    expect(parseUrlOverrides("?obj=Weird%20Name", NOW).objectId).toBeNull();
  });

  it("parses the hud flag tri-state", () => {
    expect(parseUrlOverrides("?hud=1", NOW).hud).toBe(true);
    expect(parseUrlOverrides("?hud=0", NOW).hud).toBe(false);
    expect(parseUrlOverrides("?hud=2", NOW).hud).toBeNull();
    expect(parseUrlOverrides("", NOW).hud).toBeNull();
  });

  it("parses the info flag tri-state", () => {
    expect(parseUrlOverrides("?info=1", NOW).info).toBe(true);
    expect(parseUrlOverrides("?info=0", NOW).info).toBe(false);
    expect(parseUrlOverrides("?info=x", NOW).info).toBeNull();
  });
});
