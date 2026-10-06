// GPS + persistence wrappers. Browser APIs are injected so the logic is
// fully testable in node (and the UI can pass the real ones).

import type { GeoLocation } from "../astro/types";

const STORAGE_KEY = "lumen-bloom:location";

/** True for a finite lat/lng pair inside the valid ranges (the only shape that
 *  may reach the weather URL or persistence). */
export function isValidLocation(v: unknown): v is GeoLocation {
  if (typeof v !== "object" || v === null) return false;
  const { lat, lng } = v as { lat?: unknown; lng?: unknown };
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

export interface GeoProviderLike {
  getCurrentPosition(
    success: (pos: { coords: { latitude: number; longitude: number } }) => void,
    error: (err: unknown) => void,
    options?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number },
  ): void;
}

/** Resolve the device location, or null on denial/timeout/absence. */
export function requestLocation(
  geo: GeoProviderLike | undefined,
  timeoutMs = 10_000,
): Promise<GeoLocation | null> {
  if (!geo) return Promise.resolve(null);
  return new Promise((resolve) => {
    geo.getCurrentPosition(
      (pos) => {
        // A provider is not trusted to hand back a usable pair: anything
        // non-finite or out of range is treated like a failed fix instead of
        // being persisted and sent to the weather API.
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        resolve(isValidLocation(loc) ? loc : null);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 300_000 },
    );
  });
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function saveLocation(storage: StorageLike, loc: GeoLocation): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(loc));
}

export function loadSavedLocation(storage: Pick<Storage, "getItem">): GeoLocation | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    // Only the two coordinates are copied out, so extra keys in tampered
    // storage never travel further.
    if (isValidLocation(v)) return { lat: v.lat, lng: v.lng };
  } catch {
    // fall through — corrupt storage is treated as absent
  }
  return null;
}
