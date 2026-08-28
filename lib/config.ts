// Server-side configuration, read from environment with sane defaults.
// (Client-only values live in lib/clientConfig.ts so they aren't bundled with
// server code.)

function truthy(v: string | undefined): boolean {
  return v === "1" || v?.toLowerCase() === "true";
}

export const config = {
  obaBaseUrl: process.env.OBA_BASE_URL ?? "https://api.pugetsound.onebusaway.org",
  obaApiKey: process.env.OBA_API_KEY ?? "TEST",

  /** Force synthetic mock data (no upstream calls). */
  useMock: truthy(process.env.USE_MOCK),
  /** When real feeds return nothing, fall back to mock so dev still shows a map. */
  mockFallback: process.env.MOCK_FALLBACK !== "0",

  /** How long a built snapshot is considered fresh, in ms. */
  cacheTtlMs: Number(process.env.CACHE_TTL_MS ?? "5000"),

  /** Upstash Redis (Vercel Marketplace). Blank => in-process memory cache only. */
  kvUrl: process.env.KV_REST_API_URL ?? "",
  kvToken: process.env.KV_REST_API_TOKEN ?? "",
};
