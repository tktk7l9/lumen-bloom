/** Observer location in degrees; east longitudes positive. */
export interface GeoLocation {
  lat: number;
  lng: number;
}

/** Equatorial coordinates in degrees. */
export interface Equatorial {
  ra: number;
  dec: number;
}

/** Horizontal coordinates in degrees. Azimuth: N=0°, clockwise (E=90°). */
export interface Horizontal {
  azimuth: number;
  altitude: number;
}
