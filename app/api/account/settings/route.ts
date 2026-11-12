// PATCH /api/account/settings — save the theme, Top 5 Routes, or saved stops.
// The body is cleaned and capped (lib/accountSettings.ts) before it's sent on,
// since Substratal's settings_schema can't express list limits. Lists replace
// the stored list wholesale. Answers the full, updated settings.
//
// A saved Top 5 also updates the "Most Popular Top 5" tally (lib/popularRoutes.ts).

import { NextResponse } from "next/server";
import { errorResponse, jsonError, NO_STORE, readJson, syncPopular } from "@/lib/accountApi";
import { sanitizePatch } from "@/lib/accountSettings";
import { withAccessToken } from "@/lib/session";
import { patchSettings } from "@/lib/substratal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const patch = sanitizePatch(await readJson(req));
  try {
    const result = await withAccessToken((token) => patchSettings(token, patch));
    if (!result) return jsonError(401, "signed_out", "Your session ended. Sign in again.");
    if (patch.favoriteRoutes && result.userId) {
      await syncPopular(result.userId, result.settings.favoriteRoutes);
    }
    return NextResponse.json({ settings: result.settings }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
