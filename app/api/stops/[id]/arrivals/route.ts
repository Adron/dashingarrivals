// GET /api/stops/[id]/arrivals — real-time arrivals for a stop (e.g. id "1_1040").

import { NextResponse } from "next/server";
import { fetchArrivals } from "@/lib/oba";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const data = await fetchArrivals(id);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" },
    });
  } catch (err) {
    return NextResponse.json(
      { arrivals: [], error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
