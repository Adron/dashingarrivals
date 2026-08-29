// Washington State Ferries vessel positions via the WSDOT vessellocations REST
// API, normalized into ferry Vehicles. The endpoint is currently open; an access
// code is appended if WSDOT_API_ACCESS_CODE is set. Server-side only.

import { config } from "@/lib/config";
import type { Vehicle } from "@/lib/types";

interface WsfVessel {
  VesselID: number;
  VesselName?: string;
  Latitude?: number;
  Longitude?: number;
  Speed?: number;
  Heading?: number;
  InService?: boolean;
  AtDock?: boolean;
  DepartingTerminalName?: string;
  ArrivingTerminalName?: string;
  TimeStamp?: string;
}

// WCF/.NET date string, e.g. "/Date(1787938982000-0700)/" → epoch ms.
function parseWcfDate(s?: string): number {
  if (!s) return Date.now();
  const m = /\/Date\((\d+)/.exec(s);
  return m ? Number(m[1]) : Date.now();
}

export async function fetchFerries(): Promise<Vehicle[]> {
  let url = `${config.wsfBaseUrl}/vessellocations`;
  if (config.wsdotAccessCode) {
    url += `?apiaccesscode=${encodeURIComponent(config.wsdotAccessCode)}`;
  }

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const vessels: WsfVessel[] = await res.json();

  const out: Vehicle[] = [];
  for (const v of vessels) {
    if (!v.InService) continue;
    if (!Number.isFinite(v.Latitude) || !Number.isFinite(v.Longitude)) continue;

    const from = v.DepartingTerminalName;
    const to = v.ArrivingTerminalName;
    const label = from && to ? `${from} → ${to}` : v.VesselName || "Ferry";

    out.push({
      id: `WSF_${v.VesselID}`,
      agency: "WSF",
      agencyName: "Washington State Ferries",
      type: "ferry",
      routeShortName: label,
      vehicleNumber: v.VesselName,
      lat: v.Latitude as number,
      lon: v.Longitude as number,
      bearing: v.Heading,
      speed: v.Speed != null ? v.Speed * 0.514444 : undefined, // knots → m/s
      timestamp: parseWcfDate(v.TimeStamp),
    });
  }
  return out;
}
