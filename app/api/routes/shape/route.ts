// GET /api/routes/shape?agency=KCM&routeId=100001
// Route geometry (all directions) + stops for the map's route overlay. Maps the
// agency code + GTFS-RT route id to an OBA route id ("{obaId}_{routeId}") and
// asks OneBusAway for the shape. Route shapes are static, so results are memoized
// per-instance for a long TTL in addition to the edge Cache-Control below.

import { NextResponse } from "next/server";
import { AGENCIES } from "@/lib/agencies";
import { fetchRouteShape, type RouteShape } from "@/lib/oba";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 6 * 60 * 60 * 1000; // 6h
const cache = new Map<string, { data: RouteShape; expires: number }>();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agency = searchParams.get("agency") ?? "";
  const routeId = searchParams.get("routeId") ?? "";

  if (!agency || !routeId) {
    return NextResponse.json({ error: "agency and routeId are required" }, { status: 400 });
  }

  const obaId = AGENCIES.find((a) => a.code === agency)?.obaId;
  if (!obaId) {
    return NextResponse.json(
      { error: `no OneBusAway route data for agency ${agency}` },
      { status: 404 },
    );
  }

  const obaRouteId = `${obaId}_${routeId}`;
  const now = Date.now();
  const hit = cache.get(obaRouteId);
  const headers = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };

  if (hit && hit.expires > now) {
    return NextResponse.json(hit.data, { headers });
  }

  try {
    const shape = await fetchRouteShape(obaRouteId);
    cache.set(obaRouteId, { data: shape, expires: now + TTL_MS });
    return NextResponse.json(shape, { headers });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
