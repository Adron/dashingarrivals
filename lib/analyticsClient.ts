"use client";

// Shared, guarded client-side event sender for first-party analytics.
// Used by the global AnalyticsTracker (pageviews + generic DOM clicks) and by
// the map, which emits explicit vehicle/route clicks that happen on the MapLibre
// WebGL canvas rather than on labeled DOM elements. All sends are fire-and-forget
// and wrapped so a tracking hiccup can never break the page.

const ENDPOINT = "/api/analytics/track";

export function track(payload: Record<string, unknown>): void {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      body,
      keepalive: true,
      headers: { "Content-Type": "application/json" },
    }).catch(() => {});
  } catch {
    // Never throw from tracking.
  }
}

function currentPath(): string {
  return typeof window !== "undefined" ? window.location.pathname : "/";
}

function str(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

/** Fields read from a clicked vehicle's map feature properties. */
export interface VehicleClickInfo {
  agency?: unknown;
  routeId?: unknown;
  routeShortName?: unknown;
  vehicleNumber?: unknown;
}

/** Record a click on a specific live vehicle. */
export function trackVehicleClick(v: VehicleClickInfo): void {
  track({
    type: "click",
    category: "vehicle",
    path: currentPath(),
    agency: str(v.agency),
    routeId: str(v.routeId),
    routeShortName: str(v.routeShortName),
    vehicleNumber: str(v.vehicleNumber),
  });
}

/** Record opening a route overlay — i.e. a click on a specific route. */
export function trackRouteOpen(r: {
  agency?: unknown;
  routeId?: unknown;
  routeShortName?: unknown;
}): void {
  track({
    type: "click",
    category: "route",
    path: currentPath(),
    agency: str(r.agency),
    routeId: str(r.routeId),
    routeShortName: str(r.routeShortName),
  });
}

/** utm_source from the current URL, for pageview traffic-source attribution. */
export function readUtmSource(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return str(new URLSearchParams(window.location.search).get("utm_source"));
  } catch {
    return undefined;
  }
}
