import { describe, expect, it } from "vitest";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { decodeVehiclePositions } from "@/lib/gtfs/decode";

const { FeedMessage } = GtfsRealtimeBindings.transit_realtime;

function encodeFeed(entities: unknown[]): Uint8Array {
  const message = FeedMessage.fromObject({
    header: { gtfsRealtimeVersion: "2.0" },
    entity: entities,
  });
  return FeedMessage.encode(message).finish();
}

describe("decodeVehiclePositions", () => {
  it("extracts vehicle positions from a protobuf feed", () => {
    const bytes = encodeFeed([
      {
        id: "e1",
        vehicle: {
          trip: { tripId: "t1", routeId: "R1" },
          vehicle: { id: "v1" },
          position: { latitude: 47.6, longitude: -122.3, bearing: 90 },
          timestamp: 1_700_000_000,
        },
      },
    ]);

    const raw = decodeVehiclePositions(bytes);
    expect(raw).toHaveLength(1);
    expect(raw[0]).toMatchObject({
      vehicleId: "v1",
      routeId: "R1",
      tripId: "t1",
      bearing: 90,
      timestamp: 1_700_000_000,
    });
    // GTFS-RT positions are single-precision floats.
    expect(raw[0].lat).toBeCloseTo(47.6, 4);
    expect(raw[0].lon).toBeCloseTo(-122.3, 4);
  });

  it("skips entities without a position", () => {
    const bytes = encodeFeed([
      { id: "no-vehicle", alert: { headerText: { translation: [{ text: "x" }] } } },
      { id: "no-position", vehicle: { vehicle: { id: "v2" } } },
    ]);
    expect(decodeVehiclePositions(bytes)).toHaveLength(0);
  });
});
