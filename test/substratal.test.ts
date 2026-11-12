import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetRefreshCacheForTests,
  getSettings,
  login,
  patchSettings,
  refreshSession,
  SubstratalError,
} from "@/lib/substratal";
import { errorMessage } from "@/lib/accountApi";

const SESSION = {
  token_type: "Bearer",
  access_token: "eyJ.new",
  expires_in: 900,
  refresh_token: "rtk_new",
  refresh_token_expires_in: 2_592_000,
  session_id: "ses_1",
  user_id: "usr_1",
  email_verified: true,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  _resetRefreshCacheForTests();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Substratal client", () => {
  it("sends the required version header and JSON body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(SESSION));
    await login("a@example.com", "correct horse battery staple");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.substratalapps.com/auth/login");
    expect(init.headers["Substratal-Version"]).toBe("1");
    expect(JSON.parse(init.body)).toEqual({ email: "a@example.com", password: "correct horse battery staple" });
  });

  it("parses the error envelope into a SubstratalError", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: "invalid_credentials", message: "Bad login" } }, 401),
    );
    const err = await login("a@example.com", "nope").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SubstratalError);
    expect(err).toMatchObject({ status: 401, code: "invalid_credentials" });
    expect(errorMessage(err).message).toBe("That email and password don't match.");
  });

  it("maps upstream outages to a 502 with a calm message", async () => {
    fetchMock.mockResolvedValue(new Response("<html>bad gateway</html>", { status: 503 }));
    const err = await getSettings("tok").catch((e: unknown) => e);
    expect(errorMessage(err)).toMatchObject({ status: 502, code: "upstream_error" });
  });

  it("reads per-app settings from the app's settings path", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ resolved: { favorite_routes: [], favorite_stops: [] }, sources: {} }),
    );
    await getSettings("tok");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.substratalapps.com/users/me/apps/app_dashingarrivals/settings",
    );
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });

  it("reports whose settings a save updated, so the popularity tally counts the right account", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        user_id: "usr_7",
        resolved: { favorite_routes: [{ agency: "KCM", route_id: "100001", short_name: "1" }] },
        sources: {},
      }),
    );
    const { userId, settings } = await patchSettings("tok", {
      favoriteRoutes: [{ agency: "KCM", routeId: "100001", shortName: "1", color: "#123456" }],
    });
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    expect(userId).toBe("usr_7");
    expect(settings.favoriteRoutes.map((r) => r.routeId)).toEqual(["100001"]);
  });

  it("shares one refresh call between concurrent requests (refresh tokens are single-use)", async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    const a = refreshSession("rtk_old");
    const b = refreshSession("rtk_old");
    resolve(jsonResponse(SESSION));
    expect(await a).toEqual(await b);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A request that raced past the cookie update still gets the new tokens.
    expect(await refreshSession("rtk_old")).toEqual(SESSION);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lets a failed refresh be retried", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    await expect(refreshSession("rtk_x")).rejects.toMatchObject({ code: "upstream_unreachable" });
    fetchMock.mockResolvedValueOnce(jsonResponse(SESSION));
    await expect(refreshSession("rtk_x")).resolves.toEqual(SESSION);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
