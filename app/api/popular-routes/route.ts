// GET /api/popular-routes — the "Most Popular Top 5": the routes saved in the
// most accounts' Top 5 Routes (lib/popularRoutes.ts). Shown to visitors who
// aren't signed in. Aggregate counts only; nothing about who saved what.

import { NextResponse } from "next/server";
import { getPopularRoutes } from "@/lib/popularRoutes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const routes = await getPopularRoutes();
    return NextResponse.json(
      { routes },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (err) {
    console.warn("[popular-routes] read failed", err);
    return NextResponse.json({ routes: [] }, { status: 502 });
  }
}
