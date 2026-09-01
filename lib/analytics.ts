// First-party, privacy-light web analytics: ingestion + aggregation.
//
// Storage is intentionally pluggable and cheap-to-free on Vercel:
//   • If Upstash Redis is configured (the same KV_* / UPSTASH_* env the vehicle
//     cache in lib/cache.ts already uses), events are aggregated with atomic
//     counters + HyperLogLog uniques. Free tier is plenty for this traffic.
//   • Otherwise we fall back to a per-instance in-memory store so local dev and
//     preview deploys work with zero setup. (Ephemeral: it resets on cold start
//     and is NOT shared across serverless instances — configure Redis for
//     durable production numbers.)
//
// Everything the rest of the app touches goes through recordEvent() / getStats(),
// so swapping the backend (e.g. to Vercel Blob) is a change confined to this file.

import { Redis } from "@upstash/redis";
import { config } from "@/lib/config";

export type EventType = "pageview" | "click";
export type DeviceKind = "desktop" | "mobile" | "tablet" | "bot";
/** What kind of thing a click landed on. Absent/"ui" = generic interface click. */
export type ClickCategory = "ui" | "vehicle" | "route";

/** A normalized event as persisted and echoed back in the recent feed. */
export interface AnalyticsEvent {
  type: EventType;
  /** Same-origin pathname the event happened on, e.g. "/analytics". */
  path: string;
  /** For clicks: a human label for what was clicked. */
  label?: string;
  /** For link clicks: the destination pathname (no query string). */
  href?: string;
  /** Referrer host, or "direct". Pageviews only. */
  refHost?: string;
  device: DeviceKind;
  /** Epoch ms (server time). */
  ts: number;

  // --- transit context (map clicks) ---
  /** Click category; drives which "popular" list this feeds. */
  category?: ClickCategory;
  /** Agency code, e.g. "KCM", "ST", "WSF". */
  agency?: string;
  /** Unprefixed route id from the feed. */
  routeId?: string;
  /** Human route label, e.g. "40", "550". */
  routeShortName?: string;
  /** Fleet number (bus/train) or vessel name (ferry). */
  vehicleNumber?: string;

  // --- traffic source (pageviews) ---
  /** Visitor country (ISO-3166 alpha-2) from Vercel geo headers. Production only. */
  country?: string;
  /** utm_source from the landing URL, if any. */
  utmSource?: string;
}

export interface CountItem {
  key: string;
  count: number;
}

export interface DayPoint {
  day: string; // YYYY-MM-DD (UTC)
  pageviews: number;
  clicks: number;
  visitors: number;
}

export interface AnalyticsStats {
  generatedAt: number;
  backend: "redis" | "memory";
  totals: {
    pageviews: number;
    clicks: number;
    events: number;
    uniqueVisitors: number;
  };
  series: DayPoint[];
  topPages: CountItem[];
  topClicks: CountItem[];
  /** Most-clicked transit routes (route overlay opens + vehicle clicks). */
  topRoutes: CountItem[];
  /** Most-clicked individual vehicles. */
  topVehicles: CountItem[];
  referrers: CountItem[];
  /** Visitor countries (traffic origin). Production only. */
  countries: CountItem[];
  /** utm_source campaign traffic. */
  campaigns: CountItem[];
  devices: CountItem[];
  recent: AnalyticsEvent[];
}

// How many trailing days the dashboard chart shows.
const SERIES_DAYS = 14;
// How many recent events to retain / show in the live feed.
const RECENT_LIMIT = 40;
// How many rows for the "top" lists.
const TOP_N = 12;

// ---------------------------------------------------------------------------
// Date helpers (UTC day buckets)
// ---------------------------------------------------------------------------

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Ascending list of the last `n` UTC day keys, ending today. */
function lastDays(n: number, now: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(dayKey(now - i * 86_400_000));
  }
  return out;
}

