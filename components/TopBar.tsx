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
        <div className="mt-2 flex flex-col items-start gap-2">
          <ThemeToggle />
          <div className="flex items-center gap-2">
            <Link
              href="/analytics"
              data-analytics="nav:analytics"
              title="View site analytics"
              className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
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
            <a
              href="https://interlinedlist.com"
              target="_blank"
              rel="noopener noreferrer"
              data-analytics="nav:interlinedlist"
              title="Visit InterlinedList"
              className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </svg>
              InterlinedList
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
