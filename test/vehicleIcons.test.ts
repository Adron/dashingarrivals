import { describe, expect, it } from "vitest";
import { buildIconId, parseIconId } from "@/lib/vehicleIcons";

describe("vehicle icon ids", () => {
  it("builds an id from agency + type", () => {
    expect(buildIconId("KCM", "bus")).toBe("veh-KCM-bus");
    expect(buildIconId("WSF", "ferry")).toBe("veh-WSF-ferry");
  });

  it("round-trips through parseIconId", () => {
    expect(parseIconId("veh-KCM-bus")).toEqual({ agency: "KCM", type: "bus" });
    expect(parseIconId("veh-ST-train")).toEqual({ agency: "ST", type: "train" });
  });

  it("returns null for non-vehicle image ids", () => {
    expect(parseIconId("some-sprite")).toBeNull();
    expect(parseIconId("veh-KCM-plane")).toBeNull();
  });
});
