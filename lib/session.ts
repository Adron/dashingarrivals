// Server-only session handling for Substratal sign-in. Used from route
// handlers, the only place Next lets us write cookies.
//
// Tokens live in first-party HttpOnly cookies, never in client JS:
//   da_at  — the 15-minute platform access token; the cookie expires a minute
//            early so we refresh before Substratal starts rejecting it.
//   da_rt  — the rotating, single-use refresh token (30-day idle lifetime).
//   da_mfa — the short-lived mfa_token between password and two-factor steps.
//
// All refreshing goes through getAccessToken() → refreshSession(), which
// shares one in-flight refresh per token (see lib/substratal.ts).

import { cookies } from "next/headers";
import {
  refreshSession,
  SubstratalError,
  type AuthSession,
} from "@/lib/substratal";

const ACCESS_COOKIE = "da_at";
const REFRESH_COOKIE = "da_rt";
const MFA_COOKIE = "da_mfa";
const ACCESS_EARLY_EXPIRY_S = 60;

function baseCookie() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function setSessionCookies(session: AuthSession): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, session.access_token, {
    ...baseCookie(),
    maxAge: Math.max(30, session.expires_in - ACCESS_EARLY_EXPIRY_S),
  });
  jar.set(REFRESH_COOKIE, session.refresh_token, {
    ...baseCookie(),
    maxAge: session.refresh_token_expires_in,
  });
  jar.delete(MFA_COOKIE);
}

export async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(MFA_COOKIE);
}

export async function setMfaCookie(mfaToken: string, expiresIn: number): Promise<void> {
  (await cookies()).set(MFA_COOKIE, mfaToken, { ...baseCookie(), maxAge: expiresIn });
}

export async function readMfaCookie(): Promise<string | null> {
  return (await cookies()).get(MFA_COOKIE)?.value ?? null;
}

/** True when the browser holds any session cookie (cheap; no network). */
export async function hasSessionCookie(): Promise<boolean> {
  const jar = await cookies();
  return jar.has(ACCESS_COOKIE) || jar.has(REFRESH_COOKIE);
}

/** True for errors meaning the session is over and the user must sign in again. */
function isSessionEnded(err: unknown): boolean {
  return err instanceof SubstratalError && (err.status === 401 || err.status === 400);
}

/**
 * Exchange the refresh cookie for fresh tokens. Returns the new access token,
 * or null (with cookies cleared) when the session has ended. Transport and
 * 5xx errors propagate so a blip doesn't sign anyone out.
 */
async function refresh(): Promise<string | null> {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;
  try {
    const session = await refreshSession(refreshToken);
    await setSessionCookies(session);
    return session.access_token;
  } catch (err) {
    if (isSessionEnded(err)) {
      await clearSessionCookies();
      return null;
    }
    throw err;
  }
}

/** A usable access token, refreshing if the access cookie has expired. */
export async function getAccessToken(): Promise<string | null> {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  return access ?? refresh();
}

/**
 * Run `fn` with a valid access token. If Substratal rejects a token we still
 * thought was fresh (revoked, clock skew), refresh once and retry. Returns
 * null when there's no session, or it ended.
 */
export async function withAccessToken<T>(fn: (token: string) => Promise<T>): Promise<T | null> {
  const jar = await cookies();
  const cached = jar.get(ACCESS_COOKIE)?.value;
  const token = cached ?? (await refresh());
  if (!token) return null;
  try {
    return await fn(token);
  } catch (err) {
    if (!(err instanceof SubstratalError && err.status === 401)) throw err;
    if (!cached) {
      // A token we just minted was rejected: the session itself is gone.
      await clearSessionCookies();
      return null;
    }
    jar.delete(ACCESS_COOKIE);
    const fresh = await refresh();
    if (!fresh) return null;
    try {
      return await fn(fresh);
    } catch (retryErr) {
      if (retryErr instanceof SubstratalError && retryErr.status === 401) {
        await clearSessionCookies();
        return null;
      }
      throw retryErr;
    }
  }
}
