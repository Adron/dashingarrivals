// Agency configuration and OneBusAway (OBA) feed URL helpers.
//
// The Puget Sound OBA regional API aggregates most agencies behind a single key.
// Agency IDs below are the OBA ids; they should be verified against
// `api/where/agencies-with-coverage.json` (Community Transit's id was ambiguous
// in research). Only `enabled` agencies are polled in the current phase.

import type { VehicleType } from "@/lib/types";

export interface AgencyConfig {
  /** Internal code, also used as the vehicle id prefix. */
  code: string;
  name: string;
  /** OneBusAway agency id (for the regional API). */
  obaId?: string;
  /** Vehicle type used when the GTFS route lookup can't resolve a route_type. */
  defaultType: VehicleType;
  /** Whether this agency is polled in the current phase. */
  enabled: boolean;
}

export const AGENCIES: AgencyConfig[] = [
  { code: "KCM", name: "King County Metro", obaId: "1", defaultType: "bus", enabled: true },
  // Sound Transit's realtime feed is mostly ST Express (bus) + Sounder; Link
  // light-rail positions are partial. Default to bus; the routes lookup upgrades
  // Sounder/Link to "train".
  { code: "ST", name: "Sound Transit", obaId: "40", defaultType: "bus", enabled: true },
  { code: "CT", name: "Community Transit", obaId: "29", defaultType: "bus", enabled: true },
  { code: "PT", name: "Pierce Transit", obaId: "3", defaultType: "bus", enabled: true },
  { code: "KT", name: "Kitsap Transit", obaId: "20", defaultType: "bus", enabled: true },
  { code: "ET", name: "Everett Transit", obaId: "97", defaultType: "bus", enabled: true },

  // Not yet enabled (Olympia area).
  { code: "IT", name: "Intercity Transit", obaId: "19", defaultType: "bus", enabled: false },
];

export const ENABLED_AGENCIES = AGENCIES.filter((a) => a.enabled);

/** GTFS-realtime VehiclePositions protobuf export endpoint for an OBA agency. */
export function obaVehiclePositionsUrl(baseUrl: string, obaId: string, apiKey: string): string {
  const url = new URL(
    `/api/gtfs_realtime/vehicle-positions-for-agency/${obaId}.pb`,
    baseUrl,
  );
  url.searchParams.set("key", apiKey);
  return url.toString();
}
