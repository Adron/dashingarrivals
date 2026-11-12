// "Most Popular Top 5": the routes that appear in the most accounts' Top 5
// Routes, shown in the Saved menu to visitors who aren't signed in.
//
// Substratal only lets a user read their own settings, so we keep the tally
// ourselves in the shared key-value store (the same Upstash Redis analytics
// uses). Each account counts at most once per route:
//   pop:routes      sorted set   route key -> number of accounts saving it
//   pop:meta        hash         route key -> JSON FavoriteRoute (name, color)
//   pop:u:<hash>    string       JSON route keys this account last reported
// A user's contribution is replaced wholesale on every sync (diffed against
// what they last reported), so syncing is idempotent. Account ids are hashed;
// nothing here identifies a person.
//
// Without KV configured it falls back to a per-instance in-memory tally, which
// is fine for local dev and tests.

import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { config } from "@/lib/config";
import { routeKey, sanitizeRoutes, type FavoriteRoute } from "@/lib/accountSettings";

export const POPULAR_LIMIT = 5;

export interface PopularRoute extends FavoriteRoute {
  /** How many accounts have this route in their Top 5. */
  count: number;
}

const K = {
  routes: "pop:routes",
  meta: "pop:meta",
  user: (id: string) => `pop:u:${id}`,
};

function userHash(userId: string): string {
  return createHash("sha256").update(`dashingarrivals:${userId}`).digest("hex").slice(0, 32);
}

interface Store {
  /** Route keys this user last reported (empty if never). */
  previous(user: string): Promise<string[]>;
  apply(
    user: string,
    keys: string[],
    added: FavoriteRoute[],
    removed: string[],
  ): Promise<void>;
  top(limit: number): Promise<PopularRoute[]>;
}

function parseMeta(raw: unknown): FavoriteRoute | null {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return sanitizeRoutes([v])[0] ?? null;
  } catch {
    return null;
  }
}

class RedisStore implements Store {
  constructor(private redis: Redis) {}

  async previous(user: string): Promise<string[]> {
    const raw = await this.redis.get<unknown>(K.user(user));
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v.filter((k): k is string => typeof k === "string") : [];
  }

  async apply(user: string, keys: string[], added: FavoriteRoute[], removed: string[]): Promise<void> {
    const p = this.redis.pipeline();
    for (const r of added) {
      p.zincrby(K.routes, 1, routeKey(r));
      p.hset(K.meta, { [routeKey(r)]: JSON.stringify(r) });
    }
    for (const k of removed) p.zincrby(K.routes, -1, k);
    if (removed.length) p.zremrangebyscore(K.routes, "-inf", 0);
    if (keys.length) p.set(K.user(user), JSON.stringify(keys));
    else p.del(K.user(user));
    await p.exec();
  }

  async top(limit: number): Promise<PopularRoute[]> {
    const flat = await this.redis.zrange<(string | number)[]>(K.routes, 0, limit - 1, {
      rev: true,
      withScores: true,
    });
    const ranked: { key: string; count: number }[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const count = Number(flat[i + 1]);
      if (count > 0) ranked.push({ key: String(flat[i]), count });
    }
    if (ranked.length === 0) return [];
    const metas = await this.redis.hmget<Record<string, unknown>>(K.meta, ...ranked.map((r) => r.key));
    return ranked.flatMap(({ key, count }) => {
      const route = parseMeta(metas?.[key]);
      return route ? [{ ...route, count }] : [];
    });
  }
}

class MemoryStore implements Store {
  private counts = new Map<string, number>();
  private meta = new Map<string, FavoriteRoute>();
  private users = new Map<string, string[]>();

  async previous(user: string): Promise<string[]> {
    return this.users.get(user) ?? [];
  }

  async apply(user: string, keys: string[], added: FavoriteRoute[], removed: string[]): Promise<void> {
    for (const r of added) {
      const k = routeKey(r);
      this.counts.set(k, (this.counts.get(k) ?? 0) + 1);
      this.meta.set(k, r);
    }
    for (const k of removed) {
      const n = (this.counts.get(k) ?? 0) - 1;
      if (n > 0) this.counts.set(k, n);
      else this.counts.delete(k);
    }
    if (keys.length) this.users.set(user, keys);
    else this.users.delete(user);
  }

  async top(limit: number): Promise<PopularRoute[]> {
    return [...this.counts]
      .sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))
      .slice(0, limit)
      .flatMap(([k, count]) => {
        const route = this.meta.get(k);
        return route ? [{ ...route, count }] : [];
      });
  }
}

let store: Store | null = null;
function getStore(): Store {
  if (!store) {
    store =
      config.kvUrl && config.kvToken
        ? new RedisStore(new Redis({ url: config.kvUrl, token: config.kvToken }))
        : new MemoryStore();
  }
  return store;
}

/**
 * Record a user's current Top 5 Routes. Call after every read or write of an
 * account's settings; it's a no-op write when nothing changed.
 */
export async function syncUserRoutes(userId: string, routes: FavoriteRoute[]): Promise<void> {
  const s = getStore();
  const user = userHash(userId);
  const current = sanitizeRoutes(routes);
  const keys = current.map(routeKey);
  const before = new Set(await s.previous(user));
  const after = new Set(keys);
  const added = current.filter((r) => !before.has(routeKey(r)));
  const removed = [...before].filter((k) => !after.has(k));
  if (added.length === 0 && removed.length === 0) return;
  await s.apply(user, keys, added, removed);
}

/** Drop a user's routes from the tally (e.g. their access was revoked). */
export function forgetUser(userId: string): Promise<void> {
  return syncUserRoutes(userId, []);
}

/** The routes saved by the most accounts, most popular first. */
export function getPopularRoutes(limit = POPULAR_LIMIT): Promise<PopularRoute[]> {
  return getStore().top(limit);
}

/** For tests only: start from an empty in-memory tally. */
export function _resetPopularRoutesForTests(): void {
  store = new MemoryStore();
}
