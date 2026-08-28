import { describe, expect, it } from "vitest";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { decodeAlerts, isActive } from "@/lib/gtfs/alerts";
import type { Alert } from "@/lib/types";

const { FeedMessage } = GtfsRealtimeBindings.transit_realtime;

function encode(entities: unknown[]): Uint8Array {
  const msg = FeedMessage.fromObject({
    header: { gtfsRealtimeVersion: "2.0" },
    entity: entities,
  });
  return FeedMessage.encode(msg).finish();
}

describe("decodeAlerts", () => {
  it("normalizes an alert and reconstructs agency-prefixed ids", () => {
    const bytes = encode([
      {
        id: "1_999",
        alert: {
          activePeriod: [{ start: 1000, end: 2000 }],
          informedEntity: [{ agencyId: "1", routeId: "100264", stopId: "10190" }],
          headerText: { translation: [{ text: "Route 70 detour" }] },
          descriptionText: { translation: [{ text: "Rerouted off Fairview" }] },
          url: { translation: [{ text: "https://example.com" }] },
          effect: 4, // DETOUR
          severityLevel: 3,
        },
      },
    ]);

    const [a] = decodeAlerts(bytes, "KCM");
    expect(a.id).toBe("1_999");
    expect(a.agency).toBe("KCM");
    expect(a.header).toBe("Route 70 detour");
    expect(a.effect).toBe("Detour");
    expect(a.routeIds).toContain("1_100264");
    expect(a.stopIds).toContain("1_10190");
    expect(a.activePeriods[0]).toEqual({ start: 1_000_000, end: 2_000_000 });
  });

  it("skips entities without an alert header", () => {
    const bytes = encode([
      { id: "vehicle", vehicle: { vehicle: { id: "v" } } },
      { id: "noheader", alert: { informedEntity: [{ agencyId: "1" }] } },
    ]);
    expect(decodeAlerts(bytes, "KCM")).toHaveLength(0);
  });
});

describe("isActive", () => {
  const base: Omit<Alert, "activePeriods"> = {
    id: "x",
    agency: "KCM",
    header: "h",
    routeIds: [],
    stopIds: [],
  };

  it("respects active periods", () => {
    const now = 1500 * 1000;
    expect(isActive({ ...base, activePeriods: [{ start: 1000 * 1000, end: 2000 * 1000 }] }, now)).toBe(true);
    expect(isActive({ ...base, activePeriods: [{ start: 1600 * 1000, end: 2000 * 1000 }] }, now)).toBe(false);
  });

  it("is active when there are no periods", () => {
    expect(isActive({ ...base, activePeriods: [] }, Date.now())).toBe(true);
  });
});
