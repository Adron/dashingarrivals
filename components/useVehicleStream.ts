"use client";

// Polls /api/vehicles on an interval and returns the latest snapshot.
// Polling (not SSE) keeps this working on every Vercel plan; the server cache
// means many clients share one upstream refresh.

import { useEffect, useState } from "react";
import { clientConfig } from "@/lib/clientConfig";
import type { VehicleSnapshot } from "@/lib/types";

export function useVehicleStream() {
  const [snapshot, setSnapshot] = useState<VehicleSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const res = await fetch("/api/vehicles", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: VehicleSnapshot = await res.json();
        if (active) {
          setSnapshot(data);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) timer = setTimeout(tick, clientConfig.pollMs);
      }
    };

    tick();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return { snapshot, error };
}
