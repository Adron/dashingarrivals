// Account settings shared by the server routes and the client store: the saved
// theme, "Top 5 Routes", and saved transit stops.
//
// They live in Substratal's per-app settings for app_dashingarrivals. The
// Application's settings_schema declares `favorite_routes` and `favorite_stops`
// (snake_case, as stored); `theme` is a reserved key every app may override.
// The schema can't express maxItems, so the caps are enforced here, on every
// write, by the server route.

import type { ThemeMode } from "@/lib/theme";

export const MAX_FAVORITE_ROUTES = 5;
export const MAX_FAVORITE_STOPS = 20;
const MAX_TEXT = 80;

/** A saved route — same fields as the map's SelectedRoute, so it can be re-opened. */
export interface FavoriteRoute {
  agency: string;
  routeId: string;
  shortName: string;
  color: string;
}

/** A saved stop — a Stop minus its routeIds (which the arrivals call doesn't need). */
export interface FavoriteStop {
  id: string;
  code: string;
  name: string;
  lat: number;
  lon: number;
  direction?: string;
}

export interface AccountSettings {
  /** The theme saved for Dashing Arrivals, or null if the user never set one here. */
  theme: ThemeMode | null;
  favoriteRoutes: FavoriteRoute[];
  favoriteStops: FavoriteStop[];
}

/** A partial write from the client; omitted keys are left untouched. */
export type AccountSettingsPatch = Partial<AccountSettings>;

export const EMPTY_SETTINGS: AccountSettings = { theme: null, favoriteRoutes: [], favoriteStops: [] };

// ---------------------------------------------------------------------------
// Sanitizers — every value from the network or localStorage passes through one.

function text(v: unknown): string | undefined {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const s = String(v).replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
  return s || undefined;
}

function coord(v: unknown, limit: number): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= limit ? n : undefined;
}

export function sanitizeTheme(v: unknown): ThemeMode | null {
  return v === "light" || v === "dark" || v === "system" ? v : null;
}

export function routeKey(r: Pick<FavoriteRoute, "agency" | "routeId">): string {
  return `${r.agency}:${r.routeId}`;
}

/** Clean a route list: drop malformed entries and duplicates, cap at Top 5. */
export function sanitizeRoutes(v: unknown): FavoriteRoute[] {
  if (!Array.isArray(v)) return [];
  const out: FavoriteRoute[] = [];
  const seen = new Set<string>();
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const agency = text(o.agency);
    const routeId = text(o.routeId);
    if (!agency || !routeId) continue;
    const route: FavoriteRoute = {
      agency,
      routeId,
      shortName: text(o.shortName) ?? routeId,
      color: /^#[0-9a-f]{3,8}$/i.test(String(o.color ?? "")) ? String(o.color) : "#52525b",
    };
    const key = routeKey(route);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(route);
    if (out.length === MAX_FAVORITE_ROUTES) break;
  }
  return out;
}

/** Clean a stop list: drop malformed entries and duplicates, cap the count. */
export function sanitizeStops(v: unknown): FavoriteStop[] {
  if (!Array.isArray(v)) return [];
  const out: FavoriteStop[] = [];
  const seen = new Set<string>();
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const id = text(o.id);
    const lat = coord(o.lat, 90);
    const lon = coord(o.lon, 180);
    if (!id || lat === undefined || lon === undefined || seen.has(id)) continue;
    seen.add(id);
    const direction = text(o.direction);
    out.push({
      id,
      code: text(o.code) ?? "",
      name: text(o.name) ?? id,
      lat,
      lon,
      ...(direction ? { direction } : {}),
    });
    if (out.length === MAX_FAVORITE_STOPS) break;
  }
  return out;
}

/** Clean a client PATCH body, keeping only the keys it actually set. */
export function sanitizePatch(v: unknown): AccountSettingsPatch {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const patch: AccountSettingsPatch = {};
  if ("theme" in o) patch.theme = sanitizeTheme(o.theme);
  if ("favoriteRoutes" in o) patch.favoriteRoutes = sanitizeRoutes(o.favoriteRoutes);
  if ("favoriteStops" in o) patch.favoriteStops = sanitizeStops(o.favoriteStops);
  return patch;
}

// ---------------------------------------------------------------------------
// Substratal wire format (snake_case keys inside the per-app settings).

/** The subset of GET/PATCH /users/{id}/apps/{appId}/settings we read. */
export interface SubstratalAppSettings {
  resolved?: Record<string, unknown>;
  sources?: Record<string, string>;
  overrides?: Record<string, unknown>;
}

/**
 * Read our settings out of a Substratal per-app settings response. `theme` only
 * counts when it's an override on this app: otherwise `resolved.theme` is the
 * user's account-wide Hub theme, which shouldn't restyle Dashing Arrivals.
 */
export function fromSubstratal(s: SubstratalAppSettings): AccountSettings {
  const resolved = s.resolved ?? {};
  const routes = Array.isArray(resolved.favorite_routes) ? resolved.favorite_routes : [];
  const stops = Array.isArray(resolved.favorite_stops) ? resolved.favorite_stops : [];
  return {
    theme: s.sources?.theme === "app_override" ? sanitizeTheme(resolved.theme) : null,
    favoriteRoutes: sanitizeRoutes(
      routes.map((r: Record<string, unknown>) => ({
        agency: r?.agency,
        routeId: r?.route_id,
        shortName: r?.short_name,
        color: r?.color,
      })),
    ),
    favoriteStops: sanitizeStops(stops),
  };
}

/** Build the `overrides` body for a Substratal PATCH from a sanitized patch. */
export function toSubstratalOverrides(patch: AccountSettingsPatch): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};
  // null clears the override, falling back to inherited (never the Hub theme
  // in our reading of it — see fromSubstratal).
  if ("theme" in patch) overrides.theme = patch.theme ?? null;
  if (patch.favoriteRoutes) {
    overrides.favorite_routes = patch.favoriteRoutes.map((r) => ({
      agency: r.agency,
      route_id: r.routeId,
      short_name: r.shortName,
      color: r.color,
    }));
  }
  if (patch.favoriteStops) {
    overrides.favorite_stops = patch.favoriteStops.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      lat: s.lat,
      lon: s.lon,
      ...(s.direction ? { direction: s.direction } : {}),
    }));
  }
  return overrides;
}

// ---------------------------------------------------------------------------
// Signing in with favorites saved on this device.

/**
 * Merge favorites saved on this device (while signed out) into the account's.
 * The account's entries come first; new local ones are appended, then the
 * caps apply, so an account's existing Top 5 is never displaced. Returns null
 * when there's nothing new to write.
 */
export function mergeLocalFavorites(
  account: Pick<AccountSettings, "favoriteRoutes" | "favoriteStops">,
  local: Pick<AccountSettings, "favoriteRoutes" | "favoriteStops">,
): Pick<AccountSettings, "favoriteRoutes" | "favoriteStops"> | null {
  const favoriteRoutes = sanitizeRoutes([...account.favoriteRoutes, ...local.favoriteRoutes]);
  const favoriteStops = sanitizeStops([...account.favoriteStops, ...local.favoriteStops]);
  const changed =
    favoriteRoutes.length !== account.favoriteRoutes.length ||
    favoriteStops.length !== account.favoriteStops.length;
  return changed ? { favoriteRoutes, favoriteStops } : null;
}
