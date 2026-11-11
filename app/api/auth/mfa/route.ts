// POST /api/auth/mfa — the two-factor step after a password sign-in:
// { code } from an authenticator app, or { recoveryCode }.

import { NextResponse } from "next/server";
import { errorResponse, jsonError, loadSession, NO_STORE, readJson, str } from "@/lib/accountApi";
import { readMfaCookie, setSessionCookies } from "@/lib/session";
import { verifyMfa } from "@/lib/substratal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readJson(req);
  const code = str(body.code, 32).replace(/\s+/g, "");
  const recoveryCode = str(body.recoveryCode, 64);
  if (!code && !recoveryCode) return jsonError(400, "missing_fields", "Enter your code.");

  const mfaToken = await readMfaCookie();
  if (!mfaToken) return jsonError(401, "mfa_token_expired", "That sign-in took too long. Start again.");

  try {
    const session = await verifyMfa(mfaToken, code ? { code } : { recoveryCode });
    await setSessionCookies(session);
    return NextResponse.json(await loadSession(session.access_token), { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
