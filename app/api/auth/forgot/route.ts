// POST /api/auth/forgot — ask Substratal to email a password-reset link.
// Always answers 202 so it never reveals whether an account exists.

import { NextResponse } from "next/server";
import { errorResponse, jsonError, NO_STORE, readJson, str } from "@/lib/accountApi";
import { forgotPassword } from "@/lib/substratal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const email = str((await readJson(req)).email);
  if (!email) return jsonError(400, "missing_fields", "Enter your email.");
  try {
    await forgotPassword(email);
    return new NextResponse(null, { status: 202, headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
