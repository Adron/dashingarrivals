// Cache-aside snapshot layer that decouples upstream fetch rate from client count.
//
// Tiers:
//   1. per-instance memory cache (fast path, TTL = cacheTtlMs)
//   2. shared Upstash Redis cache (if configured) so instances share one refresh
//   3. per-instance single-flight so concurrent requests trigger one rebuild
//   4. last-good fallback served on upstream error
//
// Note: the single-flight lock is per serverless instance, not global. Redis as a
// shared cache keeps upstream calls ~1 per TTL in practice; a Redis lock is a
// future hardening if instance fan-out grows.

import { Redis } from "@upstash/redis";
import { config } from "@/lib/config";
import { buildSnapshot } from "@/lib/vehicles";
import type { VehicleSnapshot } from "@/lib/types";

const KEY = "vehicles:snapshot";

const redis =
  config.kvUrl && config.kvToken
    ? new Redis({ url: config.kvUrl, token: config.kvToken })
    : null;

let memory: { data: VehicleSnapshot; expires: number } | null = null;
let inflight: Promise<VehicleSnapshot> | null = null;
let lastGood: VehicleSnapshot | null = null;

export async function getCachedSnapshot(): Promise<VehicleSnapshot> {
  const now = Date.now();

  if (memory && memory.expires > now) return memory.data;

  if (redis) {
    const cached = await redis.get<VehicleSnapshot>(KEY);
    if (cached) {
      memory = { data: cached, expires: now + config.cacheTtlMs };
      lastGood = cached;
      return cached;
    }
  }

  if (!inflight) {
    inflight = refresh().finally(() => {
      inflight = null;
    });
  }

  try {
    return await inflight;
  } catch (err) {
    if (lastGood) return lastGood;
    throw err;
  }
}

async function refresh(): Promise<VehicleSnapshot> {
  const snapshot = await buildSnapshot();
  lastGood = snapshot;
  memory = { data: snapshot, expires: Date.now() + config.cacheTtlMs };

  if (redis) {
    const ttlSec = Math.max(1, Math.ceil(config.cacheTtlMs / 1000));
    await redis.set(KEY, snapshot, { ex: ttlSec });
  }

  return snapshot;
}
