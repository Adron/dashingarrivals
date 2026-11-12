// Server-only helpers shared by the /api/auth/* and /api/account/* route
// handlers: the session payload the client reads, and turning Substratal
// errors into short, human messages.

import { NextResponse } from "next/server";
import type { AccountSettings, FavoriteRoute } from "@/lib/accountSettings";
import { syncUserRoutes } from "@/lib/popularRoutes";
import { getSettings, getUser, SubstratalError, type AccountUser } from "@/lib/substratal";

/** What GET /api/auth/session (and every sign-in route) returns. */
export interface SessionPayload {
  user: AccountUser | null;
  /** null when signed out, or when the settings couldn't be read. */
  settings: AccountSettings | null;
  /** Why settings is null for a signed-in user (e.g. no access to the app). */
  settingsError?: string;
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: "That email and password don't match.",
  too_many_attempts: "Too many sign-in attempts. Try again in 15 minutes.",
  account_suspended: "This account is suspended.",
  email_taken: "An account with that email already exists. Try signing in.",
  signup_closed: "New sign-ups are closed right now.",
  rate_limited: "Too many requests. Wait a moment and try again.",
  entitlement_required: "Your account doesn't have access to Dashing Arrivals yet.",
  mfa_token_expired: "That sign-in took too long. Start again.",
  upstream_unreachable: "Accounts are unavailable right now. The map still works.",
  upstream_error: "Accounts are unavailable right now. The map still works.",
};

export function errorMessage(err: unknown): { status: number; code: string; message: string } {
  if (err instanceof SubstratalError) {
    const status = err.status >= 500 ? 502 : err.status;
    const message =
      MESSAGES[err.code] ??
      (err.status >= 500 ? MESSAGES.upstream_error : err.message || "Something went wrong.");
    return { status, code: err.code, message };
  }
  console.error("[account] unexpected error", err);
  return { status: 500, code: "internal_error", message: "Something went wrong. Try again." };
}

export function errorResponse(err: unknown): NextResponse {
  const { status, code, message } = errorMessage(err);
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
}

export function jsonError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
}

export const NO_STORE = { "Cache-Control": "no-store" };

export const SIGNED_OUT: SessionPayload = { user: null, settings: null };

/** Load the user and their settings. A settings failure doesn't fail sign-in. */
export async function loadSession(token: string): Promise<SessionPayload> {
  const [user, settings] = await Promise.all([
    getUser(token),
    getSettings(token).then(
      (s) => ({ ok: true as const, s }),
      (err: unknown) => ({ ok: false as const, err }),
    ),
  ]);
  if (settings.ok) {
    // Also backfills accounts whose Top 5 predates the popularity tally.
    await syncPopular(user.id, settings.s.favoriteRoutes);
    return { user, settings: settings.s };
  }
  if (settings.err instanceof SubstratalError && settings.err.status === 401) throw settings.err;
  return { user, settings: null, settingsError: errorMessage(settings.err).message };
}

/**
 * Update the "Most Popular Top 5" tally with a user's Top 5. Best effort: a
 * key-value store outage never fails a sign-in or a save.
 */
export async function syncPopular(userId: string, routes: FavoriteRoute[]): Promise<void> {
  try {
    await syncUserRoutes(userId, routes);
  } catch (err) {
    console.warn("[account] popular routes sync failed", err);
  }
}

/** Read a JSON body without throwing on a malformed one. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function str(v: unknown, max = 256): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
