// GET /api/auth/session — who's signed in, plus their saved settings.
// Signed-out visitors (no session cookie) are answered without calling
// Substratal, so the free, anonymous site pays nothing for accounts.

import { NextResponse } from "next/server";
import { errorResponse, loadSession, NO_STORE, SIGNED_OUT } from "@/lib/accountApi";
import { hasSessionCookie, withAccessToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await hasSessionCookie())) return NextResponse.json(SIGNED_OUT, { headers: NO_STORE });
  try {
    const payload = await withAccessToken(loadSession);
    return NextResponse.json(payload ?? SIGNED_OUT, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
