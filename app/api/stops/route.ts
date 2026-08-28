// GET /api/stops?lat=&lon=&latSpan=&lonSpan= — stops in the current map viewport.

import { NextResponse } from "next/server";
import { fetchStopsForLocation } from "@/lib/oba";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const latSpan = Number(searchParams.get("latSpan"));
  const lonSpan = Number(searchParams.get("lonSpan"));

  if (![lat, lon, latSpan, lonSpan].every(Number.isFinite)) {
    return NextResponse.json(
      { stops: [], error: "lat, lon, latSpan, lonSpan are required" },
      { status: 400 },
    );
  }

  try {
    const stops = await fetchStopsForLocation({ lat, lon, latSpan, lonSpan });
    return NextResponse.json(
      { stops },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
    );
  } catch (err) {
    return NextResponse.json(
      { stops: [], error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
