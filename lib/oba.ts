// OneBusAway REST (api/where) client for stops and real-time arrivals.
// Server-side only.

import { config } from "@/lib/config";
import { decodePolyline } from "@/lib/polyline";
import type { Arrival, Stop, StopArrivals } from "@/lib/types";

function obaUrl(path: string, params: Record<string, string | number> = {}): string {
  const url = new URL(`/api/where/${path}`, config.obaBaseUrl);
  url.searchParams.set("key", config.obaApiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  return url.toString();
}

interface ObaStop {
  id: string;
  code?: string;
  name?: string;
  lat: number;
  lon: number;
  direction?: string;
  routeIds?: string[];
}

interface ObaArrival {
  routeId?: string;
  routeShortName?: string;
  routeLongName?: string;
  tripHeadsign?: string;
  predicted?: boolean;
  predictedArrivalTime?: number;
  scheduledArrivalTime?: number;
  status?: string;
}

interface ObaRouteRef {
  id: string;
  shortName?: string;
  longName?: string;
  color?: string;
}

/** A route's full geometry (all direction patterns) plus its stops. */
export interface RouteShape {
  routeId: string;
  shortName?: string;
  /** GTFS route color as a hex string (with leading #), if the feed provides one. */
  color?: string;
  path: GeoJSON.MultiLineString;
  stops: Stop[];
}

/** Stops within a bounding box (center + spans), for the current map viewport. */
export async function fetchStopsForLocation(q: {
  lat: number;
  lon: number;
  latSpan: number;
  lonSpan: number;
}): Promise<Stop[]> {
  const res = await fetch(obaUrl("stops-for-location.json", q), { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const list: ObaStop[] = json?.data?.list ?? [];
  return list.map((s) => ({
    id: s.id,
    code: s.code ?? "",
    name: s.name ?? "",
    lat: s.lat,
    lon: s.lon,
    direction: s.direction || undefined,
    routeIds: s.routeIds ?? [],
  }));
}

/** Real-time arrivals/departures for a stop, soonest first. */
export async function fetchArrivals(stopId: string): Promise<StopArrivals> {
  const path = `arrivals-and-departures-for-stop/${encodeURIComponent(stopId)}.json`;
  const res = await fetch(obaUrl(path), { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  const entry = json?.data?.entry;
  const refStops: ObaStop[] = json?.data?.references?.stops ?? [];
  const stop = refStops.find((s) => s.id === entry?.stopId);
  const raw: ObaArrival[] = entry?.arrivalsAndDepartures ?? [];

  const arrivals: Arrival[] = raw
    .map((a) => {
      const scheduledTime = a.scheduledArrivalTime ?? 0;
      const predicted = !!a.predicted && !!a.predictedArrivalTime;
      return {
        routeId: a.routeId,
        routeShortName: a.routeShortName || a.routeLongName || "",
        headsign: a.tripHeadsign || "",
        predicted,
        arrivalTime: predicted ? (a.predictedArrivalTime as number) : scheduledTime,
        scheduledTime,
        status: a.status,
      };
    })
    .filter((a) => a.arrivalTime > 0)
    .sort((a, b) => a.arrivalTime - b.arrivalTime);

  return { stopName: stop?.name, stopCode: stop?.code, arrivals };
}

/**
 * Full shape + stops for a route (OBA route id, e.g. "1_100001"). The response's
 * polylines cover every direction/pattern; they're decoded into one
 * MultiLineString. Stops come from the entry's stopIds resolved via references.
 */
export async function fetchRouteShape(routeId: string): Promise<RouteShape> {
  const path = `stops-for-route/${encodeURIComponent(routeId)}.json`;
  const res = await fetch(obaUrl(path, { includePolylines: "true" }), { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  const entry = json?.data?.entry ?? {};
  const polylines: { points?: string }[] = entry.polylines ?? [];
  const coordinates = polylines
    .map((p) => (p.points ? decodePolyline(p.points) : []))
    .filter((line) => line.length > 1);

  const refStops: ObaStop[] = json?.data?.references?.stops ?? [];
  const byId = new Map(refStops.map((s) => [s.id, s]));
  const stopIds: string[] = entry.stopIds ?? [];
  const stops: Stop[] = stopIds
    .map((id) => byId.get(id))
    .filter((s): s is ObaStop => !!s)
    .map((s) => ({
      id: s.id,
      code: s.code ?? "",
      name: s.name ?? "",
      lat: s.lat,
      lon: s.lon,
      direction: s.direction || undefined,
      routeIds: s.routeIds ?? [],
    }));

  const routeRef: ObaRouteRef | undefined = (json?.data?.references?.routes ?? []).find(
    (r: ObaRouteRef) => r.id === routeId,
  );

  return {
    routeId,
    shortName: routeRef?.shortName || routeRef?.longName,
    color: routeRef?.color ? `#${routeRef.color}` : undefined,
    path: { type: "MultiLineString", coordinates },
    stops,
  };
}
