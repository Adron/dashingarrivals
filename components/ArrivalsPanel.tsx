"use client";

// Slide-in panel showing live arrival countdowns for the selected stop.
// Bottom sheet on mobile, right-side panel on larger screens.

import { useSyncExternalStore } from "react";
import { useSelectedStop } from "@/lib/store";
import { useStopArrivals } from "@/components/useStopArrivals";
import { formatCountdown } from "@/lib/time";

// Ticking clock so countdowns update between the 20s arrival polls.
function subscribeClock(callback: () => void) {
  const iv = setInterval(callback, 10_000);
  return () => clearInterval(iv);
}
function getNow() {
  return Date.now();
}

export default function ArrivalsPanel() {
  const { selectedStop, setSelectedStop } = useSelectedStop();
  const { data, loading, error } = useStopArrivals(selectedStop?.id ?? null);
  const now = useSyncExternalStore(subscribeClock, getNow, getNow);

  if (!selectedStop) return null;

  const arrivals = data?.arrivals ?? [];

  return (
    <aside
      className="absolute inset-x-0 bottom-0 z-20 max-h-[55%] overflow-y-auto rounded-t-2xl bg-white/95 shadow-2xl backdrop-blur sm:inset-y-0 sm:right-0 sm:left-auto sm:w-80 sm:max-h-none sm:rounded-none sm:rounded-l-2xl dark:bg-zinc-900/95 dark:text-zinc-100"
      aria-label="Stop arrivals"
    >
      <header className="sticky top-0 flex items-start justify-between gap-2 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">
            {data?.stopName ?? selectedStop.name}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Stop #{selectedStop.code}
            {selectedStop.direction ? ` · ${selectedStop.direction}` : ""}
          </p>
        </div>
        <button
          onClick={() => setSelectedStop(null)}
          className="shrink-0 rounded-full px-2 py-1 text-lg leading-none text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Close"
        >
          ×
        </button>
      </header>

      <div className="px-2 py-2">
        {error && (
          <p className="px-2 py-3 text-sm text-amber-600 dark:text-amber-400">
            Couldn&apos;t load arrivals — retrying…
          </p>
        )}
        {!error && arrivals.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {loading && !data ? "Loading arrivals…" : "No upcoming arrivals."}
          </p>
        )}
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {arrivals.map((a, i) => {
            const label = formatCountdown(a.arrivalTime, now);
            const due = label === "Due";
            return (
              <li key={`${a.routeShortName}-${a.arrivalTime}-${i}`} className="flex items-center gap-3 px-2 py-2.5">
                <span className="inline-flex min-w-11 shrink-0 items-center justify-center rounded-md bg-zinc-900 px-2 py-1 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                  {a.routeShortName || "—"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{a.headsign}</span>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    due ? "text-green-600 dark:text-green-400" : ""
                  }`}
                  title={a.predicted ? "Real-time" : "Scheduled"}
                >
                  {label}
                  {a.predicted ? (
                    <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500 align-middle" />
                  ) : (
                    <span className="ml-1 text-[10px] font-normal text-zinc-400">sched</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
