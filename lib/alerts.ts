// Fetches and merges active service alerts across enabled agencies, cached with a
// short TTL (alerts change slowly) and serving the last good set on failure.

import { ENABLED_AGENCIES } from "@/lib/agencies";
import { config } from "@/lib/config";
import { decodeAlerts, isActive } from "@/lib/gtfs/alerts";
import type { Alert } from "@/lib/types";

const TTL_MS = 60_000;

function alertsUrl(obaId: string): string {
  const url = new URL(`/api/gtfs_realtime/alerts-for-agency/${obaId}.pb`, config.obaBaseUrl);
  url.searchParams.set("key", config.obaApiKey);
  return url.toString();
}

let cache: { data: Alert[]; expires: number } | null = null;
let lastGood: Alert[] = [];

export async function getAlerts(): Promise<Alert[]> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.data;

  const results = await Promise.all(
    ENABLED_AGENCIES.map(async (agency) => {
      if (!agency.obaId) return { ok: true, alerts: [] as Alert[] };
      try {
        const res = await fetch(alertsUrl(agency.obaId), { cache: "no-store" });
        if (!res.ok) return { ok: false, alerts: [] as Alert[] };
        const buf = new Uint8Array(await res.arrayBuffer());
        return { ok: true, alerts: decodeAlerts(buf, agency.code) };
      } catch {
        return { ok: false, alerts: [] as Alert[] };
      }
    }),
  );

  // If every agency fetch failed, keep serving the last good set for a bit.
  if (!results.some((r) => r.ok) && lastGood.length > 0) {
    cache = { data: lastGood, expires: now + 10_000 };
    return lastGood;
  }

  const active = results.flatMap((r) => r.alerts).filter((a) => isActive(a, now));
  lastGood = active;
  cache = { data: active, expires: now + TTL_MS };
  return active;
}
