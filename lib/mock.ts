// Synthetic vehicle snapshot for local dev and as a fallback when upstream feeds
// are unavailable. Vehicles drift over time so successive polls show movement.

import type { Vehicle, VehicleSnapshot, VehicleType } from "@/lib/types";

interface Center {
  name: string;
  lat: number;
  lon: number;
}

const CENTERS: Center[] = [
  { name: "Seattle", lat: 47.6062, lon: -122.3321 },
  { name: "Bellevue", lat: 47.6101, lon: -122.2015 },
  { name: "Redmond", lat: 47.674, lon: -122.1215 },
  { name: "Everett", lat: 47.979, lon: -122.2021 },
  { name: "Tacoma", lat: 47.2529, lon: -122.4443 },
];

// Deterministic PRNG so ids/params are stable across calls (only positions move).
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface MockSeed {
  id: string;
  agency: string;
  agencyName: string;
  type: VehicleType;
  route: string;
  center: Center;
  radiusDeg: number;
  angularSpeed: number; // radians per second
  phase: number;
}

let seeds: MockSeed[] | null = null;

function buildSeeds(): MockSeed[] {
  const rand = mulberry32(1337);
  const result: MockSeed[] = [];
  const perCenter = 26;

  CENTERS.forEach((center, ci) => {
    for (let i = 0; i < perCenter; i++) {
      // Mostly buses; a few trains near Seattle/Tacoma corridors.
      const roll = rand();
      const type: VehicleType = roll > 0.9 ? "train" : "bus";
      const agency = type === "train" ? "ST" : "KCM";
      const agencyName = type === "train" ? "Sound Transit" : "King County Metro";
      result.push({
        id: `${agency}_M${ci}${i.toString().padStart(2, "0")}`,
        agency,
        agencyName,
        type,
        route: type === "train" ? `${1 + Math.floor(rand() * 2)} Line` : `${1 + Math.floor(rand() * 300)}`,
        center,
        radiusDeg: 0.01 + rand() * 0.05,
        angularSpeed: (rand() - 0.5) * 0.04,
        phase: rand() * Math.PI * 2,
      });
    }
  });

  // A couple of ferries out on Puget Sound (west of Seattle).
  const ferryCenter: Center = { name: "Puget Sound", lat: 47.62, lon: -122.45 };
  for (let i = 0; i < 4; i++) {
    result.push({
      id: `WSF_M${i}`,
      agency: "WSF",
      agencyName: "Washington State Ferries",
      type: "ferry",
      route: ["Seattle–Bainbridge", "Seattle–Bremerton", "Edmonds–Kingston", "Fauntleroy–Vashon"][i],
      center: ferryCenter,
      radiusDeg: 0.04 + rand() * 0.05,
      angularSpeed: (rand() - 0.5) * 0.02,
      phase: rand() * Math.PI * 2,
    });
  }

  return result;
}

export function buildMockSnapshot(now: number = Date.now()): VehicleSnapshot {
  if (!seeds) seeds = buildSeeds();
  const tSec = now / 1000;

  const vehicles: Vehicle[] = seeds.map((s) => {
    const angle = s.phase + s.angularSpeed * tSec;
    const lat = s.center.lat + s.radiusDeg * Math.sin(angle);
    const lon =
      s.center.lon + s.radiusDeg * Math.cos(angle) * 1.4; // widen lon for latitude
    // Heading = tangent to the circular path.
    const bearing = ((Math.atan2(Math.cos(angle), -Math.sin(angle)) * 180) / Math.PI + 360) % 360;
    return {
      id: s.id,
      agency: s.agency,
      agencyName: s.agencyName,
      type: s.type,
      routeId: s.route,
      routeShortName: s.route,
      // Fleet number = the seed id suffix (e.g. "M000"); gives the popup something
      // realistic to show in dev. Ferries carry their vessel-style label instead.
      vehicleNumber: s.id.split("_")[1] ?? s.id,
      lat,
      lon,
      bearing,
      // Synthetic ground speed (m/s) so the details popup shows a plausible value.
      speed: 4 + Math.abs(s.angularSpeed) * 220,
      timestamp: now,
    };
  });

  const counts = vehicles.reduce<Record<string, number>>((acc, v) => {
    acc[v.agency] = (acc[v.agency] ?? 0) + 1;
    return acc;
  }, {});

  return {
    vehicles,
    updatedAt: now,
    mock: true,
    sources: Object.entries(counts).map(([agency, count]) => ({ agency, ok: true, count })),
  };
}
