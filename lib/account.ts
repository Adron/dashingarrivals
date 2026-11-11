"use client";

// Client account state: who's signed in, and their Top 5 Routes, saved stops,
// and theme.
//
// Signed out, favorites are kept on this device (localStorage). Signed in,
// they live in the Substratal account via our /api/account/settings route,
// and anything saved on the device is merged into the account, then cleared.
//
// Every request to /api/auth/* and /api/account/* runs one at a time through
// a queue. Substratal refresh tokens are single-use, so two parallel requests
// both refreshing could otherwise end the session.

import { create } from "zustand";
import {
  mergeLocalFavorites,
  routeKey,
  sanitizeRoutes,
  sanitizeStops,
  MAX_FAVORITE_ROUTES,
  type AccountSettings,
  type AccountSettingsPatch,
  type FavoriteRoute,
  type FavoriteStop,
} from "@/lib/accountSettings";
import { useTheme } from "@/lib/theme";
// Type-only: erased at build, so no server code reaches the client bundle.
import type { SessionPayload } from "@/lib/accountApi";
import type { AccountUser } from "@/lib/substratal";

export class AccountError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

const LOCAL_KEY = "da_favorites";

function readLocal(): Pick<AccountSettings, "favoriteRoutes" | "favoriteStops"> {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "{}") as Record<string, unknown>;
    return {
      favoriteRoutes: sanitizeRoutes(raw.favoriteRoutes),
      favoriteStops: sanitizeStops(raw.favoriteStops),
    };
  } catch {
    return { favoriteRoutes: [], favoriteStops: [] };
  }
}

function writeLocal(favorites: Pick<AccountSettings, "favoriteRoutes" | "favoriteStops">): void {
  try {
    if (favorites.favoriteRoutes.length === 0 && favorites.favoriteStops.length === 0) {
      localStorage.removeItem(LOCAL_KEY);
    } else {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(favorites));
    }
  } catch {
    // Storage unavailable (private mode); favorites just won't persist.
  }
}

// One request at a time (see the header comment).
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new AccountError("You appear to be offline. Try again.", "network");
  }
  if (res.status === 202 || res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string };
  };
  if (!res.ok) {
    throw new AccountError(
      data.error?.message ?? "Something went wrong. Try again.",
      data.error?.code ?? "error",
    );
  }
  return data as T;
}

type Status = "idle" | "loading" | "signedOut" | "signedIn";

interface AccountState {
  status: Status;
  user: AccountUser | null;
  /** True when favorites are stored in the account (signed in, settings readable). */
  synced: boolean;
  /** Why a signed-in account's settings aren't available, if they aren't. */
  settingsError: string | null;
  /** The last failed save, shown in the menu until the next success. */
  saveError: string | null;
  favoriteRoutes: FavoriteRoute[];
  favoriteStops: FavoriteStop[];

  init: () => void;
  signIn: (email: string, password: string) => Promise<{ mfaRequired: boolean }>;
  verifyMfa: (answer: { code: string } | { recoveryCode: string }) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  toggleRoute: (route: FavoriteRoute) => void;
  toggleStop: (stop: FavoriteStop) => void;
}

// Set while the theme is being changed *from* the account, so the theme
// subscription doesn't echo it straight back as a save.
let applyingAccountTheme = false;
let initialized = false;

