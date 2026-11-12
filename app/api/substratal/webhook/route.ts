// POST /api/substratal/webhook — Substratal's access.revoked and role.removed
// events, which its trust model asks every Application to subscribe to.
//
// We keep no server-side session store to purge: once a user's access to
// app_dashingarrivals is revoked, their next settings call returns
// 403 entitlement_required and the client shows them as signed in without
// saved settings. The one thing we hold per account is their share of the
// "Most Popular Top 5" tally, which access.revoked removes.

import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { forgetUser } from "@/lib/popularRoutes";
import { verifySubstratalSignature } from "@/lib/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (config.substratalWebhookSecrets.length === 0) {
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 503 });
  }
  // Verify against the exact bytes received, never re-serialized JSON.
  const raw = await req.text();
  const ok = verifySubstratalSignature(
    req.headers.get("substratal-signature"),
    raw,
    config.substratalWebhookSecrets,
  );
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  let event: { id?: string; type?: string; data?: { user_id?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    // Signed but not JSON — still acknowledge so Substratal doesn't retry.
    return NextResponse.json({ received: true });
  }
  console.info("[substratal-webhook]", event.type, {
    id: event.id,
    user: event.data?.user_id,
    delivery: req.headers.get("substratal-delivery-id"),
  });
  if (event.type === "access.revoked" && event.data?.user_id) {
    try {
      await forgetUser(event.data.user_id);
    } catch (err) {
      // Let Substratal retry the delivery.
      console.error("[substratal-webhook] popular routes cleanup failed", err);
      return NextResponse.json({ error: "cleanup failed" }, { status: 500 });
    }
  }
  return NextResponse.json({ received: true });
}
