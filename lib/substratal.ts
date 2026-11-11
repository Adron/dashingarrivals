// Server-only client for the Substratal Apps API (api.substratalapps.com),
// which provides this site's user accounts.
//
// Dashing Arrivals uses embedded login: our own form posts to our route
// handlers, which call /auth/* here and keep the tokens in HttpOnly cookies
// (lib/session.ts). The browser never calls Substratal directly — the API's
// CORS only admits Substratal's own Hub, and this keeps tokens out of JS.

import { config } from "@/lib/config";
import {
  fromSubstratal,
  toSubstratalOverrides,
  type AccountSettings,
  type AccountSettingsPatch,
  type SubstratalAppSettings,
} from "@/lib/accountSettings";

const TIMEOUT_MS = 10_000;

/** POST /auth/signup, /auth/login, /auth/mfa/verify, /auth/token/refresh. */
export interface AuthSession {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  session_id: string;
  user_id: string;
  email_verified: boolean;
}

/** /auth/login's answer when the account has two-factor turned on. */
export interface MfaChallenge {
  mfa_required: true;
  mfa_token: string;
  methods: string[];
  expires_in: number;
}

/** The signed-in user, as shown in our UI. */
export interface AccountUser {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
}

/** A Substratal error ({"error":{"code","message","details"}}) or a transport failure. */
export class SubstratalError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "SubstratalError";
  }
}

async function api<T>(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Substratal-Version": "1",
    Accept: "application/json",
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = await fetch(`${config.substratalApiUrl}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new SubstratalError(
      502,
      "upstream_unreachable",
      err instanceof Error ? err.message : String(err),
    );
  }

  if (res.status === 202 || res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    // Non-JSON body (e.g. a gateway error page); handled below.
  }
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; details?: unknown } })?.error;
    const requestId = res.headers.get("X-Request-Id");
    if (res.status >= 500) {
      console.error(`[substratal] ${method} ${path} → ${res.status}`, { requestId, code: e?.code });
    }
    throw new SubstratalError(
      res.status,
      e?.code ?? "upstream_error",
      e?.message ?? `Substratal returned HTTP ${res.status}`,
      e?.details,
    );
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Auth

export function signup(input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<AuthSession> {
  return api("POST", "/auth/signup", {
    body: {
      email: input.email,
      password: input.password,
      ...(input.displayName ? { display_name: input.displayName } : {}),
      // Informational: brands the verification email as Dashing Arrivals.
      application_id: config.substratalAppId,
    },
  });
}

export function login(email: string, password: string): Promise<AuthSession | MfaChallenge> {
  return api("POST", "/auth/login", { body: { email, password } });
}

export function verifyMfa(
  mfaToken: string,
  answer: { code: string } | { recoveryCode: string },
): Promise<AuthSession> {
  return api("POST", "/auth/mfa/verify", {
    body:
      "code" in answer
        ? { mfa_token: mfaToken, code: answer.code }
        : { mfa_token: mfaToken, recovery_code: answer.recoveryCode },
  });
}

export async function logout(accessToken: string): Promise<void> {
  await api("POST", "/auth/logout", { token: accessToken, body: {} });
}

export async function forgotPassword(email: string): Promise<void> {
  await api("POST", "/auth/password/forgot", { body: { email } });
}

// Refresh tokens are single-use: presenting one that was already rotated
// revokes the whole session (401 refresh_token_reused). Concurrent requests
// on this instance that need a refresh share one in-flight call, and its
// result is remembered briefly so a request that raced past the cookie update
// still gets the new tokens instead of replaying the old refresh token.
const REFRESH_REMEMBER_MS = 30_000;
const refreshes = new Map<string, { promise: Promise<AuthSession>; at: number }>();

export function refreshSession(refreshToken: string): Promise<AuthSession> {
  const now = Date.now();
  for (const [k, v] of refreshes) if (now - v.at > REFRESH_REMEMBER_MS) refreshes.delete(k);

  const existing = refreshes.get(refreshToken);
  if (existing) return existing.promise;

  const promise = api<AuthSession>("POST", "/auth/token/refresh", {
    body: { refresh_token: refreshToken },
  });
  refreshes.set(refreshToken, { promise, at: now });
  // A failed refresh may be retried (e.g. after a network blip), so forget it.
  promise.catch(() => refreshes.delete(refreshToken));
  return promise;
}

// ---------------------------------------------------------------------------
// The signed-in user

export async function getUser(accessToken: string): Promise<AccountUser> {
  const [me, profile] = await Promise.all([
    api<{ id: string; email: string; email_verified: boolean }>("GET", "/users/me", {
      token: accessToken,
    }),
    api<{ display_name?: string | null }>("GET", "/users/me/profile", { token: accessToken }).catch(
      () => ({ display_name: null }),
    ),
  ]);
  return {
    id: me.id,
    email: me.email,
    displayName: profile.display_name || null,
    emailVerified: Boolean(me.email_verified),
  };
}

function settingsPath(): string {
  return `/users/me/apps/${encodeURIComponent(config.substratalAppId)}/settings`;
}

export async function getSettings(accessToken: string): Promise<AccountSettings> {
  return fromSubstratal(await api<SubstratalAppSettings>("GET", settingsPath(), { token: accessToken }));
}

export async function patchSettings(
  accessToken: string,
  patch: AccountSettingsPatch,
): Promise<AccountSettings> {
  const overrides = toSubstratalOverrides(patch);
  if (Object.keys(overrides).length === 0) return getSettings(accessToken);
  return fromSubstratal(
    await api<SubstratalAppSettings>("PATCH", settingsPath(), {
      token: accessToken,
      body: { overrides },
    }),
  );
}

/** For tests only: forget remembered refreshes. */
export function _resetRefreshCacheForTests(): void {
  refreshes.clear();
}
