"use client";

// Polls active service alerts (they change slowly, so every 60s).

import { useEffect, useState } from "react";
import type { Alert } from "@/lib/types";

const REFRESH_MS = 60_000;

export function useAlerts(): Alert[] {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const res = await fetch("/api/alerts", { cache: "no-store" });
        if (res.ok) {
          const json: { alerts?: Alert[] } = await res.json();
          if (active) setAlerts(json.alerts ?? []);
        }
      } catch {
        // keep the last set; retry next tick
      } finally {
        if (active) timer = setTimeout(tick, REFRESH_MS);
      }
    };

    tick();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return alerts;
}
