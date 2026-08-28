import { describe, expect, it } from "vitest";
import { normalizeAgencyVehicles } from "@/lib/gtfs/normalize";
import type { AgencyConfig } from "@/lib/agencies";
import type { RawVehicle } from "@/lib/gtfs/decode";

const KCM: AgencyConfig = {
  code: "KCM",
  name: "King County Metro",
  obaId: "1",
  defaultType: "bus",
  enabled: true,
};

describe("normalizeAgencyVehicles", () => {
  it("prefixes ids, maps timestamps to ms, and applies the default type", () => {
    const raw: RawVehicle[] = [
      { vehicleId: "v1", routeId: "R1", lat: 47.6, lon: -122.3, timestamp: 1_700_000_000 },
    ];
    const [v] = normalizeAgencyVehicles(raw, KCM);
    expect(v.id).toBe("KCM_v1");
    expect(v.agency).toBe("KCM");
    expect(v.type).toBe("bus");
    expect(v.routeShortName).toBe("R1");
    expect(v.timestamp).toBe(1_700_000_000 * 1000);
  });

  it("prefers the routes lookup for short name and type", () => {
    const raw: RawVehicle[] = [{ vehicleId: "v9", routeId: "LINK", lat: 47.6, lon: -122.33 }];
    const [v] = normalizeAgencyVehicles(raw, KCM, {
      LINK: { shortName: "1 Line", type: "train" },
    });
    expect(v.type).toBe("train");
    expect(v.routeShortName).toBe("1 Line");
  });

  it("drops vehicles with out-of-region or invalid coordinates", () => {
    const raw: RawVehicle[] = [
      { vehicleId: "bad", lat: 0, lon: 0 },
      { vehicleId: "nan", lat: Number.NaN, lon: -122 },
      { vehicleId: "far", lat: 40.7, lon: -74 }, // NYC
    ];
    expect(normalizeAgencyVehicles(raw, KCM)).toHaveLength(0);
  });
});