export const useAccount = create<AccountState>((set, get) => {
  /** The account's favorites as last confirmed by the server (for reverting). */
  let saved: Pick<AccountSettings, "favoriteRoutes" | "favoriteStops"> = {
    favoriteRoutes: [],
    favoriteStops: [],
  };

  function save(patch: AccountSettingsPatch): void {
    void enqueue(() =>
      request<{ settings: AccountSettings }>("PATCH", "/api/account/settings", patch),
    ).then(
      ({ settings }) => {
        saved = { favoriteRoutes: settings.favoriteRoutes, favoriteStops: settings.favoriteStops };
        set({ ...saved, saveError: null });
      },
      (err: unknown) => {
        if (err instanceof AccountError && err.code === "signed_out") {
          applySession({ user: null, settings: null });
          set({ saveError: "Your session ended. Sign in again to keep saving." });
          return;
        }
        set({ ...saved, saveError: err instanceof Error ? err.message : String(err) });
      },
    );
  }

  /** Adopt a session payload; `fresh` = the user just signed in on this page. */
  function applySession(payload: SessionPayload, fresh = false): void {
    if (!payload.user) {
      set({
        status: "signedOut",
        user: null,
        synced: false,
        settingsError: null,
        ...readLocal(),
      });
      return;
    }

    if (!payload.settings) {
      // Signed in, but the account's settings can't be used (e.g. no access to
      // the app yet): keep favorites on this device so nothing is lost.
      set({
        status: "signedIn",
        user: payload.user,
        synced: false,
        settingsError: payload.settingsError ?? "Saved settings are unavailable.",
        ...readLocal(),
      });
      return;
    }

    const settings = payload.settings;
    saved = { favoriteRoutes: settings.favoriteRoutes, favoriteStops: settings.favoriteStops };
    set({ status: "signedIn", user: payload.user, synced: true, settingsError: null, ...saved });

    // Theme: the account's choice for this site wins. With none saved yet, a
    // fresh sign-in adopts the theme already in use here.
    if (settings.theme) {
      if (settings.theme !== useTheme.getState().mode) {
        applyingAccountTheme = true;
        useTheme.getState().setMode(settings.theme);
        applyingAccountTheme = false;
      }
    } else if (fresh) {
      save({ theme: useTheme.getState().mode });
    }

    // Fold in anything saved on this device while signed out.
    const merged = mergeLocalFavorites(saved, readLocal());
    writeLocal({ favoriteRoutes: [], favoriteStops: [] });
    if (merged) {
      set(merged);
      save(merged);
    }
  }

  async function signedIn(promise: Promise<SessionPayload>): Promise<void> {
    applySession(await promise, true);
  }

  return {
    status: "idle",
    user: null,
    synced: false,
    settingsError: null,
    saveError: null,
    favoriteRoutes: [],
    favoriteStops: [],

    init: () => {
      if (initialized) return;
      initialized = true;
      set({ status: "loading", ...readLocal() });

      useTheme.subscribe((state, prev) => {
        if (state.mode === prev.mode || applyingAccountTheme) return;
        if (get().synced) save({ theme: state.mode });
      });

      enqueue(() => request<SessionPayload>("GET", "/api/auth/session")).then(
        (payload) => applySession(payload),
        // Accounts unreachable: carry on signed out with device favorites.
        () => applySession({ user: null, settings: null }),
      );
    },

    signIn: (email, password) =>
      enqueue(async () => {
        const res = await request<SessionPayload | { mfaRequired: true }>("POST", "/api/auth/login", {
          email,
          password,
        });
        if ("mfaRequired" in res) return { mfaRequired: true };
        applySession(res, true);
        return { mfaRequired: false };
      }),

    verifyMfa: (answer) =>
      enqueue(() => signedIn(request<SessionPayload>("POST", "/api/auth/mfa", answer))),

    signUp: (email, password, displayName) =>
      enqueue(() =>
        signedIn(
          request<SessionPayload>("POST", "/api/auth/signup", { email, password, displayName }),
        ),
      ),

    signOut: () =>
      enqueue(async () => {
        await request("POST", "/api/auth/logout").catch(() => {});
        set({ saveError: null });
        applySession({ user: null, settings: null });
      }),

    forgotPassword: (email) => enqueue(() => request<void>("POST", "/api/auth/forgot", { email })),

    toggleRoute: (route) => {
      const current = get().favoriteRoutes;
      const key = routeKey(route);
      const exists = current.some((r) => routeKey(r) === key);
      if (!exists && current.length >= MAX_FAVORITE_ROUTES) return;
      const favoriteRoutes = exists
        ? current.filter((r) => routeKey(r) !== key)
        : sanitizeRoutes([...current, route]);
      set({ favoriteRoutes });
      if (get().synced) save({ favoriteRoutes });
      else writeLocal({ favoriteRoutes, favoriteStops: get().favoriteStops });
    },

    toggleStop: (stop) => {
      const current = get().favoriteStops;
      const exists = current.some((s) => s.id === stop.id);
      const favoriteStops = exists
        ? current.filter((s) => s.id !== stop.id)
        : sanitizeStops([...current, stop]);
      set({ favoriteStops });
      if (get().synced) save({ favoriteStops });
      else writeLocal({ favoriteRoutes: get().favoriteRoutes, favoriteStops });
    },
  };
});

/** Is this route in the Top 5? */
export function useIsFavoriteRoute(route: Pick<FavoriteRoute, "agency" | "routeId"> | null): boolean {
  return useAccount((s) =>
    route ? s.favoriteRoutes.some((r) => routeKey(r) === routeKey(route)) : false,
  );
}

/** Is this stop saved? */
export function useIsFavoriteStop(stopId: string | null): boolean {
  return useAccount((s) => (stopId ? s.favoriteStops.some((f) => f.id === stopId) : false));
}
