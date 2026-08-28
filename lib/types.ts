// Core domain types shared across server and client.

export type VehicleType = "bus" | "train" | "ferry";

/** A single transit vehicle, normalized across all agency feeds. */
export interface Vehicle {
  /** Agency-prefixed unique id, e.g. "KCM_1234", to avoid cross-feed collisions. */
  id: string;
  /** Agency code, e.g. "KCM". */
  agency: string;
  agencyName: string;
  type: VehicleType;
  routeId?: string;
  /** Human-facing route label (falls back to routeId until the GTFS lookup lands). */
  routeShortName?: string;
  tripId?: string;
  lat: number;
  lon: number;
  /** Heading in degrees (0 = north), if the agency reports it. */
  bearing?: number;
  /** Ground speed in m/s, if reported. */
  speed?: number;
  /** Epoch milliseconds of the last position report. */
  timestamp: number;
}

/** Per-agency fetch result, surfaced so the UI can show source health. */
export interface SourceStatus {
  agency: string;
  ok: boolean;
  count: number;
  error?: string;
}

/** The merged snapshot served to clients. */
export interface VehicleSnapshot {
  vehicles: Vehicle[];
  /** Epoch milliseconds the snapshot was built. */
  updatedAt: number;
  sources: SourceStatus[];
  /** True when the snapshot is synthetic mock data (dev / fallback). */
  mock?: boolean;
}

/** A transit stop (from OneBusAway stops-for-location). */
export interface Stop {
  /** OBA stop id, e.g. "1_1040". */
  id: string;
  /** Public stop number, e.g. "1040". */
  code: string;
  name: string;
  lat: number;
  lon: number;
  direction?: string;
  routeIds: string[];
}

/** One upcoming arrival at a stop. */
export interface Arrival {
  routeShortName: string;
  headsign: string;
  /** True when arrivalTime is a real-time prediction (vs. scheduled). */
  predicted: boolean;
  /** Epoch ms of the arrival (predicted when available, else scheduled). */
  arrivalTime: number;
  scheduledTime: number;
  status?: string;
}

/** Real-time arrivals for a single stop. */
export interface StopArrivals {
  stopName?: string;
  stopCode?: string;
  arrivals: Arrival[];
}
