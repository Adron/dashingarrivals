// Verifying Substratal webhook deliveries.
//
// Header: `Substratal-Signature: t=<unix seconds>,v1=<hex>[,v1=<hex>]`, where
// v1 = HMAC-SHA256(secret, "{t}.{raw body}"). During a secret rotation two v1
// values arrive; any match passes. Deliveries older than 5 minutes are
// rejected so a captured request can't be replayed.

import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_S = 300;

export function verifySubstratalSignature(
  header: string | null,
  rawBody: string,
  secrets: string[],
  nowMs: number = Date.now(),
): boolean {
  if (!header || secrets.length === 0) return false;
  const parts = header.split(",").map((p) => {
    const i = p.indexOf("=");
    return i < 0 ? [p.trim(), ""] : [p.slice(0, i).trim(), p.slice(i + 1).trim()];
  });
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  if (!Number.isFinite(t) || t <= 0 || Math.abs(nowMs / 1000 - t) > TOLERANCE_S) return false;

  const sigs = parts
    .filter(([k, v]) => k === "v1" && /^[0-9a-f]+$/i.test(v))
    .map(([, v]) => Buffer.from(v, "hex"));
  if (sigs.length === 0) return false;

  return secrets.some((secret) => {
    const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
    return sigs.some((sig) => sig.length === expected.length && timingSafeEqual(sig, expected));
  });
}
