// Client-safe config. Only NEXT_PUBLIC_* vars, inlined at build time.

export const clientConfig = {
  /** Basemap style used in light mode. `NEXT_PUBLIC_BASEMAP_STYLE_URL` kept for back-compat. */
  basemapStyleLight:
    process.env.NEXT_PUBLIC_BASEMAP_STYLE_URL_LIGHT ??
    process.env.NEXT_PUBLIC_BASEMAP_STYLE_URL ??
    "https://tiles.openfreemap.org/styles/liberty",
  /** Basemap style used in dark mode. */
  basemapStyleDark:
    process.env.NEXT_PUBLIC_BASEMAP_STYLE_URL_DARK ??
    "https://tiles.openfreemap.org/styles/dark",
  /** Client poll interval for /api/vehicles, in ms. Also drives tween duration. */
  pollMs: Number(process.env.NEXT_PUBLIC_POLL_MS ?? "5000"),
};
