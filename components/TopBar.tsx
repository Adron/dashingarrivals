"use client";

// Header with title, live vehicle count, and freshness / source status.

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
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
            </>
          )}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/analytics"
            data-analytics="nav:analytics"
            title="View site analytics"
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 3v18h18" />
              <path d="M7 15l3-4 3 3 4-6" />
            </svg>
            Analytics
          </Link>
        </div>
      </div>
    </header>
  );
}
