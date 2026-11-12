import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountSettings, FavoriteRoute } from "@/lib/accountSettings";
import { useAccount } from "@/lib/account";

// The client account store, driven against a fake /api/* backend that keeps
// one settings record per account, the way Substratal does.

const route = (n: number): FavoriteRoute => ({
  agency: "KCM",
  routeId: String(100000 + n),
  shortName: String(n),
  color: "#123456",
});

interface FakeServer {
  settings: Map<string, AccountSettings>;
  /** Accounts whose settings can't be read (e.g. no entitlement). */
  noSettings: Set<string>;
  /** Fail the next PATCH with this status. */
  failNextPatch?: number;
  current: string | null;
}

let server: FakeServer;

function user(id: string) {
  return { id, email: `${id}@example.com`, displayName: null, emailVerified: true };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function session() {
  const id = server.current;
  if (!id) return { user: null, settings: null };
  if (server.noSettings.has(id)) {
    return { user: user(id), settings: null, settingsError: "No access yet." };
  }
  return { user: user(id), settings: server.settings.get(id) };
}

async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = String(input);
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  switch (path) {
    case "/api/auth/login":
      server.current = body.email.split("@")[0];
      if (!server.settings.has(server.current!)) {
        server.settings.set(server.current!, { theme: "system", favoriteRoutes: [], favoriteStops: [] });
      }
      return json(session());
    case "/api/auth/logout":
      server.current = null;
      return json(session());
    case "/api/account/settings": {
      if (server.failNextPatch) {
        const status = server.failNextPatch;
        server.failNextPatch = undefined;
        return json({ error: { code: "upstream_error", message: "Try again." } }, status);
      }
      const id = server.current!;
      const next = { ...server.settings.get(id)!, ...body };
      server.settings.set(id, next);
      return json({ settings: next });
    }
    case "/api/popular-routes":
      return json({ routes: [{ ...route(7), count: 3 }] });
    default:
      return json({ error: { code: "not_found", message: path } }, 404);
  }
}

const state = () => useAccount.getState();
// Saves run through a promise queue; let it drain.
const settle = () => new Promise((r) => setTimeout(r, 0));

async function signIn(id: string) {
  await state().signIn(`${id}@example.com`, "pw");
  await settle();
}

async function signOut() {
  await state().signOut();
  await settle();
}

beforeEach(() => {
  server = { settings: new Map(), noSettings: new Set(), current: null };
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
});

afterEach(async () => {
  if (state().user) await signOut();
  vi.unstubAllGlobals();
});

describe("account favorites are per user", () => {
  it("starts each account with only its own Top 5", async () => {
    await signIn("alice");
    state().toggleRoute(route(1));
    await settle();
    expect(server.settings.get("alice")!.favoriteRoutes).toEqual([route(1)]);

    await signOut();
    expect(state().favoriteRoutes).toEqual([]);

    await signIn("bob");
    expect(state().favoriteRoutes).toEqual([]);
    expect(server.settings.get("bob")!.favoriteRoutes).toEqual([]);

    await signOut();
    await signIn("alice");
    expect(state().favoriteRoutes).toEqual([route(1)]);
  });

  it("does not save anything while signed out", async () => {
    await signOut();
    state().toggleRoute(route(2));
    state().toggleStop({ id: "1_1", code: "1", name: "Stop", lat: 47.6, lon: -122.3 });
    await settle();
    expect(state().favoriteRoutes).toEqual([]);
    expect(state().favoriteStops).toEqual([]);

    await signIn("bob");
    expect(state().favoriteRoutes).toEqual([]);
  });

  it("shows the Most Popular Top 5 when signed out", async () => {
    await signOut();
    await settle();
    expect(state().popularRoutes).toEqual([{ ...route(7), count: 3 }]);
  });

  it("shows no favorites and saves nothing when an account's settings can't load", async () => {
    await signIn("alice");
    state().toggleRoute(route(1));
    await settle();
    await signOut();

    server.noSettings.add("carol");
    await signIn("carol");
    expect(state().synced).toBe(false);
    expect(state().favoriteRoutes).toEqual([]);
    state().toggleRoute(route(3));
    await settle();
    expect(state().favoriteRoutes).toEqual([]);
  });

  it("reverts a failed save to this account's own list, never a previous one", async () => {
    await signIn("alice");
    state().toggleRoute(route(1));
    await settle();
    await signOut();

    await signIn("bob");
    server.failNextPatch = 502;
    state().toggleRoute(route(2));
    await settle();
    expect(state().favoriteRoutes).toEqual([]);
    expect(state().saveError).toBeTruthy();
  });
});
