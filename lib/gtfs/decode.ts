// Fetch and decode GTFS-realtime VehiclePositions protobuf feeds.
// Runs server-side only (protobuf decoding is not reliable on the edge runtime).

import GtfsRealtimeBindings from "gtfs-realtime-bindings";

/** A vehicle position as read straight from a GTFS-RT feed (pre-normalization). */
export interface RawVehicle {
  vehicleId?: string;
  /** Rider-facing fleet number from the feed (VehicleDescriptor.label), when provided. */
  vehicleLabel?: string;
  routeId?: string;
  tripId?: string;
  lat: number;
  lon: number;
  bearing?: number;
  speed?: number;
  /** Epoch seconds, as reported by the feed. */
  timestamp?: number;
}

/** Decode a VehiclePositions protobuf buffer into raw vehicle positions. */
export function decodeVehiclePositions(bytes: Uint8Array): RawVehicle[] {
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(bytes);
  const out: RawVehicle[] = [];

  for (const entity of feed.entity) {
    const v = entity.vehicle;
    const pos = v?.position;
    if (!v || !pos || pos.latitude == null || pos.longitude == null) continue;

    out.push({
      // `||` collapses GTFS-RT's empty-string defaults to undefined so downstream
      // fallbacks (entity.id, vehicle id) apply instead of yielding "".
      vehicleId: v.vehicle?.id || entity.id || undefined,
      vehicleLabel: v.vehicle?.label || undefined,
      routeId: v.trip?.routeId ?? undefined,
      tripId: v.trip?.tripId ?? undefined,
      lat: pos.latitude,
      lon: pos.longitude,
      bearing: pos.bearing ?? undefined,
      speed: pos.speed ?? undefined,
      // protobuf timestamps arrive as Long | number; Number() flattens both.
      timestamp: v.timestamp != null ? Number(v.timestamp) : undefined,
    });
  }

  return out;
}

/** Fetch a VehiclePositions feed and decode it. */
export async function fetchVehiclePositions(
  url: string,
  headers?: Record<string, string>,
): Promise<RawVehicle[]> {
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const buf = await res.arrayBuffer();
  return decodeVehiclePositions(new Uint8Array(buf));
}
