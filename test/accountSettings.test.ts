import { describe, expect, it } from "vitest";
import {
  fromSubstratal,
  MAX_FAVORITE_ROUTES,
  mergeLocalFavorites,
  sanitizePatch,
  sanitizeRoutes,
  sanitizeStops,
  toSubstratalOverrides,
  type FavoriteRoute,
} from "@/lib/accountSettings";

const route = (n: number, agency = "KCM"): FavoriteRoute => ({
  agency,
  routeId: String(100000 + n),
  shortName: String(n),
  color: "#123456",
});

describe("sanitizeRoutes", () => {
  it("caps at the Top 5 and drops duplicates and malformed entries", () => {
    const input = [route(1), route(1), { agency: "KCM" }, null, "x", ...[2, 3, 4, 5, 6, 7].map((n) => route(n))];
    const out = sanitizeRoutes(input);
    expect(out).toHaveLength(MAX_FAVORITE_ROUTES);
    expect(out.map((r) => r.shortName)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("treats the same route id under different agencies as different routes", () => {
    expect(sanitizeRoutes([route(1, "KCM"), route(1, "ST")])).toHaveLength(2);
  });

  it("defaults a bad color and a missing short name", () => {
    const [r] = sanitizeRoutes([{ agency: "ST", routeId: "100479", color: "red;}" }]);
    expect(r).toEqual({ agency: "ST", routeId: "100479", shortName: "100479", color: "#52525b" });
  });

  it("returns [] for non-arrays", () => {
    expect(sanitizeRoutes({})).toEqual([]);
    expect(sanitizeRoutes(undefined)).toEqual([]);
  });
});

describe("sanitizeStops", () => {
  it("requires an id and in-range coordinates", () => {
    const out = sanitizeStops([
      { id: "1_1040", code: "1040", name: "3rd Ave & Pike", lat: 47.61, lon: -122.34 },
      { id: "bad-lat", lat: 123, lon: 0 },
      { id: "no-lon", lat: 47 },
      { lat: 47, lon: -122 },
      { id: "1_1040", lat: 47.61, lon: -122.34 },
    ]);
    expect(out).toEqual([{ id: "1_1040", code: "1040", name: "3rd Ave & Pike", lat: 47.61, lon: -122.34 }]);
  });

  it("keeps a direction only when present", () => {
    const [s] = sanitizeStops([{ id: "1_5", lat: 47, lon: -122, direction: "N" }]);
    expect(s.direction).toBe("N");
  });
});

describe("sanitizePatch", () => {
  it("keeps only the keys that were sent", () => {
    expect(sanitizePatch({ theme: "dark" })).toEqual({ theme: "dark" });
    expect(sanitizePatch({ favoriteStops: [] })).toEqual({ favoriteStops: [] });
    expect(sanitizePatch({ other: 1 })).toEqual({});
    expect(sanitizePatch(null)).toEqual({});
  });

  it("turns an unknown theme into null (clearing the override)", () => {
    expect(sanitizePatch({ theme: "purple" })).toEqual({ theme: null });
  });
});

describe("Substratal wire format", () => {
  it("round-trips favorites through snake_case overrides", () => {
    const overrides = toSubstratalOverrides({
      theme: "light",
      favoriteRoutes: [route(8)],
      favoriteStops: [{ id: "1_1", code: "1", name: "A", lat: 47, lon: -122 }],
    });
    expect(overrides).toEqual({
      theme: "light",
      favorite_routes: [{ agency: "KCM", route_id: "100008", short_name: "8", color: "#123456" }],
      favorite_stops: [{ id: "1_1", code: "1", name: "A", lat: 47, lon: -122 }],
    });
    const back = fromSubstratal({ resolved: overrides, sources: { theme: "app_override" } });
    expect(back.theme).toBe("light");
    expect(back.favoriteRoutes).toEqual([route(8)]);
    expect(back.favoriteStops).toHaveLength(1);
  });

  it("ignores the account-wide Hub theme unless it's overridden for this app", () => {
    expect(fromSubstratal({ resolved: { theme: "dark" }, sources: { theme: "global" } }).theme).toBeNull();
    expect(fromSubstratal({ resolved: { theme: "dark" }, sources: { theme: "app_override" } }).theme).toBe("dark");
  });

  it("only sends the keys present in the patch", () => {
    expect(toSubstratalOverrides({ favoriteStops: [] })).toEqual({ favorite_stops: [] });
    expect(toSubstratalOverrides({ theme: null })).toEqual({ theme: null });
    expect(toSubstratalOverrides({})).toEqual({});
  });

  it("tolerates an empty or partial response", () => {
    expect(fromSubstratal({})).toEqual({ theme: null, favoriteRoutes: [], favoriteStops: [] });
  });
});

describe("mergeLocalFavorites", () => {
  it("keeps the account's entries first and never displaces its Top 5", () => {
    const account = { favoriteRoutes: [1, 2, 3, 4].map((n) => route(n)), favoriteStops: [] };
    const local = { favoriteRoutes: [route(9), route(10)], favoriteStops: [] };
    const merged = mergeLocalFavorites(account, local);
    expect(merged?.favoriteRoutes.map((r) => r.shortName)).toEqual(["1", "2", "3", "4", "9"]);
  });

  it("returns null when the device adds nothing new", () => {
    const account = { favoriteRoutes: [route(1)], favoriteStops: [] };
    expect(mergeLocalFavorites(account, { favoriteRoutes: [route(1)], favoriteStops: [] })).toBeNull();
    expect(mergeLocalFavorites(account, { favoriteRoutes: [], favoriteStops: [] })).toBeNull();
  });

  it("merges stops too", () => {
    const merged = mergeLocalFavorites(
      { favoriteRoutes: [], favoriteStops: [{ id: "a", code: "", name: "A", lat: 1, lon: 1 }] },
      { favoriteRoutes: [], favoriteStops: [{ id: "b", code: "", name: "B", lat: 2, lon: 2 }] },
    );
    expect(merged?.favoriteStops.map((s) => s.id)).toEqual(["a", "b"]);
  });
});
