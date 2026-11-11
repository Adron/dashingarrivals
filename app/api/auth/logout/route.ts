// POST /api/auth/logout — end this session at Substratal and clear cookies.
// Cookies are cleared even if Substratal can't be reached.

import { NextResponse } from "next/server";
import { NO_STORE, SIGNED_OUT } from "@/lib/accountApi";
import { clearSessionCookies, getAccessToken } from "@/lib/session";
import { logout } from "@/lib/substratal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const token = await getAccessToken();
    if (token) await logout(token);
  } catch (err) {
    console.warn("[account] logout upstream failed; clearing cookies anyway", err);
  }
  await clearSessionCookies();
  return NextResponse.json(SIGNED_OUT, { headers: NO_STORE });
}
