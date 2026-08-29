// Builds the merged, normalized vehicle snapshot from all enabled agency feeds.
// This is the single source of truth the cache layer wraps.

import { ENABLED_AGENCIES, obaVehiclePositionsUrl } from "@/lib/agencies";
import { config } from "@/lib/config";
import { fetchVehiclePositions } from "@/lib/gtfs/decode";
import { normalizeAgencyVehicles } from "@/lib/gtfs/normalize";
import { routesForAgency } from "@/lib/routesLookup";
import { fetchFerries } from "@/lib/wsf";
import { buildMockSnapshot } from "@/lib/mock";
import type { SourceStatus, Vehicle, VehicleSnapshot } from "@/lib/types";

export async function buildSnapshot(): Promise<VehicleSnapshot> {
  if (config.useMock) return buildMockSnapshot();

  const sources: SourceStatus[] = [];
  const vehicles: Vehicle[] = [];

  const agencyTasks = ENABLED_AGENCIES.map(async (agency) => {
    if (!agency.obaId) return;
    try {
      const url = obaVehiclePositionsUrl(config.obaBaseUrl, agency.obaId, config.obaApiKey);
      const raw = await fetchVehiclePositions(url);
      const normalized = normalizeAgencyVehicles(raw, agency, routesForAgency(agency.code));
      vehicles.push(...normalized);
      sources.push({ agency: agency.code, ok: true, count: normalized.length });
    } catch (err) {
      sources.push({
        agency: agency.code,
        ok: false,
        count: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Washington State Ferries (separate WSDOT REST source).
  const ferryTask = (async () => {
    try {
      const ferries = await fetchFerries();
      vehicles.push(...ferries);
      sources.push({ agency: "WSF", ok: true, count: ferries.length });
    } catch (err) {
      sources.push({
        agency: "WSF",
        ok: false,
        count: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();

  await Promise.all([...agencyTasks, ferryTask]);

  // If every source failed (bad key, network), keep the map alive with mock data
  // in dev rather than showing an empty map.
  if (vehicles.length === 0 && config.mockFallback) {
    const mock = buildMockSnapshot();
    return { ...mock, sources: [...sources, ...mock.sources] };
  }

  return { vehicles, updatedAt: Date.now(), sources };
}
