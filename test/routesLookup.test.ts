import { describe, expect, it } from "vitest";
import { gtfsTypeToVehicleType, routesForAgency } from "@/lib/routesLookup";

describe("gtfsTypeToVehicleType", () => {
  it("maps GTFS route_type to a coarse vehicle type", () => {
    expect(gtfsTypeToVehicleType(0)).toBe("train"); // light rail (Link)
    expect(gtfsTypeToVehicleType(2)).toBe("train"); // commuter rail (Sounder)
    expect(gtfsTypeToVehicleType(3)).toBe("bus");
    expect(gtfsTypeToVehicleType(11)).toBe("bus"); // trolleybus
    expect(gtfsTypeToVehicleType(4)).toBe("ferry");
  });
});

describe("routesForAgency", () => {
  it("labels Sound Transit rail routes as trains and buses as buses", () => {
    const st = routesForAgency("ST");
    expect(st["2LINE"]?.type).toBe("train");
    expect(st["2LINE"]?.shortName).toBe("2 Line");
    expect(st["560"]?.type).toBe("bus");
  });

  it("returns an empty lookup for unknown agencies", () => {
    expect(routesForAgency("NOPE")).toEqual({});
  });
});
