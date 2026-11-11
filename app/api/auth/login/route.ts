// POST /api/auth/login — email + password. Answers the signed-in session, or
// { mfaRequired: true } when the account has two-factor on; the mfa_token is
// held in an HttpOnly cookie for the follow-up POST /api/auth/mfa.

import { NextResponse } from "next/server";
import { errorResponse, jsonError, loadSession, NO_STORE, readJson, str } from "@/lib/accountApi";
import { setMfaCookie, setSessionCookies } from "@/lib/session";
import { login } from "@/lib/substratal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readJson(req);
  const email = str(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return jsonError(400, "missing_fields", "Enter your email and password.");

  try {
    const result = await login(email, password);
    if ("mfa_required" in result) {
      await setMfaCookie(result.mfa_token, result.expires_in);
      return NextResponse.json({ mfaRequired: true, methods: result.methods }, { headers: NO_STORE });
    }
    await setSessionCookies(result);
    return NextResponse.json(await loadSession(result.access_token), { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
