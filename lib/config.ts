// Server-side configuration, read from environment with sane defaults.
// (Client-only values live in lib/clientConfig.ts so they aren't bundled with
// server code.)

// Use `||` (not `??`) for defaults so an env var set to an EMPTY string in the
// host falls back to the default rather than producing "" / NaN.
export const config = {
  obaBaseUrl: process.env.OBA_BASE_URL || "https://api.pugetsound.onebusaway.org",
  obaApiKey: process.env.OBA_API_KEY || "TEST",

  /** How long a built snapshot is considered fresh, in ms. */
  cacheTtlMs: Number(process.env.CACHE_TTL_MS) || 5000,

  /** WSDOT ferries vessel-locations API. Access code is optional (currently open). */
  wsfBaseUrl: process.env.WSF_BASE_URL ?? "https://www.wsdot.wa.gov/ferries/api/vessels/rest",
  wsdotAccessCode: process.env.WSDOT_API_ACCESS_CODE ?? "",

  /**
   * Upstash Redis (Vercel Marketplace). Accepts either the KV_* names or
   * Upstash's native UPSTASH_REDIS_REST_* names. Blank => in-process cache only.
   */
  kvUrl: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  kvToken: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
};
