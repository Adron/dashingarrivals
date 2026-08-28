#!/usr/bin/env node
// Builds data/routes.json: per-agency route metadata (shortName / longName /
// GTFS route_type / color), keyed by the UNPREFIXED route id — which is what the
// GTFS-realtime vehicle feeds emit. Source: OneBusAway routes-for-agency REST
// endpoint (ids there are prefixed "<obaId>_<routeId>", so we strip the prefix).
//
//   OBA_API_KEY=<key> node scripts/build-routes.mjs
//
// Run whenever agencies/routes change (e.g. service changes). The output is
// committed so the app doesn't fetch it at runtime.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.OBA_BASE_URL ?? "https://api.pugetsound.onebusaway.org";
const KEY = process.env.OBA_API_KEY ?? "TEST";

// Mirrors lib/agencies.ts (code + OBA id). Includes not-yet-enabled agencies so
// the lookup is ready when they're switched on.
const AGENCIES = [
  { code: "KCM", obaId: "1" },
  { code: "ST", obaId: "40" },
  { code: "PT", obaId: "3" },
  { code: "KT", obaId: "20" },
  { code: "ET", obaId: "97" },
  { code: "IT", obaId: "19" },
];

async function fetchRoutes(obaId) {
  const url = `${BASE}/api/where/routes-for-agency/${obaId}.json?key=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json?.data?.list ?? [];
}

function stripPrefix(id, obaId) {
  const prefix = `${obaId}_`;
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

const out = {};
for (const { code, obaId } of AGENCIES) {
  try {
    const routes = await fetchRoutes(obaId);
    const map = {};
    for (const r of routes) {
      const key = stripPrefix(String(r.id), obaId);
      map[key] = {
        shortName: r.shortName || undefined,
        longName: r.longName || r.description || undefined,
        type: typeof r.type === "number" ? r.type : 3,
        color: r.color || undefined,
      };
    }
    // Stable key order for clean diffs.
    out[code] = Object.fromEntries(
      Object.entries(map).sort(([a], [b]) => a.localeCompare(b)),
    );
    console.log(`${code}: ${Object.keys(map).length} routes`);
  } catch (err) {
    console.warn(`${code}: skipped (${err.message})`);
  }
  // Be polite to the shared TEST key / OBA API and avoid 429s.
  await new Promise((r) => setTimeout(r, 500));
}

const here = dirname(fileURLToPath(import.meta.url));
const outPath = `${here}/../data/routes.json`;
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
