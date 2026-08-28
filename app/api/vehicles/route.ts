// GET /api/vehicles — the merged, normalized live vehicle snapshot.
// Node runtime because it decodes GTFS-realtime protobuf.

import { NextResponse } from "next/server";
import { getCachedSnapshot } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getCachedSnapshot();
    return NextResponse.json(snapshot, {
      headers: {
        // Let Vercel's edge briefly cache and serve-stale between refreshes.
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        vehicles: [],
        updatedAt: Date.now(),
        sources: [],
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
