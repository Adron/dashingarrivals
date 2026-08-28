// Client-safe config. Only NEXT_PUBLIC_* vars, inlined at build time.

export const clientConfig = {
  basemapStyleUrl:
    process.env.NEXT_PUBLIC_BASEMAP_STYLE_URL ??
    "https://tiles.openfreemap.org/styles/liberty",
  /** Client poll interval for /api/vehicles, in ms. Also drives tween duration. */
  pollMs: Number(process.env.NEXT_PUBLIC_POLL_MS ?? "5000"),
};
