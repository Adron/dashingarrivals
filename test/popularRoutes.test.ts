import { beforeEach, describe, expect, it } from "vitest";
import type { FavoriteRoute } from "@/lib/accountSettings";
import {
  _resetPopularRoutesForTests,
  forgetUser,
  getPopularRoutes,
  syncUserRoutes,
} from "@/lib/popularRoutes";

// No KV_* env is set under vitest, so this exercises the in-memory tally.

const route = (n: number, agency = "KCM"): FavoriteRoute => ({
  agency,
  routeId: String(100000 + n),
  shortName: String(n),
  color: "#123456",
});

const ranking = async () => (await getPopularRoutes()).map((r) => [r.shortName, r.count]);

describe("popular routes", () => {
  beforeEach(() => _resetPopularRoutesForTests());

  it("counts each account once per route and ranks by count", async () => {
    await syncUserRoutes("u1", [route(1), route(2)]);
    await syncUserRoutes("u2", [route(2), route(3)]);
    await syncUserRoutes("u3", [route(2), route(3)]);
    expect(await ranking()).toEqual([
      ["2", 3],
      ["3", 2],
      ["1", 1],
    ]);
  });

  it("is idempotent when the same Top 5 is synced again", async () => {
    await syncUserRoutes("u1", [route(1)]);
    await syncUserRoutes("u1", [route(1)]);
    await syncUserRoutes("u1", [route(1), route(1)]);
    expect(await ranking()).toEqual([["1", 1]]);
  });

  it("moves a user's vote when their Top 5 changes", async () => {
    await syncUserRoutes("u1", [route(1), route(2)]);
    await syncUserRoutes("u2", [route(1)]);
    await syncUserRoutes("u1", [route(2), route(3)]);
    expect(await ranking()).toEqual([
      ["3", 1],
      ["2", 1],
      ["1", 1],
    ]);
    await syncUserRoutes("u2", []);
    expect((await ranking()).map(([name]) => name)).not.toContain("1");
  });

  it("forgets a user entirely", async () => {
    await syncUserRoutes("u1", [route(1), route(2)]);
    await syncUserRoutes("u2", [route(2)]);
    await forgetUser("u1");
    expect(await ranking()).toEqual([["2", 1]]);
  });

  it("returns at most five routes", async () => {
    await syncUserRoutes("u1", [1, 2, 3, 4, 5].map((n) => route(n)));
    await syncUserRoutes("u2", [6, 7].map((n) => route(n)));
    expect(await getPopularRoutes()).toHaveLength(5);
  });

  it("keeps the same route id under different agencies apart", async () => {
    await syncUserRoutes("u1", [route(1, "KCM"), route(1, "ST")]);
    expect(await getPopularRoutes()).toHaveLength(2);
  });
});
