// Decode GTFS-realtime service-alert protobuf feeds into normalized Alerts.
//
// informedEntity route/stop ids are UNPREFIXED, but carry an agencyId — so we
// reconstruct the agency-prefixed ids ("<agencyId>_<id>") to match the stop and
// arrival ids used elsewhere in the app.

import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import type { Alert } from "@/lib/types";

// Loose shape compatible with the (nullable) gtfs-realtime-bindings types.
type MaybeTranslated =
  | { translation?: Array<{ text?: string | null } | null> | null }
  | null
  | undefined;

function firstText(t: MaybeTranslated): string | undefined {
  return t?.translation?.[0]?.text || undefined;
}

// GTFS-realtime Alert.Effect → label.
const EFFECT_LABELS: Record<number, string> = {
  1: "No service",
  2: "Reduced service",
  3: "Significant delays",
  4: "Detour",
  5: "Additional service",
  6: "Modified service",
  7: "Alert",
  8: "Alert",
  9: "Stop moved",
  10: "No effect",
  11: "Accessibility issue",
};

export function decodeAlerts(bytes: Uint8Array, agencyCode: string): Alert[] {
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(bytes);
  const out: Alert[] = [];

  for (const entity of feed.entity) {
    const a = entity.alert;
    if (!a) continue;
    const header = firstText(a.headerText);
    if (!header) continue;

    const routeIds = new Set<string>();
    const stopIds = new Set<string>();
    for (const ie of a.informedEntity ?? []) {
      const ag = ie.agencyId != null ? String(ie.agencyId) : "";
      if (ie.routeId) routeIds.add(ag ? `${ag}_${ie.routeId}` : ie.routeId);
      if (ie.stopId) stopIds.add(ag ? `${ag}_${ie.stopId}` : ie.stopId);
    }

    const activePeriods = (a.activePeriod ?? []).map((p) => ({
      // GTFS-RT timestamps are epoch seconds.
      start: p.start != null ? Number(p.start) * 1000 : undefined,
      end: p.end != null ? Number(p.end) * 1000 : undefined,
    }));

    out.push({
      id: entity.id,
      agency: agencyCode,
      header,
      description: firstText(a.descriptionText),
      url: firstText(a.url),
      effect: a.effect != null ? EFFECT_LABELS[Number(a.effect)] : undefined,
      severity: a.severityLevel != null ? Number(a.severityLevel) : undefined,
      routeIds: [...routeIds],
      stopIds: [...stopIds],
      activePeriods,
    });
  }

  return out;
}

/** An alert is active if any of its periods contains `now` (or it has none). */
export function isActive(alert: Alert, now: number): boolean {
  if (alert.activePeriods.length === 0) return true;
  return alert.activePeriods.some(
    (p) => (p.start == null || now >= p.start) && (p.end == null || now <= p.end),
  );
}
