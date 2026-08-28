// Normalize raw agency vehicles into the shared Vehicle model:
// agency-prefixed ids, resolved vehicle type, and millisecond timestamps.

import type { AgencyConfig } from "@/lib/agencies";
import type { RawVehicle } from "@/lib/gtfs/decode";
import type { Vehicle, VehicleType } from "@/lib/types";

export interface RouteInfo {
  shortName?: string;
  type?: VehicleType;
}

/** routeId -> route metadata, sourced from the consolidated GTFS (later phase). */
export type RoutesLookup = Record<string, RouteInfo>;

// Loose Puget Sound / PNW bounding box to drop obviously-bad coordinates (0,0 etc).
const MIN_LAT = 45;
const MAX_LAT = 50;
const MIN_LON = -125;
const MAX_LON = -119;

function inRegion(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= MIN_LAT &&
    lat <= MAX_LAT &&
    lon >= MIN_LON &&
    lon <= MAX_LON
  );
}

export function normalizeAgencyVehicles(
  raw: RawVehicle[],
  agency: AgencyConfig,
  routes?: RoutesLookup,
): Vehicle[] {
  const out: Vehicle[] = [];

  for (const r of raw) {
    if (!inRegion(r.lat, r.lon)) continue;

    const route = r.routeId ? routes?.[r.routeId] : undefined;
    const localId = r.vehicleId ?? `${r.routeId ?? "x"}-${r.lat.toFixed(4)}-${r.lon.toFixed(4)}`;

    out.push({
      id: `${agency.code}_${localId}`,
      agency: agency.code,
      agencyName: agency.name,
      type: route?.type ?? agency.defaultType,
      routeId: r.routeId,
      routeShortName: route?.shortName ?? r.routeId,
      tripId: r.tripId,
      lat: r.lat,
      lon: r.lon,
      bearing: r.bearing,
      speed: r.speed,
      // GTFS-RT reports epoch *seconds*; the app works in milliseconds.
      timestamp: r.timestamp != null ? r.timestamp * 1000 : Date.now(),
    });
  }

  return out;
}
