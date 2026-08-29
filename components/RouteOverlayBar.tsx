"use client";

// Floating chip shown while a route overlay is active on the map. Displays the
// route and a button to clear the overlay (mirrors the selected-route store).

import { useSelectedRoute } from "@/lib/store";

export default function RouteOverlayBar() {
  const { selectedRoute, setSelectedRoute } = useSelectedRoute();
  if (!selectedRoute) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/95 py-1.5 pl-3 pr-1.5 text-sm font-medium shadow-lg backdrop-blur dark:bg-zinc-900/95 dark:text-zinc-100">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: selectedRoute.color }}
        />
        <span>
          Route <span className="font-semibold">{selectedRoute.shortName}</span>
        </span>
        <button
          type="button"
          onClick={() => setSelectedRoute(null)}
          className="ml-1 rounded-full px-2 py-0.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label="Clear route overlay"
        >
          Clear ✕
        </button>
      </div>
    </div>
  );
}
