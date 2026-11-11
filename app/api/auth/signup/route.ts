// POST /api/auth/signup — create a Substratal account and sign straight in.
// Substratal emails a verification link; the account works meanwhile.

import { NextResponse } from "next/server";
import { errorResponse, jsonError, loadSession, NO_STORE, readJson, str } from "@/lib/accountApi";
import { setSessionCookies } from "@/lib/session";
import { signup } from "@/lib/substratal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readJson(req);
  const email = str(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const displayName = str(body.displayName, 80);
  if (!email || !password) return jsonError(400, "missing_fields", "Enter an email and password.");
  if (password.length < 12) {
    return jsonError(422, "weak_password", "Use a password of at least 12 characters.");
  }

  try {
    const session = await signup({ email, password, displayName: displayName || undefined });
    await setSessionCookies(session);
    return NextResponse.json(await loadSession(session.access_token), {
      status: 201,
      headers: NO_STORE,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
