"use client";

// Polls real-time arrivals for a stop while a stop is selected. Results are tagged
// with their stopId so a previous stop's arrivals never show under a new selection.

import { useEffect, useState } from "react";
import type { StopArrivals } from "@/lib/types";

const REFRESH_MS = 20_000;

interface Result {
  stopId: string;
  data?: StopArrivals;
  error?: string;
}

export function useStopArrivals(stopId: string | null) {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!stopId) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const res = await fetch(`/api/stops/${encodeURIComponent(stopId)}/arrivals`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: StopArrivals = await res.json();
        if (active) setResult({ stopId, data: json });
      } catch (err) {
        if (active) setResult({ stopId, error: err instanceof Error ? err.message : String(err) });
      } finally {
        if (active) timer = setTimeout(tick, REFRESH_MS);
      }
    };

    tick();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [stopId]);

  // Only surface results that belong to the current stop.
  const current = result && result.stopId === stopId ? result : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: !!stopId && !current,
  };
}
