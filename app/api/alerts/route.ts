// GET /api/alerts — active service alerts across enabled agencies.

import { NextResponse } from "next/server";
import { getAlerts } from "@/lib/alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const alerts = await getAlerts();
    return NextResponse.json(
      { alerts, updatedAt: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
    );
  } catch (err) {
    return NextResponse.json(
      { alerts: [], updatedAt: Date.now(), error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
