// POST /api/analytics/track — ingest one pageview or click event.
//
// Called from the client via navigator.sendBeacon (falling back to fetch with
// keepalive). Fire-and-forget: always answers 204 quickly and never blocks the
// page, even if aggregation fails. An anonymous visitor id is kept in a
// first-party httpOnly cookie purely to estimate unique visitors.

import { NextResponse, type NextRequest } from "next/server";
import {
  cleanLabel,
  cleanPath,
  deviceFromUA,
  recordEvent,
  referrerHost,
  type AnalyticsEvent,
  type EventType,
} from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VID_COOKIE = "da_vid";
const VID_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  // sendBeacon sets our Blob's content-type; fetch fallback sends JSON too.
  // Fall back to manual text parsing so an odd content-type can't drop events.
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    try {
      const text = await req.text();
      return text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
}

export async function POST(req: NextRequest) {
  const body = await readBody(req);

  const type = body.type === "click" ? "click" : ("pageview" as EventType);
  const device = deviceFromUA(req.headers.get("user-agent"));

  const ev: AnalyticsEvent = {
    type,
    path: cleanPath(body.path),
    device,
    ts: Date.now(),
  };

  if (type === "pageview") {
    ev.refHost = referrerHost(body.referrer, req.nextUrl.host);
  } else {
    ev.label = cleanLabel(body.label) ?? "(unlabeled)";
    const href = cleanLabel(body.href, 200);
    if (href) ev.href = href;
  }

  // Stable-per-browser anonymous id; created on first hit if absent.
  let vid = req.cookies.get(VID_COOKIE)?.value;
  const isNew = !vid;
  if (!vid) vid = crypto.randomUUID();

  try {
    await recordEvent(ev, vid);
  } catch {
    // Analytics must never surface an error to the visitor.
  }

  const res = new NextResponse(null, { status: 204 });
  if (isNew) {
    res.cookies.set(VID_COOKIE, vid, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      maxAge: VID_MAX_AGE,
      path: "/",
    });
  }
  return res;
}
