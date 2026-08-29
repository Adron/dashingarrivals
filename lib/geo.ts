// Small geo helpers for deriving a vehicle's heading from its movement when the
// feed doesn't report a usable bearing.

export interface LatLon {
  lat: number;
  lon: number;
}

/** Compass bearing (degrees, 0 = north, clockwise) from `a` to `b`. */
export function bearingBetween(a: LatLon, b: LatLon): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const phi1 = toRad(a.lat);
  const phi2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Rough distance in meters (equirectangular approximation — fine at these scales). */
export function distanceMeters(a: LatLon, b: LatLon): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x = toRad(b.lon - a.lon) * Math.cos(toRad((a.lat + b.lat) / 2));
  const y = toRad(b.lat - a.lat);
  return Math.sqrt(x * x + y * y) * R;
}

/**
 * Resolve a heading for a vehicle: prefer the feed bearing; otherwise derive it
 * from movement (if it moved far enough to be meaningful); otherwise keep the
 * previous heading so idle vehicles don't snap to north.
 */
export function resolveBearing(
  feedBearing: number | undefined,
  prev: LatLon | undefined,
  next: LatLon,
  previousResolved: number | undefined,
  minMeters = 8,
): number {
  if (feedBearing != null && feedBearing !== 0) return feedBearing;
  if (prev && distanceMeters(prev, next) >= minMeters) return bearingBetween(prev, next);
  return previousResolved ?? feedBearing ?? 0;
}
