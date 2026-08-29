// Client-safe config. Only NEXT_PUBLIC_* vars, inlined at build time.

// Use `||` (not `??`) so an env var set to an EMPTY string in the host (e.g. a
// blank Vercel var) falls back to the default rather than yielding "" / NaN.
export const clientConfig = {
  basemapStyleUrl:
    process.env.NEXT_PUBLIC_BASEMAP_STYLE_URL ||
    "https://tiles.openfreemap.org/styles/liberty",
  /** Client poll interval for /api/vehicles, in ms. Also drives tween duration. */
  pollMs: Number(process.env.NEXT_PUBLIC_POLL_MS) || 5000,
};
