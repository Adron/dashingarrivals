import { describe, expect, it } from "vitest";
import { decodePolyline } from "@/lib/polyline";

describe("decodePolyline", () => {
  it("decodes Google's canonical example to [lon, lat] pairs", () => {
    // From the Encoded Polyline Algorithm Format reference.
    const coords = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(coords).toHaveLength(3);
    expect(coords[0][1]).toBeCloseTo(38.5, 5); // lat
    expect(coords[0][0]).toBeCloseTo(-120.2, 5); // lon
    expect(coords[1][1]).toBeCloseTo(40.7, 5);
    expect(coords[1][0]).toBeCloseTo(-120.95, 5);
    expect(coords[2][1]).toBeCloseTo(43.252, 5);
    expect(coords[2][0]).toBeCloseTo(-126.453, 5);
  });

  it("returns an empty array for an empty string", () => {
    expect(decodePolyline("")).toEqual([]);
  });
});
