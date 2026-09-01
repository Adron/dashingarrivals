import { describe, expect, it, beforeEach } from "vitest";
import {
  cleanLabel,
  cleanPath,
  cleanToken,
  deviceFromUA,
  referrerHost,
  routeLabel,
  vehicleLabel,
  getStats,
  recordEvent,
  type AnalyticsEvent,
} from "@/lib/analytics";

// No KV_* env is set under vitest, so the module uses the in-memory backend —
// a per-process singleton. We seed events, then assert on the aggregate.

function ev(partial: Partial<AnalyticsEvent>): AnalyticsEvent {
  return {
    type: "pageview",
    path: "/",
    device: "desktop",
    ts: Date.now(),
    ...partial,
  };
}

describe("analytics normalization helpers", () => {
  it("cleanPath strips query/hash and rejects non-paths", () => {
    expect(cleanPath("/analytics?x=1#top")).toBe("/analytics");
    expect(cleanPath("https://evil.example/x")).toBe("/");
    expect(cleanPath(123)).toBe("/");
    expect(cleanPath("/")).toBe("/");
  });

  it("cleanLabel collapses whitespace and truncates", () => {
    expect(cleanLabel("  hello   world  ")).toBe("hello world");
    expect(cleanLabel("")).toBeUndefined();
    expect(cleanLabel(42)).toBeUndefined();
    expect(cleanLabel("x".repeat(200))?.length).toBeLessThanOrEqual(80);
  });

  it("referrerHost collapses empty and same-origin to direct", () => {
    expect(referrerHost("", "dashingarrivals.com")).toBe("direct");
    expect(referrerHost("https://dashingarrivals.com/x", "dashingarrivals.com")).toBe("direct");
    expect(referrerHost("https://news.ycombinator.com/", "dashingarrivals.com")).toBe("news.ycombinator.com");
    expect(referrerHost("not a url", "dashingarrivals.com")).toBe("direct");
  });

  it("deviceFromUA buckets common agents", () => {
    expect(deviceFromUA("Mozilla/5.0 (Macintosh)")).toBe("desktop");
    expect(deviceFromUA("iPhone; CPU iPhone OS 17 like Mac OS X Mobile")).toBe("mobile");
    expect(deviceFromUA("iPad; CPU OS 17")).toBe("tablet");
    expect(deviceFromUA("Googlebot/2.1")).toBe("bot");
    expect(deviceFromUA(null)).toBe("desktop");
  });
});

describe("in-memory aggregation", () => {
  beforeEach(async () => {
    await recordEvent(ev({ type: "pageview", path: "/analytics", refHost: "google.com" }), "v1");
    await recordEvent(ev({ type: "pageview", path: "/analytics", refHost: "direct" }), "v2");
    await recordEvent(ev({ type: "pageview", path: "/", refHost: "direct" }), "v1");
    await recordEvent(ev({ type: "click", path: "/", label: "nav:analytics", href: "/analytics", device: "mobile" }), "v1");
  });

  it("aggregates totals, top lists and unique visitors", async () => {
    const s = await getStats(Date.now());
    expect(s.backend).toBe("memory");
    expect(s.totals.pageviews).toBeGreaterThanOrEqual(3);
    expect(s.totals.clicks).toBeGreaterThanOrEqual(1);
    expect(s.totals.uniqueVisitors).toBeGreaterThanOrEqual(2);

    const analyticsPage = s.topPages.find((p) => p.key === "/analytics");
    expect(analyticsPage).toBeTruthy();

    const navClick = s.topClicks.find((c) => c.key === "nav:analytics");
    expect(navClick).toBeTruthy();

    // 14-day series is present and today has activity.
    expect(s.series).toHaveLength(14);
    expect(s.series[s.series.length - 1].pageviews).toBeGreaterThan(0);

    // Recent feed carries the newest event first.
    expect(s.recent[0].type).toBe("click");
  });
});

describe("transit label helpers", () => {
  it("cleanToken bounds and trims short identifiers", () => {
    expect(cleanToken("  KCM  ")).toBe("KCM");
    expect(cleanToken("")).toBeUndefined();
    expect(cleanToken(123)).toBeUndefined();
    expect(cleanToken("x".repeat(60))?.length).toBe(40);
  });

  it("routeLabel prefixes agency and falls back to routeId", () => {
    expect(routeLabel({ agency: "KCM", routeShortName: "40" })).toBe("KCM 40");
    expect(routeLabel({ agency: "ST", routeId: "100479" })).toBe("ST 100479");
    expect(routeLabel({ routeShortName: "550" })).toBe("550");
    expect(routeLabel({ agency: "KCM" })).toBe("");
  });

  it("vehicleLabel handles numeric fleet ids and ferry vessel names", () => {
    expect(
      vehicleLabel({ agency: "KCM", routeShortName: "40", vehicleNumber: "1234" }),
    ).toBe("KCM 40 #1234");
    // Ferries report a vessel name (non-numeric) and often no route.
    expect(vehicleLabel({ agency: "WSF", vehicleNumber: "Wenatchee" })).toBe(
      "WSF Wenatchee",
    );
    expect(vehicleLabel({ agency: "KCM", routeShortName: "40" })).toBe("KCM 40");
  });
});

describe("transit + traffic-source aggregation", () => {
  beforeEach(async () => {
    await recordEvent(
      ev({ type: "click", category: "vehicle", agency: "KCM", routeShortName: "40", vehicleNumber: "1234" }),
      "v1",
    );
    await recordEvent(
      ev({ type: "click", category: "route", agency: "ST", routeShortName: "550" }),
      "v2",
    );
    await recordEvent(
      ev({ type: "pageview", path: "/", country: "US", utmSource: "newsletter" }),
      "v3",
    );
  });

  it("routes vehicle/route clicks and geo/utm into their own lists", async () => {
    const s = await getStats(Date.now());

    // A vehicle click credits both the vehicle and its route.
    expect(s.topVehicles.find((v) => v.key === "KCM 40 #1234")).toBeTruthy();
    expect(s.topRoutes.find((r) => r.key === "KCM 40")).toBeTruthy();
    // A route-open click credits the route.
    expect(s.topRoutes.find((r) => r.key === "ST 550")).toBeTruthy();

    // Vehicle/route clicks do NOT pollute the generic "most clicked" list.
    expect(s.topClicks.find((c) => c.key === "KCM 40 #1234")).toBeFalsy();

    // Traffic sources.
    expect(s.countries.find((c) => c.key === "US")).toBeTruthy();
    expect(s.campaigns.find((c) => c.key === "newsletter")).toBeTruthy();
  });
});
