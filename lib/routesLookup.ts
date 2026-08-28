// Loads the committed GTFS route metadata (data/routes.json, produced by
// scripts/build-routes.mjs) and exposes a per-agency RoutesLookup so vehicles get
// human route labels and a correct type (Link/Sounder → train, ferries → ferry).

import routesData from "@/data/routes.json";
import type { RoutesLookup } from "@/lib/gtfs/normalize";
import type { VehicleType } from "@/lib/types";

interface RawRoute {
  shortName?: string;
  longName?: string;
  type: number;
  color?: string;
}

const data = routesData as unknown as Record<string, Record<string, RawRoute>>;

// GTFS `route_type` → our coarse vehicle type.
//   0 tram / streetcar / light rail, 1 subway, 2 rail, 5 cable, 7 funicular,
//   12 monorail, 900–999 (extended rail) → train
//   4 ferry, 1000–1299 (extended water) → ferry
//   3 bus, 11 trolleybus, everything else → bus
export function gtfsTypeToVehicleType(type: number): VehicleType {
  if (type === 4 || (type >= 1000 && type < 1300)) return "ferry";
  if (
    type === 0 ||
    type === 1 ||
    type === 2 ||
    type === 5 ||
    type === 7 ||
    type === 12 ||
    (type >= 900 && type < 1000)
  ) {
    return "train";
  }
  return "bus";
}

const cache: Record<string, RoutesLookup> = {};

/** Route lookup for one agency, keyed by the (unprefixed) GTFS-RT route id. */
export function routesForAgency(agencyCode: string): RoutesLookup {
  const cached = cache[agencyCode];
  if (cached) return cached;

  const routes = data[agencyCode];
  const lookup: RoutesLookup = {};
  if (routes) {
    for (const [id, r] of Object.entries(routes)) {
      lookup[id] = {
        shortName: r.shortName || r.longName,
        type: gtfsTypeToVehicleType(r.type),
      };
    }
  }
  cache[agencyCode] = lookup;
  return lookup;
}
