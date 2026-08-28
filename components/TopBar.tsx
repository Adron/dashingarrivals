"use client";

// Header with title, live vehicle count, and freshness / source status.

import type { VehicleSnapshot } from "@/lib/types";

export default function TopBar({
  snapshot,
  error,
}: {
  snapshot: VehicleSnapshot | null;
  error: string | null;
}) {
  const count = snapshot?.vehicles.length ?? 0;
  const updated = snapshot?.updatedAt
    ? new Date(snapshot.updatedAt).toLocaleTimeString()
    : "…";

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4">
      <div className="pointer-events-auto rounded-xl bg-white/90 px-4 py-2 shadow-lg backdrop-blur dark:bg-zinc-900/90 dark:text-zinc-100">
        <h1 className="text-base font-semibold tracking-tight">
          Puget Sound Transit — Live
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {error ? (
            <span className="text-amber-600 dark:text-amber-400">
              Connection issue — retrying…
            </span>
          ) : (
            <>
              <span className="font-medium text-zinc-700 dark:text-zinc-200">
                {count.toLocaleString()}
              </span>{" "}
              vehicles · updated {updated}
              {snapshot?.mock ? " · demo data" : ""}
            </>
          )}
        </p>
      </div>
    </header>
  );
}