function toItems(map: Record<string, unknown>, limit = TOP_N): CountItem[] {
  return Object.entries(map)
    .map(([key, v]) => ({ key, count: Number(v) || 0 }))
    .filter((it) => it.count > 0)
    // Sort by count desc, then key asc so ties are ordered deterministically —
    // otherwise the top-N slice can reshuffle between refreshes (HGETALL returns
    // hash fields in arbitrary order).
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Backend interface
// ---------------------------------------------------------------------------

interface Backend {
  readonly name: "redis" | "memory";
  record(ev: AnalyticsEvent, vid: string): Promise<void>;
  stats(now: number): Promise<AnalyticsStats>;
}

// ---------------------------------------------------------------------------
// Redis backend (Upstash) — atomic counters + HyperLogLog uniques
// ---------------------------------------------------------------------------

const K = {
  pvTotal: "a:pv:total",
  clkTotal: "a:clk:total",
  evTotal: "a:ev:total",
  pvPath: "a:pv:path", // hash: path -> count
  clkLabel: "a:clk:label", // hash: label -> count
  routes: "a:routes", // hash: route label -> count
  vehicles: "a:vehicles", // hash: vehicle label -> count
  ref: "a:ref", // hash: refHost -> count
  country: "a:geo:country", // hash: country -> count
  utm: "a:utm", // hash: utm source -> count
  dev: "a:dev", // hash: device -> count
  pvDay: "a:pv:day", // hash: day -> count
  clkDay: "a:clk:day", // hash: day -> count
  uvAll: "a:uv", // HLL: all-time unique visitors
  recent: "a:recent", // list of JSON events (newest first)
  uvDay: (d: string) => `a:uv:${d}`, // HLL per day
};

// Keep per-day unique-visitor HLLs a bit longer than the chart window.
const UV_DAY_TTL_SEC = 60 * 60 * 24 * (SERIES_DAYS + 21);

class RedisBackend implements Backend {
  readonly name = "redis" as const;
  constructor(private redis: Redis) {}

  async record(ev: AnalyticsEvent, vid: string): Promise<void> {
    const day = dayKey(ev.ts);
    const p = this.redis.pipeline();

    p.incr(K.evTotal);
    p.hincrby(K.dev, ev.device, 1);
    p.lpush(K.recent, JSON.stringify(ev));
    p.ltrim(K.recent, 0, RECENT_LIMIT - 1);

    if (ev.type === "pageview") {
      p.incr(K.pvTotal);
      p.hincrby(K.pvPath, ev.path, 1);
      p.hincrby(K.pvDay, day, 1);
      p.hincrby(K.ref, ev.refHost || "direct", 1);
      if (ev.country) p.hincrby(K.country, ev.country, 1);
      if (ev.utmSource) p.hincrby(K.utm, ev.utmSource, 1);
      p.pfadd(K.uvAll, vid);
      p.pfadd(K.uvDay(day), vid);
      p.expire(K.uvDay(day), UV_DAY_TTL_SEC);
    } else {
      p.incr(K.clkTotal);
      p.hincrby(K.clkDay, day, 1);
      if (ev.category === "vehicle") {
        const veh = vehicleLabel(ev);
        if (veh) p.hincrby(K.vehicles, veh, 1);
        const rt = routeLabel(ev);
        if (rt) p.hincrby(K.routes, rt, 1); // credit the vehicle's route too
      } else if (ev.category === "route") {
        const rt = routeLabel(ev);
        if (rt) p.hincrby(K.routes, rt, 1);
      } else {
        p.hincrby(K.clkLabel, ev.label || "(unlabeled)", 1);
      }
    }

    await p.exec();
  }

  async stats(now: number): Promise<AnalyticsStats> {
    const days = lastDays(SERIES_DAYS, now);

    const p = this.redis.pipeline();
    p.get<number>(K.pvTotal); // 0
    p.get<number>(K.clkTotal); // 1
    p.get<number>(K.evTotal); // 2
    p.pfcount(K.uvAll); // 3
    p.hgetall<Record<string, number>>(K.pvPath); // 4
    p.hgetall<Record<string, number>>(K.clkLabel); // 5
    p.hgetall<Record<string, number>>(K.routes); // 6
    p.hgetall<Record<string, number>>(K.vehicles); // 7
    p.hgetall<Record<string, number>>(K.ref); // 8
    p.hgetall<Record<string, number>>(K.country); // 9
    p.hgetall<Record<string, number>>(K.utm); // 10
    p.hgetall<Record<string, number>>(K.dev); // 11
    p.hgetall<Record<string, number>>(K.pvDay); // 12
    p.hgetall<Record<string, number>>(K.clkDay); // 13
    p.lrange<string>(K.recent, 0, RECENT_LIMIT - 1); // 14
    for (const d of days) p.pfcount(K.uvDay(d)); // 15..15+days-1

    const res = (await p.exec()) as unknown[];

    const pvByDay = (res[12] as Record<string, number>) ?? {};
    const clkByDay = (res[13] as Record<string, number>) ?? {};
    const uvCounts = res.slice(15) as number[];

    const series: DayPoint[] = days.map((day, i) => ({
      day,
      pageviews: Number(pvByDay[day]) || 0,
      clicks: Number(clkByDay[day]) || 0,
      visitors: Number(uvCounts[i]) || 0,
    }));

    return {
      generatedAt: now,
      backend: this.name,
      totals: {
        pageviews: Number(res[0]) || 0,
        clicks: Number(res[1]) || 0,
        events: Number(res[2]) || 0,
        uniqueVisitors: Number(res[3]) || 0,
      },
      series,
      topPages: toItems((res[4] as Record<string, unknown>) ?? {}),
      topClicks: toItems((res[5] as Record<string, unknown>) ?? {}),
      topRoutes: toItems((res[6] as Record<string, unknown>) ?? {}),
      topVehicles: toItems((res[7] as Record<string, unknown>) ?? {}),
      referrers: toItems((res[8] as Record<string, unknown>) ?? {}, 10),
      countries: toItems((res[9] as Record<string, unknown>) ?? {}, 10),
      campaigns: toItems((res[10] as Record<string, unknown>) ?? {}, 10),
      devices: toItems((res[11] as Record<string, unknown>) ?? {}, 6),
      recent: parseRecent(res[14] as unknown[]),
    };
  }
}

/** Upstash may hand back list items already parsed (objects) or as JSON strings. */
function parseRecent(raw: unknown[]): AnalyticsEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: AnalyticsEvent[] = [];
  for (const item of raw) {
    try {
      const ev = typeof item === "string" ? JSON.parse(item) : item;
      if (ev && typeof ev === "object") out.push(ev as AnalyticsEvent);
    } catch {
      // Skip anything that doesn't parse — never let the feed break stats.
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// In-memory backend — ephemeral per-instance fallback for dev / no-Redis
// ---------------------------------------------------------------------------

class MemoryBackend implements Backend {
  readonly name = "memory" as const;
  private pvTotal = 0;
  private clkTotal = 0;
  private evTotal = 0;
  private pvPath = new Map<string, number>();
  private clkLabel = new Map<string, number>();
  private routes = new Map<string, number>();
  private vehicles = new Map<string, number>();
  private ref = new Map<string, number>();
  private country = new Map<string, number>();
  private utm = new Map<string, number>();
  private dev = new Map<string, number>();
  private pvDay = new Map<string, number>();
  private clkDay = new Map<string, number>();
  private uvAll = new Set<string>();
  private uvDay = new Map<string, Set<string>>();
  private recent: AnalyticsEvent[] = [];

  private static bump(m: Map<string, number>, key: string, by = 1): void {
    m.set(key, (m.get(key) ?? 0) + by);
  }

  async record(ev: AnalyticsEvent, vid: string): Promise<void> {
    const day = dayKey(ev.ts);
    this.evTotal++;
    MemoryBackend.bump(this.dev, ev.device);
    this.recent.unshift(ev);
    if (this.recent.length > RECENT_LIMIT) this.recent.length = RECENT_LIMIT;

    if (ev.type === "pageview") {
      this.pvTotal++;
      MemoryBackend.bump(this.pvPath, ev.path);
      MemoryBackend.bump(this.pvDay, day);
      MemoryBackend.bump(this.ref, ev.refHost || "direct");
      if (ev.country) MemoryBackend.bump(this.country, ev.country);
      if (ev.utmSource) MemoryBackend.bump(this.utm, ev.utmSource);
      // Cap the all-time set so a busy instance can't grow unbounded.
      if (this.uvAll.size < 100_000) this.uvAll.add(vid);
      let set = this.uvDay.get(day);
      if (!set) this.uvDay.set(day, (set = new Set()));
      set.add(vid);
      this.pruneDays(ev.ts);
    } else {
      this.clkTotal++;
      MemoryBackend.bump(this.clkDay, day);
      if (ev.category === "vehicle") {
        const veh = vehicleLabel(ev);
        if (veh) MemoryBackend.bump(this.vehicles, veh);
        const rt = routeLabel(ev);
        if (rt) MemoryBackend.bump(this.routes, rt);
      } else if (ev.category === "route") {
        const rt = routeLabel(ev);
        if (rt) MemoryBackend.bump(this.routes, rt);
      } else {
        MemoryBackend.bump(this.clkLabel, ev.label || "(unlabeled)");
      }
    }
  }

  /** Drop per-day visitor sets outside the retention window. */
  private pruneDays(now: number): void {
    const keep = new Set(lastDays(SERIES_DAYS + 21, now));
    for (const day of this.uvDay.keys()) {
      if (!keep.has(day)) this.uvDay.delete(day);
    }
  }

  async stats(now: number): Promise<AnalyticsStats> {
    const days = lastDays(SERIES_DAYS, now);
    const series: DayPoint[] = days.map((day) => ({
      day,
      pageviews: this.pvDay.get(day) ?? 0,
      clicks: this.clkDay.get(day) ?? 0,
      visitors: this.uvDay.get(day)?.size ?? 0,
    }));

    return {
      generatedAt: now,
      backend: this.name,
      totals: {
        pageviews: this.pvTotal,
        clicks: this.clkTotal,
        events: this.evTotal,
        uniqueVisitors: this.uvAll.size,
      },
      series,
      topPages: toItems(Object.fromEntries(this.pvPath)),
      topClicks: toItems(Object.fromEntries(this.clkLabel)),
      topRoutes: toItems(Object.fromEntries(this.routes)),
      topVehicles: toItems(Object.fromEntries(this.vehicles)),
      referrers: toItems(Object.fromEntries(this.ref), 10),
      countries: toItems(Object.fromEntries(this.country), 10),
      campaigns: toItems(Object.fromEntries(this.utm), 10),
      devices: toItems(Object.fromEntries(this.dev), 6),
      recent: this.recent.slice(0, RECENT_LIMIT),
    };
  }
}

// ---------------------------------------------------------------------------
// Backend selection (singleton)
// ---------------------------------------------------------------------------

let backend: Backend | null = null;

function getBackend(): Backend {
  if (backend) return backend;
  if (config.kvUrl && config.kvToken) {
    backend = new RedisBackend(
      new Redis({ url: config.kvUrl, token: config.kvToken }),
    );
  } else {
    backend = new MemoryBackend();
  }
  return backend;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Record one normalized event for the given (anonymous) visitor id. */
export async function recordEvent(
  ev: AnalyticsEvent,
  vid: string,
): Promise<void> {
  await getBackend().record(ev, vid);
}

/** Aggregate the current stats snapshot for the dashboard. */
export async function getStats(now: number): Promise<AnalyticsStats> {
  return getBackend().stats(now);
}

// ---------------------------------------------------------------------------
// Normalization helpers used by the ingest route
// ---------------------------------------------------------------------------

/** Coerce arbitrary text to a safe, bounded label. */
export function cleanLabel(input: unknown, max = 80): string | undefined {
  if (typeof input !== "string") return undefined;
  const s = input.replace(/\s+/g, " ").trim();
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** Bound a short identifier/token (agency, route, vehicle #, country, utm). */
export function cleanToken(input: unknown, max = 40): string | undefined {
  if (typeof input !== "string") return undefined;
  const s = input.replace(/\s+/g, " ").trim();
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max) : s;
}

/** Human label for a route, e.g. "KCM 40". Empty string if nothing usable. */
export function routeLabel(ev: {
  agency?: string;
  routeShortName?: string;
  routeId?: string;
}): string {
  const name = (ev.routeShortName || ev.routeId || "").trim();
  if (!name) return "";
  const agency = (ev.agency || "").trim();
  return agency ? `${agency} ${name}` : name;
}

/** Human label for a vehicle, e.g. "KCM 40 #1234" (ferry: "WSF Wenatchee"). */
export function vehicleLabel(ev: {
  agency?: string;
  routeShortName?: string;
  routeId?: string;
  vehicleNumber?: string;
}): string {
  const parts: string[] = [];
  const agency = (ev.agency || "").trim();
  const route = (ev.routeShortName || ev.routeId || "").trim();
  const num = (ev.vehicleNumber || "").trim();
  if (agency) parts.push(agency);
  if (route) parts.push(route);
  let label = parts.join(" ");
  if (num) {
    // Buses/trains report a numeric fleet id (prefix "#"); ferries a vessel name.
    const numStr = /^\d+$/.test(num) ? `#${num}` : num;
    label = label ? `${label} ${numStr}` : numStr;
  }
  return label;
}

/** Keep only a same-origin pathname; strip query/hash and cap length. */
export function cleanPath(input: unknown): string {
  if (typeof input !== "string" || !input.startsWith("/")) return "/";
  const path = input.split(/[?#]/)[0];
  return path.length > 200 ? path.slice(0, 200) : path || "/";
}

/** Extract a referrer host, collapsing empties / same-origin to "direct". */
export function referrerHost(referrer: unknown, selfHost: string): string {
  if (typeof referrer !== "string" || !referrer) return "direct";
  try {
    const host = new URL(referrer).host;
    if (!host || host === selfHost) return "direct";
    return host.length > 100 ? host.slice(0, 100) : host;
  } catch {
    return "direct";
  }
}

/** Very small UA bucketer — enough for a device breakdown, no PII kept. */
export function deviceFromUA(ua: string | null): DeviceKind {
  const s = (ua || "").toLowerCase();
  if (!s) return "desktop";
  if (
    /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|headless|lighthouse|monitor|preview|curl|wget|python-requests/.test(
      s,
    )
  ) {
    return "bot";
  }
  if (/ipad|tablet|(android(?!.*mobile))|kindle|silk|playbook/.test(s)) {
    return "tablet";
  }
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/.test(s)) {
    return "mobile";
  }
  return "desktop";
}
