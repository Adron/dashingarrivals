import { describe, expect, it } from "vitest";
import { bearingBetween, resolveBearing } from "@/lib/geo";

const SEATTLE = { lat: 47.6, lon: -122.33 };

describe("bearingBetween", () => {
  it("gives the compass direction between two points", () => {
    expect(bearingBetween(SEATTLE, { lat: 48.6, lon: -122.33 })).toBeCloseTo(0, 0); // north
    expect(bearingBetween(SEATTLE, { lat: 47.6, lon: -121.33 })).toBeCloseTo(90, 0); // east
    expect(bearingBetween(SEATTLE, { lat: 46.6, lon: -122.33 })).toBeCloseTo(180, 0); // south
    expect(bearingBetween(SEATTLE, { lat: 47.6, lon: -123.33 })).toBeCloseTo(270, 0); // west
  });
});

describe("resolveBearing", () => {
  it("prefers a non-zero feed bearing", () => {
    expect(resolveBearing(123, SEATTLE, { lat: 48, lon: -122.33 }, undefined)).toBe(123);
  });

  it("derives heading from movement when the feed bearing is missing/zero", () => {
    const b = resolveBearing(0, SEATTLE, { lat: 47.61, lon: -122.33 }, undefined);
    expect(b).toBeCloseTo(0, 0); // moved north ~1.1km
  });

  it("keeps the previous heading when the vehicle barely moved", () => {
    expect(resolveBearing(0, SEATTLE, { lat: 47.60001, lon: -122.33 }, 210)).toBe(210);
  });

  it("falls back to 0 with no usable info", () => {
    expect(resolveBearing(undefined, undefined, SEATTLE, undefined)).toBe(0);
  });
});
